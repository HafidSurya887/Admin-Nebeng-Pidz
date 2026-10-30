import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

// Endpoint ini SENGAJA masih baca semua order "paid" - tapi cuma dipanggil manual
// oleh admin (bukan tiap ada pengunjung), jadi aman dipakai buat:
// 1) Inisialisasi slot_terisi pertama kali pas fitur ini baru dipasang.
// 2) "Resync" jaga-jaga kalau ada bug/drift bikin angkanya meleset dari kenyataan.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Belum login sebagai admin" });

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "Token tidak valid" });
  }
  if (!ADMIN_EMAILS.includes(decoded.email)) {
    return res.status(403).json({ error: "Bukan admin" });
  }

  try {
    const [serversSnap, paidSnap] = await Promise.all([
      adminDb.collection("servers").get(),
      adminDb.collection("orders").where("status", "==", "paid").get(),
    ]);

    const countByServer = {};
    paidSnap.docs.forEach((d) => {
      const sid = d.data().server_id;
      if (sid) countByServer[sid] = (countByServer[sid] || 0) + 1;
    });

    const batch = adminDb.batch();
    const result = [];
    serversSnap.docs.forEach((d) => {
      const count = countByServer[d.id] || 0;
      batch.update(d.ref, { slot_terisi: count });
      result.push({ id: d.id, nama: d.data().nama, slot_terisi: count });
    });
    await batch.commit();

    return res.status(200).json({ success: true, servers: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal sinkronkan slot server" });
  }
}
