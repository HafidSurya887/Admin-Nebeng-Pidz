import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim());

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Verifikasi admin via Firebase ID token yang dikirim dari client
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

  const { buyerId } = req.body || {};
  if (!buyerId) return res.status(400).json({ error: "buyerId wajib diisi" });

  try {
    const buyerRef = adminDb.collection("buyers").doc(buyerId);
    const buyerSnap = await buyerRef.get();
    if (!buyerSnap.exists) {
      return res.status(404).json({ error: "Buyer tidak ditemukan" });
    }

    // Hapus semua order milik buyer ini juga, biar bersih total (bukan cuma akunnya).
    // Order yang statusnya "paid" ikut ngurangin slot_terisi server terkait, biar slot-nya
    // kebuka lagi buat buyer lain (bukan nyangkut ke-reserve buat buyer yang udah dihapus).
    const ordersSnap = await adminDb.collection("orders").where("buyer_id", "==", buyerId).get();
    const paidCountByServer = {};
    ordersSnap.docs.forEach((d) => {
      const o = d.data();
      if (o.status === "paid" && o.server_id) {
        paidCountByServer[o.server_id] = (paidCountByServer[o.server_id] || 0) + 1;
      }
    });

    // Cek server-nya masih ada sebelum decrement, biar batch gak gagal gara-gara update
    // dokumen yang udah kehapus duluan (misal server lama udah dihapus admin).
    const serverIds = Object.keys(paidCountByServer);
    const serverExistChecks = await Promise.all(
      serverIds.map((id) => adminDb.collection("servers").doc(id).get())
    );

    const batch = adminDb.batch();
    ordersSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(buyerRef);
    serverIds.forEach((id, i) => {
      if (serverExistChecks[i].exists) {
        batch.update(adminDb.collection("servers").doc(id), {
          slot_terisi: FieldValue.increment(-paidCountByServer[id]),
        });
      }
    });
    await batch.commit();

    return res.status(200).json({ success: true, ordersDeleted: ordersSnap.size });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal menghapus buyer" });
  }
}
