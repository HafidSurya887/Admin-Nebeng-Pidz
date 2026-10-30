import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

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

  const { ticketId, reply } = req.body || {};
  if (!ticketId || !reply || !reply.trim()) {
    return res.status(400).json({ error: "ticketId dan balasan wajib diisi" });
  }

  try {
    const ref = adminDb.collection("tickets").doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Laporan tidak ditemukan" });

    await ref.update({
      admin_reply: reply.trim(),
      status: "replied",
      replied_at: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal kirim balasan" });
  }
}
