// 3 bot Telegram terpisah, dipilih lewat parameter "bot": "order" | "laporan" | "reset".
// Pakai TOKEN yang beda-beda, tapi boleh pakai chat_id admin yang sama (asal admin udah
// pernah /start ke semua bot itu, karena bot gak bisa mulai chat duluan ke user).
const BOTS = {
  order: {
    token: process.env.TELEGRAM_BOT_TOKEN_ORDER || process.env.TELEGRAM_BOT_TOKEN, // fallback ke token lama
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  },
  laporan: {
    token: process.env.TELEGRAM_BOT_TOKEN_LAPORAN,
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  },
  reset: {
    token: process.env.TELEGRAM_BOT_TOKEN_RESET,
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  },
};

function apiUrl(bot) {
  const token = BOTS[bot]?.token;
  if (!token) throw new Error(`Token bot Telegram "${bot}" belum di-set di environment variable.`);
  return `https://api.telegram.org/bot${token}`;
}

function chatId(bot) {
  return BOTS[bot]?.chatId;
}

// Kirim foto + caption + tombol inline (Approve/Reject) ke admin
export async function sendPhotoWithButtons(photoUrl, caption, buttons, bot = "order") {
  const res = await fetch(`${apiUrl(bot)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId(bot),
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [buttons], // contoh: [{ text: "✅ Approve", callback_data: "approve_reset_ORDER123" }, ...]
      },
    }),
  });
  return res.json();
}

// Edit pesan yang udah dikirim (dipakai setelah admin approve/reject, biar tombol ilang)
export async function editMessageCaption(messageId, newCaption, bot = "order") {
  const res = await fetch(`${apiUrl(bot)}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId(bot),
      message_id: messageId,
      caption: newCaption,
      parse_mode: "HTML",
    }),
  });
  return res.json();
}

// Jawab callback query (biar tombol berhenti "loading" di sisi Telegram)
export async function answerCallbackQuery(callbackQueryId, text, bot = "order") {
  const res = await fetch(`${apiUrl(bot)}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  return res.json();
}

// Kirim foto + caption doang, tanpa tombol (dipakai buat struk pembayaran)
export async function sendPhoto(photoUrl, caption, bot = "order") {
  const res = await fetch(`${apiUrl(bot)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId(bot),
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
    }),
  });
  return res.json();
}

export async function sendMessage(text, bot = "order") {
  const res = await fetch(`${apiUrl(bot)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId(bot),
      text,
      parse_mode: "HTML",
    }),
  });
  return res.json();
}
