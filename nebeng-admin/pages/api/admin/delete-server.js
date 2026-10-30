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

// Hapus server SAMBIL menyimpan harga & nama server ke tiap order-nya,
// supaya total pemasukan nggak berkurang gara-gara servernya hilang.
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { serverId } = req.body || {};
  if (!serverId) return res.status(400).json({ error: "serverId wajib diisi" });

  try {
    const serverRef = adminDb.collection("servers").doc(serverId);
    const serverSnap = await serverRef.get();
    if (!serverSnap.exists) return res.status(404).json({ error: "Server tidak ditemukan" });
    const server = serverSnap.data();

    const ordersSnap = await adminDb.collection("orders").where("server_id", "==", serverId).get();
    const updates = [];
    ordersSnap.docs.forEach((d) => {
      const o = d.data();
      const patch = {};
      if (!o.total_amount && !o.harga) patch.harga = Number(server.harga || 0);
      if (!o.server_nama) patch.server_nama = server.nama || "";
      if (Object.keys(patch).length) updates.push([d.ref, patch]);
    });
    await commitInChunks(updates);

    await serverRef.delete();
    return res.status(200).json({ success: true, ordersDiamankan: updates.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal menghapus server" });
  }
}
