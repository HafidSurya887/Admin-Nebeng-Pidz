// Jadwal tayang server (opsional).
// Field `tayang_at` (string ISO / UTC) di dokumen server:
//   - kosong  -> langsung tayang begitu status "aktif" (perilaku lama)
//   - isi     -> baru terlihat & bisa dibeli setelah waktu itu lewat
// Dicek saat data dibaca, jadi gak butuh cron: begitu waktunya lewat, server otomatis muncul.

export function tayangTime(server) {
  if (!server?.tayang_at) return null;
  const t = Date.parse(server.tayang_at);
  return Number.isNaN(t) ? null : t;
}

// Masih terjadwal (belum waktunya tayang)?
export function isScheduled(server, now = Date.now()) {
  const t = tayangTime(server);
  return t !== null && t > now;
}

// Boleh dilihat & dibeli pembeli?
export function isLive(server, now = Date.now()) {
  return server?.status === "aktif" && !isScheduled(server, now);
}

// ISO (UTC) -> value buat <input type="datetime-local"> (jam lokal browser)
export function toLocalInput(iso) {
  const t = Date.parse(iso || "");
  if (Number.isNaN(t)) return "";
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

// value <input type="datetime-local"> (jam lokal browser) -> ISO (UTC)
export function fromLocalInput(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function formatTayang(iso) {
  const t = Date.parse(iso || "");
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
