import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { CARD, INPUT, LABEL, BTN_PRIMARY } from "../../lib/adminStyle";
import { AlertIcon, CheckIcon } from "../../components/Icons";

const empty = { qris_string: "", expired_minutes: 10, kode_unik_min: 1, kode_unik_max: 49 };

export default function AdminPembayaranOtomatis() {
  const { checking } = useAdminGuard();
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "settings", "payment"));
      if (snap.exists()) setForm({ ...empty, ...snap.data() });
      setLoading(false);
    })();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "settings", "payment"), {
        qris_string: form.qris_string.trim(),
        expired_minutes: Number(form.expired_minutes),
        kode_unik_min: Number(form.kode_unik_min),
        kode_unik_max: Number(form.kode_unik_max),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (checking || loading) {
    return (
      <AdminLayout title="Pembayaran Otomatis">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  const num = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <AdminLayout title="QRIS Otomatis" subtitle="QRIS dinamis + kode unik, tanpa upload bukti manual">
      <form onSubmit={handleSave} className="space-y-4 max-w-2xl">
        <div className={`${CARD} p-4`}>
          <label className={LABEL}>String QRIS statis (hasil scan QR merchant)</label>
          <textarea
            required
            rows={4}
            className={`${INPUT} font-mono !text-xs sm:!text-xs`}
            placeholder="00020101021126...5802ID...6304XXXX"
            value={form.qris_string}
            onChange={num("qris_string")}
          />
          <p className="text-[11px] text-[#9aa4b7] leading-relaxed mt-2">
            Ini bukan file gambar qris.jpg, tapi teks mentah hasil decode QR statis kamu (diawali &quot;0002...&quot; dan
            diakhiri &quot;6304&quot; + 4 karakter). Scan qris.jpg pakai aplikasi QR reader biasa (bukan e-wallet) untuk
            mendapatkan teks ini, salin semuanya, lalu tempel di sini.
          </p>
        </div>

        <div className={`${CARD} p-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Expired QR (menit)</label>
              <input required type="number" min="1" inputMode="numeric" className={INPUT} value={form.expired_minutes} onChange={num("expired_minutes")} />
            </div>
            <div>
              <label className={LABEL}>Kode unik min (Rp)</label>
              <input required type="number" min="1" inputMode="numeric" className={INPUT} value={form.kode_unik_min} onChange={num("kode_unik_min")} />
            </div>
            <div>
              <label className={LABEL}>Kode unik max (Rp)</label>
              <input required type="number" min="1" inputMode="numeric" className={INPUT} value={form.kode_unik_max} onChange={num("kode_unik_max")} />
            </div>
          </div>
          <p className="text-[11px] text-[#9aa4b7] leading-relaxed mt-3">
            Total tagihan buyer = harga server + angka acak antara min dan max di atas. Dibuat kecil supaya tidak
            mencolok, tapi tetap dipakai untuk mencocokkan pembayaran secara otomatis.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-2.5">
          <AlertIcon size={16} className="text-amber-600 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-800">Jangan lupa di sisi MacroDroid</p>
            <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
              Ubah URL tujuan HTTP POST macro notifikasi ke endpoint webhook baru:
            </p>
            <code className="block mt-1.5 text-[11px] text-amber-900 font-semibold break-all">{(process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://domain-web-utama").replace(/\/$/, "")}/api/payment/webhook</code>
          </div>
        </div>

        <button type="submit" disabled={saving} className={`${BTN_PRIMARY} w-full sm:w-auto sm:px-8 py-2.5 text-sm flex items-center justify-center gap-1.5`}>
          {saving ? "Menyimpan..." : saved ? (<><CheckIcon size={14} /> Tersimpan</>) : "Simpan Pengaturan"}
        </button>
      </form>
    </AdminLayout>
  );
}
