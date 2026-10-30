// Gaya bersama halaman admin supaya semuanya seragam.
export const CARD = "bg-white border border-cardBorder rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
export const INPUT =
  "w-full bg-white border border-cardBorder rounded-lg px-3 py-2 text-base sm:text-sm text-[#0d1526] placeholder:text-[#9aa4b7] focus:border-accentBlue focus:ring-2 focus:ring-blue-100 focus:outline-none";
export const LABEL = "block text-xs font-semibold text-[#344055] mb-1.5";
export const BTN_PRIMARY =
  "bg-accentBlue hover:bg-accentBlueHover text-white font-semibold rounded-xl transition-colors disabled:opacity-60";

export const ORDER_STATUS = {
  paid: { label: "Berhasil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  menunggu_konfirmasi: { label: "Menunggu konfirmasi", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  menunggu_pembayaran: { label: "Menunggu bayar", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  rejected: { label: "Ditolak", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  kadaluarsa: { label: "Kadaluarsa", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  gagal_kapasitas_penuh: { label: "Slot penuh", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};
export function orderStatus(status) {
  return ORDER_STATUS[status] || { label: status || "-", cls: "bg-slate-50 text-slate-600 border-slate-200" };
}
