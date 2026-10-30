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
    const [ticketsSnap, buyersSnap] = await Promise.all([
      adminDb.collection("tickets").get(),
      adminDb.collection("buyers").get(),
    ]);

    const buyerMap = {};
    buyersSnap.docs.forEach((d) => { buyerMap[d.id] = d.data(); });

    const tickets = ticketsSnap.docs
      .map((d) => {
        const t = d.data();
        return {
          id: d.id,
          ...t,
          buyer_nama: buyerMap[t.buyer_id]?.nama || "-",
          buyer_email: buyerMap[t.buyer_id]?.email || "-",
        };
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return res.status(200).json({ tickets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal ambil laporan" });
  }
}
