import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

async function requireAdmin(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return null; }
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Belum login sebagai admin" }); return null; }
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(token); }
  catch { res.status(401).json({ error: "Token tidak valid" }); return null; }
  if (!ADMIN_EMAILS.includes(decoded.email)) { res.status(403).json({ error: "Bukan admin" }); return null; }
  return decoded;
}

// Firestore batch maksimal 500 operasi
async function commitInChunks(updates) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = adminDb.batch();
    updates.slice(i, i + 400).forEach(([ref, data]) => batch.update(ref, data));
    await batch.commit();
  }
}

// Sekali jalan: simpan harga & nama server ke semua order lama yang belum punya,
// selama servernya masih ada. Order dari server yang SUDAH terhapus dilaporkan (nggak bisa dipulihkan otomatis).
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    const [serversSnap, ordersSnap] = await Promise.all([
      adminDb.collection("servers").get(),
      adminDb.collection("orders").get(),
    ]);
    const servers = {};
    serversSnap.docs.forEach((d) => { servers[d.id] = d.data(); });

    const updates = [];
    let orphanPaid = 0;
    ordersSnap.docs.forEach((d) => {
      const o = d.data();
      const needHarga = !o.total_amount && !o.harga;
      const needNama = !o.server_nama;
      if (!needHarga && !needNama) return;
      const s = servers[o.server_id];
      if (!s) {
        if (o.status === "paid" && needHarga) orphanPaid++;
        return;
      }
      const patch = {};
      if (needHarga) patch.harga = Number(s.harga || 0);
      if (needNama) patch.server_nama = s.nama || "";
      updates.push([d.ref, patch]);
    });
    await commitInChunks(updates);

    return res.status(200).json({ success: true, diperbarui: updates.length, orderServerHilang: orphanPaid });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal memproses" });
  }
}
