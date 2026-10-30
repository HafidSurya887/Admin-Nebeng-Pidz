import { adminDb, adminAuth } from "../../../lib/firebaseAdmin";
import { sendEmail } from "../../../lib/email";

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

  const { targetType, serverId, message } = req.body;
  if (!targetType || !message) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }
  if (targetType === "server" && !serverId) {
    return res.status(400).json({ error: "Pilih server tujuan" });
  }

  try {
    // Cari order yang statusnya paid, sesuai target
    let ordersQuery = adminDb.collection("orders").where("status", "==", "paid");
    if (targetType === "server") {
      ordersQuery = ordersQuery.where("server_id", "==", serverId);
    }
    const ordersSnap = await ordersQuery.get();

    // Dedupe buyer_id biar 1 buyer gak dapet email dobel walau punya beberapa order
    const buyerIds = [...new Set(ordersSnap.docs.map((d) => d.data().buyer_id))];

    let serverNama = "semua server";
    if (targetType === "server") {
      const serverSnap = await adminDb.collection("servers").doc(serverId).get();
      serverNama = serverSnap.exists ? serverSnap.data().nama : "server";
    }

    // Simpan pesan biar bisa ditampilin di dashboard buyer
    await adminDb.collection("messages").add({
      target_type: targetType,
      server_id: targetType === "server" ? serverId : null,
      server_nama: serverNama,
      message,
      created_at: new Date().toISOString(),
    });

    // Kirim email ke tiap buyer terkait
    let sentCount = 0;
    for (const buyerId of buyerIds) {
      const buyerSnap = await adminDb.collection("buyers").doc(buyerId).get();
      if (!buyerSnap.exists) continue;
      const buyer = buyerSnap.data();
      if (!buyer.email) continue;

      await sendEmail({
        to: buyer.email,
        subject: `Pemberitahuan - ${serverNama}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <p>Halo ${buyer.nama || "Buyer"},</p>
            <p>Ada pemberitahuan terkait akun kamu di <b>${serverNama}</b>:</p>
            <div style="background:#f4f4f4; padding:14px; border-radius:8px; margin:14px 0;">
              ${message}
            </div>
            <p>Buka dashboard kamu buat detail lebih lanjut:</p>
            <p><a href="https://nebeng-impulse.vercel.app/riwayat?tab=akun">Buka Dashboard</a></p>
            <p style="color:#888; font-size:12px; margin-top:20px;">
              Email ini dikirim otomatis dari Nebeng Impulse Pidz sesuai akun yang kamu daftarkan.
            </p>
          </div>
        `,
      });
      sentCount++;
    }

    return res.status(200).json({ ok: true, sentCount, totalBuyers: buyerIds.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal kirim pesan" });
  }
}
