import nodemailer from "nodemailer";

// Butuh GMAIL_USER (email gmail kamu) dan GMAIL_APP_PASSWORD (App Password, BUKAN password biasa)
// Cara bikin App Password: myaccount.google.com/apppasswords (harus aktifin 2FA dulu di akun Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD belum diset, email tidak dikirim.");
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Nebeng Impulse Pidz" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("Gagal kirim email:", err);
  }
}
