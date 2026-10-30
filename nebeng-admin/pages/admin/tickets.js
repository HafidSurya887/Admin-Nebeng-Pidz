import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { CARD, INPUT, BTN_PRIMARY } from "../../lib/adminStyle";
import { SendIcon } from "../../components/Icons";

function fmt(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminTickets() {
  const { checking } = useAdminGuard();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open"); // "open" | "replied" | "semua"
  const [replyDrafts, setReplyDrafts] = useState({}); // { [ticketId]: text }
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    if (!checking) loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking]);

  async function loadTickets() {
    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/tickets-list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setTickets(data.tickets);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(ticketId) {
    const reply = (replyDrafts[ticketId] || "").trim();
    if (!reply) return;
    setSendingId(ticketId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/tickets-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticketId, reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal kirim balasan");
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: "" }));
      await loadTickets();
    } catch (e) {
      alert(e.message);
    } finally {
      setSendingId(null);
    }
  }

  const filtered = tickets.filter((t) => {
    if (filter === "semua") return true;
    return t.status === filter;
  });
  const openCount = tickets.filter((t) => t.status === "open").length;

  if (checking || loading) {
    return (
      <AdminLayout title="Laporan">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  const tabs = [
    { key: "open", label: `Belum dibalas (${openCount})` },
    { key: "replied", label: "Sudah dibalas" },
    { key: "semua", label: `Semua (${tickets.length})` },
  ];

  return (
    <AdminLayout title="Laporan" subtitle={`${tickets.length} laporan, ${openCount} belum dibalas`}>
      <div className="space-y-4">
        <div className="inline-flex max-w-full overflow-x-auto p-1 bg-white border border-cardBorder rounded-xl gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === t.key ? "bg-accentBlue text-white" : "text-[#7c8698] hover:text-[#344055]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-sm text-[#7c8698]">Nggak ada laporan di sini.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          {filtered.map((t) => (
            <div key={t.id} className={`${CARD} p-4`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0d1526] truncate">{t.buyer_nama}</p>
                  <p className="text-[11px] text-[#9aa4b7] truncate">{t.buyer_email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold shrink-0 ${
                  t.status === "replied" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  {t.status === "replied" ? "Dibalas" : "Belum dibalas"}
                </span>
              </div>

              {t.order_id && <p className="text-[11px] font-mono text-[#7c8698] mb-1.5 break-all">Order: {t.order_id}</p>}
              <p className="text-sm text-[#344055] bg-[#f7f9fc] border border-cardBorder rounded-xl p-3 mb-1.5 whitespace-pre-wrap break-words">{t.message}</p>
              <p className="text-[11px] text-[#9aa4b7] mb-2.5">{fmt(t.created_at)}</p>

              {t.admin_reply && (
                <div className="bg-[#eaf0ff] rounded-xl p-3 mb-2.5">
                  <p className="text-[11px] font-semibold text-accentBlue mb-1">Balasan kamu ({fmt(t.replied_at)})</p>
                  <p className="text-sm text-[#344055] whitespace-pre-wrap break-words">{t.admin_reply}</p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyDrafts[t.id] || ""}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder={t.status === "replied" ? "Balas lagi..." : "Ketik balasan..."}
                  className={INPUT}
                />
                <button
                  onClick={() => handleReply(t.id)}
                  disabled={sendingId === t.id || !(replyDrafts[t.id] || "").trim()}
                  aria-label="Kirim balasan"
                  className={`${BTN_PRIMARY} px-3.5 shrink-0 flex items-center gap-1.5 text-sm`}
                >
                  <SendIcon size={14} /> <span className="hidden sm:inline">{sendingId === t.id ? "..." : "Kirim"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
