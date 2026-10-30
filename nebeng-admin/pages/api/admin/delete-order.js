import { FieldValue } from "firebase-admin/firestore";
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

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId wajib diisi" });

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Order tidak ditemukan" });
    const order = orderSnap.data();

    // Kalau order ini statusnya "paid", slot di server-nya perlu dikurangin 1 juga -
    // biar slot yang kepake sama order yang dihapus ini kebuka lagi buat buyer lain.
    const batch = adminDb.batch();
    batch.delete(orderRef);
    if (order.status === "paid" && order.server_id) {
      const serverRef = adminDb.collection("servers").doc(order.server_id);
      const serverSnap = await serverRef.get();
      if (serverSnap.exists) {
        batch.update(serverRef, { slot_terisi: FieldValue.increment(-1) });
      }
    }
    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal menghapus order" });
  }
}
