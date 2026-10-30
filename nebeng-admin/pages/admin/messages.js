import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { sortServers } from "../../lib/serverOrder";
import { CARD, INPUT, LABEL, BTN_PRIMARY } from "../../lib/adminStyle";
import { CheckIcon, SendIcon, TrashIcon } from "../../components/Icons";

export default function AdminMessages() {
  const { checking } = useAdminGuard();
  const [servers, setServers] = useState([]);
  const [targetType, setTargetType] = useState("server");
  const [serverId, setServerId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "servers"));
      const list = sortServers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setServers(list);
      if (list.length > 0) setServerId(list[0].id);
    })();
  }, []);

  useEffect(() => {
    // Tunggu Firebase Auth beneran selesai konfirmasi admin dulu, biar auth.currentUser
    // gak null pas loadHistory dipanggil (race condition penyebab riwayat kosong di awal).
    if (!checking) loadHistory();
  }, [checking]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/messages-list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setHistory(data.messages);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDeleteMessage(id) {
    if (!confirm("Hapus pesan ini? Buyer yang belum baca gak akan lihat pesan ini lagi.")) return;
    setDeletingId(id);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/delete-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pesan");
      setHistory((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeletingId(null);
    }
  }

  function fmt(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function handleSend(e) {
    e.preventDefault();
    setErr("");
    setResult(null);
    if (!message.trim()) {
      setErr("Pesan gak boleh kosong");
      return;
    }
    setSending(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType, serverId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal kirim pesan");
      setResult(data);
      setMessage("");
      loadHistory();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSending(false);
    }
  }

  if (checking) {
    return (
      <AdminLayout title="Kirim Pesan">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Kirim Pesan" subtitle="Broadcast ke buyer, otomatis masuk dashboard & email">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <form onSubmit={handleSend} className={`${CARD} p-4 space-y-3.5 lg:col-span-2 lg:sticky lg:top-6`}>
          <div>
            <label className={LABEL}>Kirim ke</label>
            <select className={INPUT} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="server">Buyer di 1 server tertentu</option>
              <option value="all">Semua buyer (semua server)</option>
            </select>
          </div>

          {targetType === "server" && (
            <div>
              <label className={LABEL}>Pilih server</label>
              <select className={INPUT} value={serverId} onChange={(e) => setServerId(e.target.value)}>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={LABEL}>Isi pesan</label>
            <textarea
              className={`${INPUT} resize-none`}
              rows={5}
              placeholder="Contoh: Jangan lupa matiin proxy-nya kalau udah selesai pakai ya."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {err && <p className="text-xs text-rose-600">{err}</p>}
          {result && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckIcon size={13} /> Terkirim ke {result.sentCount}/{result.totalBuyers} buyer.
            </div>
          )}

          <button type="submit" disabled={sending} className={`${BTN_PRIMARY} w-full py-2.5 text-sm flex items-center justify-center gap-1.5`}>
            <SendIcon size={14} /> {sending ? "Mengirim..." : "Kirim Pesan"}
          </button>
        </form>

        <div className="lg:col-span-3">
          <h3 className="text-sm font-bold text-[#0d1526] mb-2.5">Riwayat pesan terkirim</h3>

          {historyLoading && <p className="text-xs text-[#9aa4b7]">Memuat...</p>}

          {!historyLoading && history.length === 0 && (
            <div className={`${CARD} p-6 text-center`}>
              <p className="text-sm text-[#7c8698]">Belum ada pesan yang pernah dikirim.</p>
            </div>
          )}

          <div className="space-y-2.5">
            {history.map((m) => (
              <div key={m.id} className={`${CARD} p-3.5`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 truncate">
                    {m.target_type === "all" ? "Semua buyer" : m.server_nama || "Server"}
                  </span>
                  <button
                    onClick={() => handleDeleteMessage(m.id)}
                    disabled={deletingId === m.id}
                    aria-label="Hapus pesan"
                    className="text-[11px] px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200 font-semibold hover:bg-rose-100 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1"
                  >
                    <TrashIcon size={11} /> {deletingId === m.id ? "..." : "Hapus"}
                  </button>
                </div>
                <p className="text-sm text-[#344055] leading-relaxed whitespace-pre-wrap break-words">{m.message}</p>
                <p className="text-[11px] text-[#9aa4b7] mt-2">{fmt(m.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
