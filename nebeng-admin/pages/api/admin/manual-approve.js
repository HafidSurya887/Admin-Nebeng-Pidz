import { FieldValue } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";
import { sendMessage } from "../../../lib/telegram";

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

  const { orderId, targetServerId } = req.body || {};
  if (!orderId || !targetServerId) {
    return res.status(400).json({ error: "orderId dan targetServerId wajib diisi" });
  }

  try {
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Order tidak ditemukan" });
    const order = orderSnap.data();

    if (order.status === "paid") {
      return res.status(400).json({
        error: "Order ini statusnya udah \"paid\", nggak perlu di-ACC manual lagi.",
      });
    }

    const targetServerSnap = await adminDb.collection("servers").doc(targetServerId).get();
    if (!targetServerSnap.exists) return res.status(404).json({ error: "Server tujuan tidak ditemukan" });
    const targetServer = targetServerSnap.data();

    // Order ini dijamin belum pernah "paid" (udah dicek di atas), jadi tinggal nambah +1
    // ke server tujuan aja - gak perlu ngurangin server manapun.
    const batch = adminDb.batch();
    batch.update(orderRef, {
      status: "paid",
      server_id: targetServerId,
      ...(!order.total_amount && !order.harga ? { harga: Number(targetServer.harga || 0) } : {}),
      server_nama: targetServer.nama || "",
      manual_approved: true,
      manual_approved_at: new Date().toISOString(),
      manual_approved_by: decoded.email,
    });
    batch.update(adminDb.collection("servers").doc(targetServerId), { slot_terisi: FieldValue.increment(1) });
    await batch.commit();

    const buyerSnap = await adminDb.collection("buyers").doc(order.buyer_id).get();
    const buyer = buyerSnap.exists ? buyerSnap.data() : null;
    sendMessage(
      `✅ <b>ACC Manual oleh Admin</b>\nBuyer: ${buyer?.nama || "-"}\nServer: ${targetServer.nama}\nNominal: Rp${Number(order.total_amount || order.harga || 0).toLocaleString("id-ID")}\nOrder ID: ${orderId}`
    ).catch((e) => console.error("Gagal kirim notif Telegram ACC manual:", e));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal approve order" });
  }
}
