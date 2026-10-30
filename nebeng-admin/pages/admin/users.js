import { useEffect, useState, useMemo, useRef } from "react";
import {
  collection, getDocs, getDoc, doc, query, where, orderBy, limit, startAfter, documentId,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { sortServers } from "../../lib/serverOrder";
import { CARD, INPUT } from "../../lib/adminStyle";
import { AlertIcon, CheckIcon, ChevronDownIcon, CloseIcon, FlagIcon, SearchIcon, TrashIcon } from "../../components/Icons";

const STATUS_LABEL = {
  paid: { label: "Berhasil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  menunggu_pembayaran: { label: "Menunggu Bayar", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  menunggu_konfirmasi: { label: "Menunggu Konfirmasi", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  kadaluarsa: { label: "Kadaluarsa", cls: "bg-slate-100 text-[#5b6472] border-slate-300" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-slate-100 text-[#5b6472] border-slate-300" },
  gagal_kapasitas_penuh: { label: "Kapasitas Penuh", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  rejected: { label: "Ditolak", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

// Status yang perlu dipantau buat badge "nyangkut" - query ini kecil (cuma order yang
// statusnya lagi ini), bukan narik SELURUH koleksi orders kayak sebelumnya.
const STUCK_QUERY_STATUSES = ["gagal_kapasitas_penuh", "menunggu_konfirmasi", "menunggu_pembayaran"];
const STUCK_STATUSES = ["gagal_kapasitas_penuh", "menunggu_konfirmasi"];
const PAGE_SIZE = 30;

function fmt(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isStuckOrder(o) {
  if (STUCK_STATUSES.includes(o.status)) return true;
  if (o.status === "menunggu_pembayaran" && o.expires_at && new Date(o.expires_at).getTime() < Date.now()) return true;
  return false;
}

// Firestore 'in' cuma boleh max 30 value per query, jadi kalau butuh ambil buyer
// berdasarkan banyak ID sekaligus (misal hasil filter server/nyangkut), dipecah per 10.
async function fetchBuyersByIds(ids) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  const snaps = await Promise.all(
    chunks.map((c) => getDocs(query(collection(db, "buyers"), where(documentId(), "in", c))))
  );
  return snaps.flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export default function AdminUsers() {
  const { checking } = useAdminGuard();

  // --- Browse mode: buyer terbaru, dipaginasi (bukan narik semua sekaligus) ---
  const [browseBuyers, setBrowseBuyers] = useState([]);
  const [browseLastDoc, setBrowseLastDoc] = useState(null);
  const [browseHasMore, setBrowseHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // --- Search mode: query langsung ke Firestore (nama/email prefix + order ID exact) ---
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = bukan lagi nyari
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  // --- Filter mode: buyer nyangkut / buyer per-server, diambil pakai query kecil & spesifik ---
  const [activeFilter, setActiveFilter] = useState(null); // {type:'stuck'|'server', id, label}
  const [filterResults, setFilterResults] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);

  const [servers, setServers] = useState([]);
  const [stuckOrders, setStuckOrders] = useState([]); // cuma order dgn status "rawan nyangkut", bukan semua order
  const [loading, setLoading] = useState(true);

  // --- Detail order per-buyer: baru di-fetch pas buyer-nya di-expand ---
  const [expandedBuyer, setExpandedBuyer] = useState(null);
  const [ordersByBuyer, setOrdersByBuyer] = useState({});
  const [loadingOrdersFor, setLoadingOrdersFor] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [reviewingOrder, setReviewingOrder] = useState(null); // order id yang lagi kebuka pilihan Aman/Curang
  const [savingReview, setSavingReview] = useState(null);
  const [approving, setApproving] = useState(null);
  const [pickServerFor, setPickServerFor] = useState(null);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInitial() {
    setLoading(true);
    const [serversSnap, stuckSnap, buyersSnap] = await Promise.all([
      getDocs(collection(db, "servers")), // koleksi kecil (belasan/puluhan), aman diambil semua
      getDocs(query(collection(db, "orders"), where("status", "in", STUCK_QUERY_STATUSES))),
      getDocs(query(collection(db, "buyers"), orderBy("created_at", "desc"), limit(PAGE_SIZE))),
    ]);
    setServers(sortServers(serversSnap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    setStuckOrders(stuckSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    const docs = buyersSnap.docs;
    setBrowseBuyers(docs.map((d) => ({ id: d.id, ...d.data() })));
    setBrowseLastDoc(docs[docs.length - 1] || null);
    setBrowseHasMore(docs.length === PAGE_SIZE);
    setLoading(false);
  }

  async function loadMoreBuyers() {
    if (!browseLastDoc || loadingMore) return;
    setLoadingMore(true);
    const snap = await getDocs(
      query(collection(db, "buyers"), orderBy("created_at", "desc"), startAfter(browseLastDoc), limit(PAGE_SIZE))
    );
    const docs = snap.docs;
    setBrowseBuyers((prev) => [...prev, ...docs.map((d) => ({ id: d.id, ...d.data() }))]);
    if (docs.length > 0) setBrowseLastDoc(docs[docs.length - 1]);
    setBrowseHasMore(docs.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  async function reloadStuckOrders() {
    const snap = await getDocs(query(collection(db, "orders"), where("status", "in", STUCK_QUERY_STATUSES)));
    setStuckOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  // Ketik di kolom cari -> debounce 400ms -> query Firestore langsung (bukan filter
  // dari data yang udah ke-load). Support: order ID exact, prefix nama, prefix email.
  function handleSearchChange(value) {
    setSearch(value);
    setActiveFilter(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = value.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    searchTimer.current = setTimeout(() => runSearch(q), 400);
  }

  async function runSearch(q) {
    setSearching(true);
    try {
      const found = new Map();

      // Coba cocokin sebagai Order ID persis dulu (1 doc read doang, murah).
      try {
        const orderSnap = await getDoc(doc(db, "orders", q));
        if (orderSnap.exists()) {
          const buyerId = orderSnap.data().buyer_id;
          const buyerSnap = await getDoc(doc(db, "buyers", buyerId));
          if (buyerSnap.exists()) found.set(buyerSnap.id, { id: buyerSnap.id, ...buyerSnap.data() });
        }
      } catch {
        // bukan valid doc id, skip aja
      }

      const [byNama, byEmail] = await Promise.all([
        getDocs(query(collection(db, "buyers"), where("nama", ">=", q), where("nama", "<=", q + "\uf8ff"), limit(20))),
        getDocs(query(collection(db, "buyers"), where("email", ">=", q), where("email", "<=", q + "\uf8ff"), limit(20))),
      ]);
      byNama.docs.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));
      byEmail.docs.forEach((d) => found.set(d.id, { id: d.id, ...d.data() }));

      setSearchResults(Array.from(found.values()));
    } finally {
      setSearching(false);
    }
  }

  // Filter "buyer nyangkut" - buyer_id-nya udah ada di stuckOrders (query kecil di atas),
  // tinggal fetch buyer-nya spesifik itu aja, bukan semua buyer.
  async function showStuckBuyers() {
    setSearch("");
    setSearchResults(null);
    setActiveFilter({ type: "stuck", label: "Nyangkut" });
    setFilterLoading(true);
    const ids = stuckOrders.filter(isStuckOrder).map((o) => o.buyer_id);
    setFilterResults(await fetchBuyersByIds(ids));
    setFilterLoading(false);
  }

  // Filter per-server: query order "paid" di server itu doang buat dapetin buyer_id-nya,
  // baru fetch buyer-nya. Jauh lebih hemat drpd narik semua order.
  async function showServerBuyers(server) {
    setSearch("");
    setSearchResults(null);
    setActiveFilter({ type: "server", id: server.id, label: server.nama });
    setFilterLoading(true);
    const snap = await getDocs(
      query(collection(db, "orders"), where("server_id", "==", server.id), where("status", "==", "paid"))
    );
    const ids = snap.docs.map((d) => d.data().buyer_id);
    setFilterResults(await fetchBuyersByIds(ids));
    setFilterLoading(false);
  }

  function clearFilter() {
    setActiveFilter(null);
    setFilterResults([]);
  }

  async function loadOrdersForBuyer(buyerId, force = false) {
    if (!force && ordersByBuyer[buyerId]) return;
    setLoadingOrdersFor(buyerId);
    const snap = await getDocs(query(collection(db, "orders"), where("buyer_id", "==", buyerId)));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setOrdersByBuyer((prev) => ({ ...prev, [buyerId]: list }));
    setLoadingOrdersFor(null);
  }

  function toggleExpand(buyerId) {
    const opening = expandedBuyer !== buyerId;
    setExpandedBuyer(opening ? buyerId : null);
    if (opening) loadOrdersForBuyer(buyerId);
  }

  function removeBuyerFromLists(buyerId) {
    setBrowseBuyers((prev) => prev.filter((b) => b.id !== buyerId));
    setSearchResults((prev) => (prev ? prev.filter((b) => b.id !== buyerId) : prev));
    setFilterResults((prev) => prev.filter((b) => b.id !== buyerId));
    setOrdersByBuyer((prev) => {
      const next = { ...prev };
      delete next[buyerId];
      return next;
    });
  }

  async function handleDeleteBuyer(buyerId, nama) {
    if (!confirm(`Hapus buyer "${nama || buyerId}" beserta semua order-nya? Aksi ini tidak bisa dibatalkan.`)) return;
    setDeletingId(buyerId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/delete-buyer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ buyerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus buyer");
      removeBuyerFromLists(buyerId);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReviewOrder(orderId, buyerId, status) {
    setSavingReview(orderId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/review-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal update status");
      setOrdersByBuyer((prev) => ({
        ...prev,
        [buyerId]: (prev[buyerId] || []).map((o) => (o.id === orderId ? { ...o, review_status: data.status || undefined } : o)),
      }));
      setReviewingOrder(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingReview(null);
    }
  }

  async function handleDeleteOrder(orderId, buyerId) {
    if (!confirm(`Hapus order "${orderId}"? Kalau order ini statusnya "paid", slot server-nya bakal ke-kurangin 1. Aksi ini gak bisa dibatalkan.`)) return;
    setDeletingOrder(orderId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/delete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus order");
      setOrdersByBuyer((prev) => ({ ...prev, [buyerId]: (prev[buyerId] || []).filter((o) => o.id !== orderId) }));
      await reloadStuckOrders();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingOrder(null);
    }
  }

  async function handleManualApprove(orderId, buyerId, targetServerId) {
    setApproving(orderId);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/admin/manual-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId, targetServerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal approve order");
      setPickServerFor(null);
      await Promise.all([loadOrdersForBuyer(buyerId, true), reloadStuckOrders()]);
      if (activeFilter?.type === "stuck") showStuckBuyers();
      alert("Order berhasil di-ACC manual!");
    } catch (err) {
      alert(err.message);
    } finally {
      setApproving(null);
    }
  }

  const stuckCountByBuyer = useMemo(() => {
    const map = {};
    stuckOrders.forEach((o) => {
      if (isStuckOrder(o)) map[o.buyer_id] = (map[o.buyer_id] || 0) + 1;
    });
    return map;
  }, [stuckOrders]);

  const totalStuck = useMemo(() => Object.values(stuckCountByBuyer).reduce((a, b) => a + b, 0), [stuckCountByBuyer]);

  const displayedBuyers = search.trim() ? searchResults || [] : activeFilter ? filterResults : browseBuyers;
  const isFilteredView = Boolean(search.trim()) || Boolean(activeFilter);
  const busy = search.trim() ? searching : activeFilter ? filterLoading : false;

  if (checking || loading) {
    return (
      <AdminLayout title="Semua User">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Semua User" subtitle={`${totalStuck > 0 ? `${totalStuck} order butuh perhatian` : "Semua order aman"}`}>
      <div className="space-y-3">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5 md:flex-wrap md:overflow-visible"
          style={{ scrollbarWidth: "thin", scrollSnapType: "x proximity" }}
        >
          <button
            onClick={clearFilter}
            style={{ scrollSnapAlign: "start" }}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
              !activeFilter ? "bg-accentBlue text-white border-accentBlue" : "bg-white text-[#7c8698] border-cardBorder hover:text-[#344055]"
            }`}
          >
            Terbaru
          </button>
          {totalStuck > 0 && (
            <button
              onClick={showStuckBuyers}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                activeFilter?.type === "stuck"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              <AlertIcon size={12} className="inline mr-1.5 -mt-0.5" /> Nyangkut ({totalStuck})
            </button>
          )}
          {servers.map((s) => (
            <button
              key={s.id}
              onClick={() => showServerBuyers(s)}
              style={{ scrollSnapAlign: "start" }}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                activeFilter?.type === "server" && activeFilter.id === s.id
                  ? "bg-accentBlue text-white border-accentBlue"
                  : "bg-white text-[#7c8698] border-cardBorder hover:text-[#344055]"
              }`}
            >
              {s.nama}
            </button>
          ))}
        </div>

        {activeFilter && (
          <p className="text-[11px] text-[#7c8698] px-0.5">
            Menampilkan buyer <span className="font-bold text-[#344055]">{activeFilter.label}</span> — {filterResults.length} buyer
          </p>
        )}

        <div className="relative">
          <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa4b7]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cari nama, email, atau Order ID..."
            className={`${INPUT} !pl-9 !py-2.5 !rounded-xl`}
          />
        </div>
        {search.trim() && (
          <p className="text-[10px] text-[#9aa4b7] px-0.5">
            Pencarian cocok di awal nama/email (case-sensitive) — kalau gak ketemu, coba ketik persis sesuai kapitalisasinya.
          </p>
        )}

        {totalStuck > 0 && !activeFilter && !search.trim() && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-[11px] text-rose-700">
            <AlertIcon size={13} className="inline mr-1.5 -mt-0.5" /> Ada <strong>{totalStuck}</strong> order nyangkut (kapasitas penuh / menunggu konfirmasi / expired belum ke-update).
            Klik chip <strong>"Nyangkut"</strong> di atas buat lihat buyer-nya.
          </div>
        )}

        {busy && (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-sm text-[#7c8698]">Mencari...</p>
          </div>
        )}

        {!busy && displayedBuyers.length === 0 && (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-sm text-[#7c8698]">Nggak ada buyer yang cocok.</p>
          </div>
        )}

        {!busy && displayedBuyers.length > 0 && (
          <p className="text-[10px] text-[#9aa4b7] px-0.5">Klik nama buyer buat lihat detail order-nya.</p>
        )}

        <div className="space-y-2.5">
          {!busy &&
            displayedBuyers.map((b) => {
              const isOpen = expandedBuyer === b.id;
              const myOrders = ordersByBuyer[b.id];
              const isLoadingOrders = loadingOrdersFor === b.id;
              const stuckCount = stuckCountByBuyer[b.id] || 0;

              return (
                <div key={b.id} className={`${CARD} overflow-hidden`}>
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="w-full flex items-center justify-between gap-2 p-3.5 text-left hover:bg-[#fafbfd] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-[#0d1526] truncate">{b.nama || "(tanpa nama)"}</p>
                        {stuckCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold shrink-0">
                            {stuckCount} nyangkut
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#7c8698] truncate">{b.email}</p>
                      {myOrders && (
                        <p className="text-[10px] text-[#9aa4b7] mt-0.5">
                          {myOrders.length} order · {myOrders.filter((o) => o.status === "paid").length} berhasil
                        </p>
                      )}
                    </div>
                    <span className={`text-[#7c8698] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}><ChevronDownIcon size={14} /></span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-cardBorder p-3.5 space-y-2.5 bg-[#fafbfd]">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDeleteBuyer(b.id, b.nama)}
                          disabled={deletingId === b.id}
                          className="text-[11px] px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-semibold hover:bg-rose-100 transition disabled:opacity-50"
                        >
                          {deletingId === b.id ? "Menghapus..." : <><TrashIcon size={13} className="inline mr-1.5 -mt-0.5" />Hapus Buyer Ini</>}
                        </button>
                      </div>

                      {isLoadingOrders && <p className="text-[11px] text-[#9aa4b7] text-center py-3">Memuat order...</p>}

                      {!isLoadingOrders && myOrders?.length === 0 && (
                        <p className="text-[11px] text-[#9aa4b7] text-center py-3">Belum pernah order.</p>
                      )}

                      {!isLoadingOrders &&
                        myOrders?.map((o) => {
                          const meta = STATUS_LABEL[o.status] || { label: o.status, cls: "bg-slate-100 text-[#5b6472] border-slate-300" };
                          const stuck = isStuckOrder(o);
                          const cardCls =
                            o.review_status === "curang"
                              ? "border-red-400 bg-red-50"
                              : stuck
                              ? "border-rose-300 bg-rose-50"
                              : "border-cardBorder bg-[#f7f9fc]";
                          return (
                            <div key={o.id} className={`rounded-lg p-2.5 border ${cardCls}`}>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="font-mono text-[10px] text-[#7c8698] truncate">{o.id}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${meta.cls}`}>{meta.label}</span>
                                  <button
                                    onClick={() => handleDeleteOrder(o.id, b.id)}
                                    disabled={deletingOrder === o.id}
                                    title="Hapus order ini"
                                    className="text-[10px] px-2 py-1 rounded-md bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-50"
                                  >
                                    {deletingOrder === o.id ? "..." : <TrashIcon size={13} />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-[#475168] mb-1.5">
                                <span>{o.server_id ? servers.find((s) => s.id === o.server_id)?.nama || o.server_id : "-"}</span>
                                <span className="font-bold text-[#0d1526]">Rp{Number(o.total_amount || o.harga || 0).toLocaleString("id-ID")}</span>
                              </div>

                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                {o.review_status === "aman" && (
                                  <span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold"><CheckIcon size={11} className="inline mr-1 -mt-0.5" /> Aman</span>
                                )}
                                {o.review_status === "curang" && (
                                  <span className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold"><FlagIcon size={11} className="inline mr-1 -mt-0.5" /> Curang</span>
                                )}
                                {!o.review_status && <span className="text-[11px] text-[#9aa4b7]">Belum dicek</span>}

                                {reviewingOrder !== o.id ? (
                                  <button
                                    onClick={() => setReviewingOrder(o.id)}
                                    className="text-[11px] px-3 py-1.5 rounded-lg bg-white border border-cardBorder text-[#475168] font-semibold hover:border-blue-400 transition"
                                  >
                                    <SearchIcon size={11} className="inline mr-1 -mt-0.5" /> Cek
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleReviewOrder(o.id, b.id, "aman")}
                                      disabled={savingReview === o.id}
                                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
                                    >
                                      <CheckIcon size={11} className="inline mr-1 -mt-0.5" /> Aman
                                    </button>
                                    <button
                                      onClick={() => handleReviewOrder(o.id, b.id, "curang")}
                                      disabled={savingReview === o.id}
                                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-300 font-semibold hover:bg-red-100 transition disabled:opacity-50"
                                    >
                                      <FlagIcon size={11} className="inline mr-1 -mt-0.5" /> Curang
                                    </button>
                                    {o.review_status && (
                                      <button
                                        onClick={() => handleReviewOrder(o.id, b.id, null)}
                                        disabled={savingReview === o.id}
                                        title="Hapus tanda"
                                        className="text-[11px] px-1.5 py-1 rounded-lg bg-white border border-cardBorder text-[#9aa4b7] hover:text-[#475168] transition disabled:opacity-50"
                                      >
                                        <CloseIcon size={12} />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setReviewingOrder(null)}
                                      className="text-[11px] px-1.5 py-1 text-[#9aa4b7] hover:text-[#475168]"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-2 text-[11px]">
                                <div className="bg-white rounded p-1.5 border border-cardBorder">
                                  <p className="text-[#9aa4b7] uppercase tracking-wide font-semibold">Checkout</p>
                                  <p className="text-[#344055]">{fmt(o.created_at)}</p>
                                  <p className="font-mono text-[#475168]">{o.ip_address || "-"}</p>
                                </div>
                                <div className="bg-white rounded p-1.5 border border-cardBorder">
                                  <p className="text-[#9aa4b7] uppercase tracking-wide font-semibold">Minta Kode</p>
                                  <p className="text-[#344055]">{o.terakhir_ambil_kode ? fmt(o.terakhir_ambil_kode) : "-"}</p>
                                  <p className="font-mono text-[#475168]">{o.terakhir_ambil_kode_ip || "-"}</p>
                                </div>
                                <div className="bg-white rounded p-1.5 border border-cardBorder">
                                  <p className="text-[#9aa4b7] uppercase tracking-wide font-semibold">Minta Reset</p>
                                  <p className="text-[#344055]">{o.terakhir_minta_reset ? fmt(o.terakhir_minta_reset) : "-"}</p>
                                  <p className="font-mono text-[#475168]">{o.terakhir_minta_reset_ip || "-"}</p>
                                </div>
                              </div>

                              {o.status !== "paid" && (
                                <div className="mt-2.5 pt-2.5 border-t border-cardBorder/40">
                                  {pickServerFor === o.id ? (
                                    <div className="space-y-1.5">
                                      <p className="text-[10px] text-[#475168] font-semibold">Pilih server tujuan:</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {servers.filter((s) => s.status === "aktif").map((s) => (
                                          <button
                                            key={s.id}
                                            onClick={() => handleManualApprove(o.id, b.id, s.id)}
                                            disabled={approving === o.id}
                                            className="text-[11px] px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold transition disabled:opacity-50"
                                          >
                                            {approving === o.id ? "..." : s.nama}
                                          </button>
                                        ))}
                                      </div>
                                      <button onClick={() => setPickServerFor(null)} className="text-[10px] text-[#9aa4b7] hover:text-[#475168]">
                                        Batal
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setPickServerFor(o.id)}
                                      className="w-full py-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 font-semibold text-xs transition"
                                    >
                                      <CheckIcon size={14} className="inline mr-1.5 -mt-0.5" /> ACC Manual Order Ini
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {!isFilteredView && browseHasMore && (
          <button
            onClick={loadMoreBuyers}
            disabled={loadingMore}
            className={`${CARD} w-full py-2.5 text-sm font-semibold text-[#475168] hover:bg-[#fafbfd] transition-colors disabled:opacity-60`}
          >
            {loadingMore ? "Memuat..." : "Muat Buyer Lainnya"}
          </button>
        )}
      </div>
    </AdminLayout>
  );
}
