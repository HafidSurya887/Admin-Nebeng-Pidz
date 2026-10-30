import { useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { cachedGetDocs } from "../../lib/readCache";
import { db } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { sortServers } from "../../lib/serverOrder";
import { AlertIcon, CheckIcon, ChartIcon, CloseIcon, ServerIcon, UsersIcon, WalletIcon } from "../../components/Icons";

const FAIL_STATUSES = ["menunggu_konfirmasi", "rejected", "kadaluarsa", "dibatalkan", "gagal_kapasitas_penuh"];

function csvEscape(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function AdminDashboard() {
  const { checking } = useAdminGuard();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [exportRows, setExportRows] = useState([]);
  const [serverList, setServerList] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    (async () => {
      const [serversSnap, buyersSnap, ordersSnap] = await Promise.all([
        cachedGetDocs("servers", collection(db, "servers")),
        cachedGetDocs("buyers", collection(db, "buyers")),
        cachedGetDocs("orders", collection(db, "orders")),
      ]);

      const servers = serversSnap.docs.map((d) => d.data());
      const serverMap = {};
      serversSnap.docs.forEach((d) => { serverMap[d.id] = { id: d.id, ...d.data() }; });
      const buyerMap = {};
      buyersSnap.docs.forEach((d) => { buyerMap[d.id] = d.data(); });

      const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const serverAktif = servers.filter((s) => s.status === "aktif").length;
      const totalKapasitas = servers.reduce((sum, s) => sum + Number(s.kapasitas_gb || 0), 0);

      const paidOrders = orders.filter((o) => o.status === "paid");
      const failedOrders = orders.filter((o) => FAIL_STATUSES.includes(o.status));

      // Nominal yang beneran dibayar (total_amount buat QRIS otomatis, fallback harga server buat order lama manual)
      const nominalOf = (o) => Number(o.total_amount || o.harga || serverMap[o.server_id]?.harga || 0);
      const income = paidOrders.reduce((sum, o) => sum + nominalOf(o), 0);

      setStats({
        totalServer: servers.length,
        serverAktif,
        totalKapasitas,
        totalUser: buyersSnap.size,
        paidCount: paidOrders.length,
        failedCount: failedOrders.length,
        income,
      });

      const sortedServers = sortServers(Object.values(serverMap));
      setServerList(sortedServers);

      const warn = [];
      const pendingCount = orders.filter((o) => o.status === "menunggu_konfirmasi").length;
      if (pendingCount > 0) warn.push({ text: `${pendingCount} pembayaran menunggu konfirmasi`, href: "/admin/payments" });
      sortedServers.filter((x) => x.status === "aktif").forEach((x) => {
        const cur = Number(x.slot_terisi || 0);
        const max = Number(x.max_user || 0);
        const sisaPct = Number(x.kapasitas_gb) > 0 ? Number(x.sisa_gb || 0) / Number(x.kapasitas_gb) : 1;
        if (max > 0 && cur >= max) warn.push({ text: `${x.nama} slot penuh (${cur}/${max})`, href: "/admin/servers" });
        else if (sisaPct <= 0.1) warn.push({ text: `${x.nama} sisa kuota tinggal ${Math.round(sisaPct * 100)}%`, href: "/admin/servers" });
      });
      setAlerts(warn);

      // Grafik 7 hari terakhir
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("id-ID", { weekday: "short" }), total: 0 });
      }
      const dayMap = Object.fromEntries(days.map((d) => [d.key, d]));
      paidOrders.forEach((o) => {
        if (!o.created_at) return;
        const key = o.created_at.slice(0, 10);
        if (dayMap[key]) dayMap[key].total += nominalOf(o);
      });
      setChartData(days);

      // Data buat export CSV
      const rows = orders
        .slice()
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map((o) => ({
          order_id: o.id,
          buyer_nama: buyerMap[o.buyer_id]?.nama || "-",
          buyer_email: buyerMap[o.buyer_id]?.email || "-",
          server: serverMap[o.server_id]?.nama || o.server_nama || o.server_id || "-",
          nominal: nominalOf(o),
          status: o.status,
          ip_checkout: o.ip_address || "-",
          tanggal: o.created_at || "-",
        }));
      setExportRows(rows);
    })();
  }, []);

  function handleExportCsv() {
    const headers = ["Order ID", "Nama Buyer", "Email Buyer", "Server", "Nominal", "Status", "IP Checkout", "Tanggal"];
    const lines = [headers.join(",")];
    exportRows.forEach((r) => {
      lines.push(
        [r.order_id, r.buyer_nama, r.buyer_email, r.server, r.nominal, r.status, r.ip_checkout, r.tanggal]
          .map(csvEscape)
          .join(",")
      );
    });
    const csvContent = "\uFEFF" + lines.join("\n"); // BOM biar Excel baca UTF-8 dengan bener
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (checking || !stats) {
    return (
      <AdminLayout title="Ringkasan">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  const maxChart = Math.max(1, ...chartData.map((d) => d.total));
  const weekTotal = chartData.reduce((sum, d) => sum + d.total, 0);
  const rupiah = (n) => `Rp${Number(n).toLocaleString("id-ID")}`;

  // Kurva halus buat grafik area (viewBox 100 x 40)
  const pts = chartData.map((d, i) => ({
    x: chartData.length > 1 ? (i / (chartData.length - 1)) * 100 : 50,
    y: 34 - (d.total / maxChart) * 28,
  }));
  const linePath = pts.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x},${p.y}`;
    const prev = pts[i - 1];
    const mx = (prev.x + p.x) / 2;
    return `${acc} C${mx},${prev.y} ${mx},${p.y} ${p.x},${p.y}`;
  }, "");
  const areaPath = pts.length ? `${linePath} L100,40 L0,40 Z` : "";

  const statCards = [
    { label: "Total Server", value: stats.totalServer, sub: `${stats.serverAktif} aktif, ${stats.totalKapasitas} GB`, icon: ServerIcon, tone: "bg-blue-50 text-blue-600" },
    { label: "Total User", value: stats.totalUser, sub: `${stats.paidCount} sudah bayar`, icon: UsersIcon, tone: "bg-indigo-50 text-indigo-600" },
    { label: "Bayar Berhasil", value: stats.paidCount, sub: "QRIS terverifikasi", icon: CheckIcon, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Bayar Gagal", value: stats.failedCount, sub: "Expired, batal, ditolak", icon: CloseIcon, tone: "bg-rose-50 text-rose-600" },
  ];

  const STATUS = {
    paid: { label: "Berhasil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    menunggu_konfirmasi: { label: "Menunggu", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    rejected: { label: "Ditolak", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    kadaluarsa: { label: "Kadaluarsa", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    dibatalkan: { label: "Dibatalkan", cls: "bg-rose-50 text-rose-700 border-rose-200" },
    gagal_kapasitas_penuh: { label: "Slot penuh", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const card = "bg-white border border-cardBorder rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

  const exportButton = (
    <button
      onClick={handleExportCsv}
      className="px-3 py-2 bg-white hover:bg-[#f7f9fc] border border-cardBorder rounded-xl text-xs font-semibold text-[#344055] flex items-center gap-1.5 transition-colors"
    >
      <ChartIcon size={14} /> Export CSV ({exportRows.length})
    </button>
  );

  return (
    <AdminLayout title="Ringkasan" subtitle="Statistik ringkas seluruh sistem" actions={exportButton}>
      <div className="space-y-4">
        {/* Kartu statistik */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className={`${card} p-3.5`}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.tone}`}><Icon size={16} /></span>
                  <span className="text-[11px] sm:text-xs text-[#7c8698] font-medium leading-tight">{c.label}</span>
                </div>
                <p className="text-2xl font-bold text-[#0d1526] font-mono tracking-tight">{c.value}</p>
                <p className="text-[10px] sm:text-[11px] text-[#9aa4b7] mt-0.5 truncate">{c.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Pendapatan + peringatan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className={`${card} p-4 lg:col-span-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#7c8698] font-medium"><WalletIcon size={14} /> Total Pemasukan</div>
                <p className="text-2xl sm:text-3xl font-bold text-[#0d1526] font-mono tracking-tight mt-1">{rupiah(stats.income)}</p>
                <p className="text-[11px] text-[#9aa4b7] mt-0.5">{stats.paidCount} transaksi berhasil</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#9aa4b7] uppercase tracking-wider font-semibold">7 hari terakhir</p>
                <p className="text-sm font-bold text-accentBlue font-mono">{rupiah(weekTotal)}</p>
              </div>
            </div>
            <div className="mt-4">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-28 sm:h-36" role="img" aria-label="Grafik pendapatan 7 hari terakhir">
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b6dfa" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#3b6dfa" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[10, 22, 34].map((y) => (
                  <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#eef1f7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                <path d={areaPath} fill="url(#areaFill)" />
                <path d={linePath} fill="none" stroke="#3b6dfa" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="flex justify-between mt-1.5">
                {chartData.map((d) => (
                  <div key={d.key} className="flex-1 text-center" title={rupiah(d.total)}>
                    <p className="text-[10px] text-[#9aa4b7] font-semibold capitalize">{d.label}</p>
                    <p className="text-[9px] text-[#7c8698] font-mono h-3">{d.total > 0 ? `${Math.round(d.total / 1000)}k` : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${card} p-4`}>
            <h4 className="text-sm font-bold text-[#0d1526] mb-3">Perlu Perhatian</h4>
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                <CheckIcon size={14} /> Semua aman, tidak ada yang perlu dicek.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <a key={i} href={a.href} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl px-3 py-2.5 transition-colors">
                    <AlertIcon size={14} className="mt-px text-amber-600" />
                    <span>{a.text}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pemakaian server + order terbaru */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className={`${card} p-4 lg:col-span-2`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#0d1526]">Pemakaian Server</h4>
              <a href="/admin/servers" className="text-[11px] font-semibold text-accentBlue">Kelola</a>
            </div>
            {serverList.length === 0 ? (
              <p className="text-xs text-[#9aa4b7]">Belum ada server.</p>
            ) : (
              <div className="space-y-3.5">
                {serverList.map((x) => {
                  const cur = Number(x.slot_terisi || 0);
                  const max = Number(x.max_user || 0);
                  const pct = max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0;
                  const bar = pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-accentBlue";
                  return (
                    <div key={x.id}>
                      <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                        <span className={`font-semibold truncate ${x.status === "aktif" ? "text-[#0d1526]" : "text-[#9aa4b7]"}`}>
                          {x.nama}{x.status !== "aktif" && " (expired)"}
                        </span>
                        <span className="font-mono text-[#7c8698] shrink-0">{cur}/{max} slot</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#eef1f7] overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${card} p-4 lg:col-span-3`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#0d1526]">Order Terbaru</h4>
              <a href="/admin/payments" className="text-[11px] font-semibold text-accentBlue">Lihat semua</a>
            </div>
            {exportRows.length === 0 ? (
              <p className="text-xs text-[#9aa4b7]">Belum ada order.</p>
            ) : (
              <div className="divide-y divide-cardBorder">
                {exportRows.slice(0, 6).map((r) => {
                  const st = STATUS[r.status] || { label: r.status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
                  return (
                    <div key={r.order_id} className="py-2.5 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#0d1526] truncate">{r.buyer_nama}</p>
                        <p className="text-[11px] text-[#9aa4b7] truncate">
                          {r.server} · {r.tanggal !== "-" ? new Date(r.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-[#0d1526] font-mono">{rupiah(r.nominal)}</p>
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
