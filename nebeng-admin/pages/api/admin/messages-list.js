import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
    const snap = await adminDb.collection("messages").get();
    const messages = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return res.status(200).json({ messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal ambil riwayat pesan" });
  }
}
