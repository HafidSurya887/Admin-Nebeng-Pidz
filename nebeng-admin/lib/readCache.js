import { getDocs } from "firebase/firestore";

// Cache hasil getDocs di sessionStorage (per tab) biar buka-tutup halaman admin
// gak narik ulang seluruh koleksi dari Firestore. Tambah ?fresh=1 di URL buat paksa ambil baru.
function wrap(rows) {
  return {
    docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
    size: rows.length,
    empty: rows.length === 0,
  };
}

export async function cachedGetDocs(key, collRef, ttlMs = 3 * 60 * 1000) {
  const k = `rc_${key}`;
  try {
    const forceFresh = /[?&]fresh=1/.test(window.location.search);
    if (!forceFresh) {
      const raw = sessionStorage.getItem(k);
      if (raw) {
        const { t, rows } = JSON.parse(raw);
        if (Date.now() - t < ttlMs) return wrap(rows);
      }
    }
  } catch {}

  const snap = await getDocs(collRef);
  const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  try {
    sessionStorage.setItem(k, JSON.stringify({ t: Date.now(), rows }));
  } catch {}
  return wrap(rows);
}
