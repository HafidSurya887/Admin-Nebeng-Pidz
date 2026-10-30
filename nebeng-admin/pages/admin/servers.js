import { useEffect, useMemo, useState } from "react";
import { collection, doc, updateDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import { sortServers } from "../../lib/serverOrder";
import { isScheduled, toLocalInput, fromLocalInput, formatTayang } from "../../lib/serverSchedule";
import AdminLayout from "../../components/AdminLayout";
import {
  ArrowDownIcon, ArrowUpIcon, CloseIcon, PencilIcon, PlusIcon, RefreshIcon, TrashIcon,
} from "../../components/Icons";

const emptyForm = {
  nama: "", harga: "", max_user: "", kapasitas_gb: "", sisaValue: "", sisaUnit: "GB",
  email_dataimpulse: "", password_dataimpulse: "", secret_key_2fa: "",
  jadwal: false, tayang_local: "", // jadwal tayang (opsional)
};

function formatStorage(gb) {
  const n = Number(gb || 0);
  if (n < 1) return `${Math.round(n * 1024)} MB`;
  return `${Number(n.toFixed(2))} GB`;
}

const inputCls =
  "w-full bg-white border border-cardBorder rounded-lg px-3 py-2 text-base sm:text-sm text-[#0d1526] focus:border-accentBlue focus:ring-2 focus:ring-blue-100 focus:outline-none";

export default function AdminServers() {
  const { checking } = useAdminGuard();
  const [servers, setServers] = useState([]);
  const [formModal, setFormModal] = useState(null); // { mode: "add" } | { mode: "edit", server }
  const [editGbModal, setEditGbModal] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Biar badge "Terjadwal" otomatis berubah jadi "Aktif" pas waktunya lewat, tanpa refresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "servers"), (snap) => {
      setServers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const sorted = useMemo(() => sortServers(servers), [servers]);

  // Simpan tambah / edit server
  async function saveServer(form) {
    let tayang_at = null;
    if (form.jadwal) {
      tayang_at = fromLocalInput(form.tayang_local);
      if (!tayang_at) throw new Error("Isi tanggal & jam tayang, atau matikan opsi jadwal.");
    }
    const payload = {
      tayang_at, // null = langsung tayang
      nama: form.nama.trim(),
      harga: Number(form.harga),
      max_user: Number(form.max_user),
      kapasitas_gb: Number(form.kapasitas_gb),
      sisa_gb: form.sisaUnit === "MB" ? Number(form.sisaValue) / 1024 : Number(form.sisaValue),
      email_dataimpulse: form.email_dataimpulse.trim(),
      password_dataimpulse: form.password_dataimpulse,
      secret_key_2fa: form.secret_key_2fa.trim(),
    };

    if (formModal.mode === "edit") {
      // slot_terisi & status sengaja tidak disentuh
      await updateDoc(doc(db, "servers", formModal.server.id), payload);
    } else {
      const batch = writeBatch(db);
      // Rapikan urutan server lama yang belum punya field urutan, lalu taruh server baru di paling bawah
      sorted.forEach((s, i) => {
        if (s.urutan !== i + 1) batch.update(doc(db, "servers", s.id), { urutan: i + 1 });
      });
      batch.set(doc(collection(db, "servers")), {
        ...payload,
        status: "aktif",
        slot_terisi: 0, // counter buyer paid di server ini, di-update otomatis tiap ada pembayaran
        urutan: sorted.length + 1,
      });
      await batch.commit();
    }
    setFormModal(null);
  }

  // Geser posisi server ke atas / bawah
  async function moveServer(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length || moving) return;
    setMoving(true);
    try {
      const next = [...sorted];
      [next[index], next[target]] = [next[target], next[index]];
      const batch = writeBatch(db);
      next.forEach((s, i) => {
        if (s.urutan !== i + 1) batch.update(doc(db, "servers", s.id), { urutan: i + 1 });
      });
      await batch.commit();
    } catch (err) {
      alert("Gagal mengubah urutan: " + err.message);
    } finally {
      setMoving(false);
    }
  }

  async function tayangkanSekarang(s) {
    if (!confirm(`Tayangkan \"${s.nama}\" sekarang? Jadwalnya akan dibatalkan.`)) return;
    await updateDoc(doc(db, "servers", s.id), { tayang_at: null });
  }

  async function toggleStatus(s) {
    await updateDoc(doc(db, "servers", s.id), {
      status: s.status === "aktif" ? "expired" : "aktif",
    });
  }

  async function hapusServer(s) {
    if (!confirm(`Yakin mau hapus server "${s.nama}"? Aksi ini gak bisa dibatalkan.`)) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/delete-server", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serverId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus server");
    } catch (err) {
      alert(err.message);
    }
  }

  // Simpan harga & nama server ke order lama supaya total pemasukan aman.
  async function amankanPemasukan() {
    if (!confirm("Simpan harga server ke semua order lama? Cukup dijalankan sekali.")) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/backfill-harga", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses");
      alert(`Selesai. ${data.diperbarui} order diamankan.` + (data.orderServerHilang ? `\n${data.orderServerHilang} order berhasil sudah terlanjur kehilangan server, nominalnya nggak bisa dipulihkan otomatis.` : ""));
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveEditGb(newVal) {
    if (!editGbModal) return;
    await updateDoc(doc(db, "servers", editGbModal.id), { sisa_gb: Number(newVal) });
    setEditGbModal(null);
  }

  // Hitung ulang slot_terisi tiap server dari data order "paid" yang sebenarnya.
  async function syncSlots() {
    if (!confirm("Hitung ulang jumlah slot terisi tiap server dari data order asli? Prosesnya beberapa detik.")) return;
    setSyncing(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/sync-server-slots", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal sinkronkan slot");
      alert("Berhasil disinkronkan ulang!");
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (checking) {
    return (
      <AdminLayout title="Server">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  const actions = (
    <>
      <button
        onClick={syncSlots}
        disabled={syncing}
        title="Hitung ulang slot terisi dari data order asli"
        className="px-3 py-2 bg-white hover:bg-[#f7f9fc] border border-cardBorder text-[#344055] rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
      >
        <RefreshIcon size={13} className={syncing ? "animate-spin" : ""} />
        {syncing ? "Sinkron..." : "Sinkron Slot"}
      </button>
      <button
        onClick={amankanPemasukan}
        title="Simpan harga server ke order lama supaya total pemasukan tidak berubah saat server dihapus"
        className="px-3 py-2 bg-white hover:bg-[#f7f9fc] border border-cardBorder text-[#344055] rounded-xl text-xs font-semibold"
      >
        Amankan Pemasukan
      </button>
      <button
        onClick={() => setFormModal({ mode: "add" })}
        className="px-3 py-2 bg-accentBlue hover:bg-accentBlueHover text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
      >
        <PlusIcon size={14} /> Tambah Server
      </button>
    </>
  );

  return (
    <AdminLayout title="Server" subtitle="Atur urutan, edit data, dan kelola kuota proxy server" actions={actions}>
      {sorted.length === 0 ? (
        <div className="bg-white border border-cardBorder rounded-2xl p-8 text-center">
          <p className="text-sm text-[#7c8698]">Belum ada server. Klik &quot;Tambah Server&quot; buat mulai.</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-[#9aa4b7] mb-2.5">Urutan di sini sama dengan urutan yang dilihat pembeli di beranda.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sorted.map((s, i) => {
              const cur = Number(s.slot_terisi || 0);
              const max = Number(s.max_user || 0);
              const full = max > 0 && cur >= max;
              const pct = max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0;
              return (
                <div key={s.id} className="bg-white border border-cardBorder rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-3.5 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        onClick={() => moveServer(i, -1)}
                        disabled={i === 0 || moving}
                        aria-label={`Naikkan ${s.nama}`}
                        className="w-8 h-8 rounded-lg border border-cardBorder text-[#475168] flex items-center justify-center hover:bg-[#f5f7fb] disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUpIcon size={14} />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-[#9aa4b7]">{i + 1}</span>
                      <button
                        onClick={() => moveServer(i, 1)}
                        disabled={i === sorted.length - 1 || moving}
                        aria-label={`Turunkan ${s.nama}`}
                        className="w-8 h-8 rounded-lg border border-cardBorder text-[#475168] flex items-center justify-center hover:bg-[#f5f7fb] disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDownIcon size={14} />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#0d1526] truncate">{s.nama}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                          s.status !== "aktif"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : isScheduled(s, now)
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {s.status !== "aktif" ? "Expired" : isScheduled(s, now) ? "Terjadwal" : "Aktif"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7c8698] font-mono truncate">{s.email_dataimpulse}</p>
                      {s.status === "aktif" && isScheduled(s, now) && (
                        <div className="flex items-center justify-between gap-2 text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1.5">
                          <span>Tayang otomatis: <strong>{formatTayang(s.tayang_at)}</strong></span>
                          <button onClick={() => tayangkanSekarang(s)} className="font-semibold underline underline-offset-2 shrink-0">Tayangkan sekarang</button>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-[#7c8698]">
                        <span>Rp{Number(s.harga || 0).toLocaleString("id-ID")}</span>
                        <span className="font-mono font-semibold text-[#475168]">{formatStorage(s.sisa_gb)} / {s.kapasitas_gb} GB</span>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-[#9aa4b7]">Slot terisi</span>
                          <span className={`font-mono ${full ? "text-rose-600 font-bold" : "text-[#7c8698]"}`}>{cur}/{max}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#eef1f7] overflow-hidden">
                          <div className={`h-full rounded-full ${full ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-accentBlue"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 gap-1.5">
                    <button onClick={() => setFormModal({ mode: "edit", server: s })} className="py-2 px-2 bg-[#eaf0ff] hover:bg-[#dde7ff] text-accentBlue text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors">
                      <PencilIcon size={12} /> Edit
                    </button>
                    <button onClick={() => setEditGbModal(s)} className="py-2 px-2 bg-[#f7f9fc] hover:bg-[#eef1f7] border border-cardBorder text-[#344055] text-[11px] font-semibold rounded-lg transition-colors">
                      Sisa GB
                    </button>
                    <button onClick={() => toggleStatus(s)} className="py-2 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-semibold rounded-lg transition-colors">
                      {s.status === "aktif" ? "Set Expired" : "Pulihkan"}
                    </button>
                    <button onClick={() => hapusServer(s)} className="py-2 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors">
                      <TrashIcon size={12} /> Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {formModal && (
        <ServerFormModal
          mode={formModal.mode}
          server={formModal.server}
          onClose={() => setFormModal(null)}
          onSave={saveServer}
        />
      )}
      {editGbModal && (
        <EditGbModal server={editGbModal} onClose={() => setEditGbModal(null)} onSave={saveEditGb} />
      )}
    </AdminLayout>
  );
}

function ModalShell({ title, onClose, children }) {
  // Di HP: muncul dari bawah & bisa discroll (aman buat landscape). Di layar lebar: di tengah.
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cardBorder shrink-0">
          <h3 className="text-sm font-bold text-[#0d1526]">{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7c8698] hover:bg-[#f5f7fb]">
            <CloseIcon size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-medium text-[#475168] block mb-1">{label}</label>
      {children}
    </div>
  );
}

function ServerFormModal({ mode, server, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    mode === "edit"
      ? {
          nama: server.nama || "",
          harga: server.harga ?? "",
          max_user: server.max_user ?? "",
          kapasitas_gb: server.kapasitas_gb ?? "",
          sisaValue: server.sisa_gb ?? "",
          sisaUnit: "GB",
          email_dataimpulse: server.email_dataimpulse || "",
          password_dataimpulse: server.password_dataimpulse || "",
          secret_key_2fa: server.secret_key_2fa || "",
          jadwal: isScheduled(server),
          tayang_local: isScheduled(server) ? toLocalInput(server.tayang_at) : "",
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
      setSaving(false);
    }
  }

  return (
    <ModalShell title={mode === "edit" ? `Edit ${server.nama}` : "Tambah Server Baru"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col min-h-0">
        <div className="overflow-y-auto px-4 py-4 grid grid-cols-2 gap-3">
          <Field label="Nama Server" className="col-span-2 sm:col-span-1">
            <input required className={inputCls} placeholder="Server 3" value={form.nama} onChange={set("nama")} />
          </Field>
          <Field label="Harga (Rp)" className="col-span-2 sm:col-span-1">
            <input required inputMode="numeric" className={inputCls} placeholder="20000" type="number" value={form.harga} onChange={set("harga")} />
          </Field>
          <Field label="Max User">
            <input required inputMode="numeric" className={inputCls} placeholder="10" type="number" value={form.max_user} onChange={set("max_user")} />
          </Field>
          <Field label="Kapasitas (GB)">
            <input required inputMode="decimal" className={inputCls} placeholder="5" type="number" step="0.01" value={form.kapasitas_gb} onChange={set("kapasitas_gb")} />
          </Field>
          <Field label="Sisa Penyimpanan" className="col-span-2">
            <div className="flex gap-2">
              <input required inputMode="decimal" className={inputCls} placeholder="5.00" type="number" step="0.01" value={form.sisaValue} onChange={set("sisaValue")} />
              <select className={`${inputCls} !w-24`} value={form.sisaUnit} onChange={set("sisaUnit")}>
                <option value="GB">GB</option>
                <option value="MB">MB</option>
              </select>
            </div>
          </Field>
          <Field label="Email Dataimpulse" className="col-span-2">
            <input required className={inputCls} placeholder="impulse-admin3@mail.com" type="email" value={form.email_dataimpulse} onChange={set("email_dataimpulse")} />
          </Field>
          <Field label="Password" className="col-span-2 sm:col-span-1">
            <input required className={inputCls} type="text" value={form.password_dataimpulse} onChange={set("password_dataimpulse")} />
          </Field>
          <Field label="Secret Key 2FA" className="col-span-2 sm:col-span-1">
            <input required className={`${inputCls} font-mono`} placeholder="JBSWY3DPEHPK3PXP" type="text" value={form.secret_key_2fa} onChange={set("secret_key_2fa")} />
          </Field>
          <div className="col-span-2 rounded-xl border border-cardBorder bg-[#f7f9fc] p-3 space-y-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#344055] cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#2563eb]"
                checked={form.jadwal}
                onChange={(e) => setForm({ ...form, jadwal: e.target.checked })}
              />
              Jadwalkan tayang (opsional)
            </label>
            {form.jadwal ? (
              <div className="space-y-1">
                <input
                  required
                  type="datetime-local"
                  className={inputCls}
                  value={form.tayang_local}
                  onChange={set("tayang_local")}
                />
                <p className="text-[10px] text-[#9aa4b7]">
                  Server disembunyikan dari pembeli sampai jam ini, lalu muncul otomatis. Pakai jam HP/laptop kamu.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[#9aa4b7]">Tidak dicentang = server langsung tayang begitu disimpan.</p>
            )}
          </div>
          {mode === "edit" && (
            <p className="col-span-2 text-[10px] text-[#9aa4b7]">
              Jumlah slot terisi dan status server tidak berubah saat edit.
            </p>
          )}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-cardBorder shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#f7f9fc] border border-cardBorder text-[#475168] text-sm font-semibold">
            Batal
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accentBlue hover:bg-accentBlueHover text-white text-sm font-semibold disabled:opacity-60 transition-colors">
            {saving ? "Menyimpan..." : mode === "edit" ? "Simpan Perubahan" : "Simpan Server"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditGbModal({ server, onClose, onSave }) {
  const [val, setVal] = useState(server.sisa_gb);

  return (
    <ModalShell title={`Edit Sisa GB: ${server.nama}`} onClose={onClose}>
      <div className="px-4 py-4 space-y-1.5">
        <label className="block text-[11px] font-medium text-[#475168]">Sisa Kuota Baru (GB)</label>
        <input className={`${inputCls} font-mono`} step="0.01" type="number" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />
        <p className="text-[10px] text-[#9aa4b7]">Kapasitas maksimal: {server.kapasitas_gb} GB</p>
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-cardBorder">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-[#f7f9fc] border border-cardBorder text-[#475168] text-sm font-semibold">Batal</button>
        <button onClick={() => onSave(val)} className="flex-1 py-2.5 rounded-xl bg-accentBlue hover:bg-accentBlueHover text-white text-sm font-semibold transition-colors">Simpan Kuota</button>
      </div>
    </ModalShell>
  );
}
