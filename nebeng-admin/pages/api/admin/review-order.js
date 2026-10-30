import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());
const VALID_STATUS = ["aman", "curang"];

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

  const { orderId, status } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId wajib diisi" });
  // status null/undefined = hapus tanda (balikin ke belum-dicek)
  if (status !== null && status !== undefined && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Order tidak ditemukan" });

    if (status) {
      await orderRef.update({
        review_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: decoded.email,
      });
    } else {
      await orderRef.update({
        review_status: FieldValue.delete(),
        reviewed_at: FieldValue.delete(),
        reviewed_by: FieldValue.delete(),
      });
    }

    return res.status(200).json({ success: true, status: status || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal update status order" });
  }
}
