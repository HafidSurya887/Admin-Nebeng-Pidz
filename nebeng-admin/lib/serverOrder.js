// Urutan server dipakai bareng di beranda pembeli & panel admin.
// Prioritas: field `urutan` (diatur admin) -> angka di nama ("Server 7" = 7) -> nama.
export function sortServers(list) {
  const numFromName = (s) => Number((s.nama || "").match(/\d+/)?.[0]) || 0;
  return [...list].sort((a, b) => {
    const ua = a.urutan ?? Infinity;
    const ub = b.urutan ?? Infinity;
    if (ua !== ub) return ua - ub;
    const na = numFromName(a);
    const nb = numFromName(b);
    if (na !== nb) return na - nb;
    return (a.nama || "").localeCompare(b.nama || "");
  });
}
