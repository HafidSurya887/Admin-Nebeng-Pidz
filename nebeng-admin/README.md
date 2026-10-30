# Nebeng Impulse - Web Admin

Web admin terpisah dari web utama. Dua-duanya pakai **Firebase project yang sama**, jadi data (server, user, order, pesan, laporan) otomatis sinkron.

## Isi
- Halaman: `/admin/login`, `/admin/dashboard`, `/admin/servers`, `/admin/users`, `/admin/payments`, `/admin/pembayaran-otomatis`, `/admin/messages`, `/admin/tickets`
- API: `/api/admin/*`

## Tetap di web utama (nggak dipindah)
Webhook Telegram, webhook pembayaran (MacroDroid), cron job, checkout, helper, dan semua halaman buyer.

## Cara deploy
1. Upload folder ini ke repo GitHub baru, import ke Vercel sebagai project baru.
2. Isi Environment Variables sesuai `.env.local.example` (nilai Firebase & service account sama dengan web utama).
3. Firebase Console > Authentication > Settings > **Authorized domains** > tambahkan domain web admin.
4. Di web utama, ENV admin boleh dihapus kalau sudah nggak dipakai (`ADMIN_EMAILS`, dll.) setelah folder admin dihapus dari sana.
5. Di MacroDroid, URL webhook tetap ke **web utama** (`/api/payment/webhook`).

## Lokal
```
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3001
```
