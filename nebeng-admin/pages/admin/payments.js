import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { collection } from "firebase/firestore";
import { cachedGetDocs } from "../../lib/readCache";
import { db } from "../../lib/firebase";
import { useAdminGuard } from "../../lib/adminAuth";
import AdminLayout from "../../components/AdminLayout";
import { CARD, orderStatus } from "../../lib/adminStyle";
import { WalletIcon } from "../../components/Icons";

export default function AdminPayments() {
  const { checking } = useAdminGuard();
  const router = useRouter();
  const filter = router.query.filter || "success";

  const [orders, setOrders] = useState([]);
  const [buyers, setBuyers] = useState({});
  const [servers, setServers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [ordersSnap, buyersSnap, serversSnap] = await Promise.all([
        cachedGetDocs("orders", collection(db, "orders")),
        cachedGetDocs("buyers", collection(db, "buyers")),
        cachedGetDocs("servers", collection(db, "servers")),
      ]);

      const buyersMap = {};
      buyersSnap.docs.forEach((d) => { buyersMap[d.id] = d.data(); });
      const serversMap = {};
      serversSnap.docs.forEach((d) => { serversMap[d.id] = d.data(); });

      setOrders(ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setBuyers(buyersMap);
      setServers(serversMap);
      setLoading(false);
    })();
  }, []);

  if (checking || loading) {
    return (
      <AdminLayout title="Pembayaran">
        <p className="text-sm text-[#7c8698]">Memuat...</p>
      </AdminLayout>
    );
  }

  const success = orders.filter((o) => o.status === "paid");
  const statusGagalPending = [
    "menunggu_konfirmasi",
    "rejected",
    "menunggu_pembayaran",
    "kadaluarsa",
    "dibatalkan",
    "gagal_kapasitas_penuh",
  ];
  const failed = orders.filter((o) => statusGagalPending.includes(o.status));
  const nominalOf = (o) => Number(o.total_amount || o.harga || servers[o.server_id]?.harga || 0);
  const totalIncome = success.reduce((sum, o) => sum + nominalOf(o), 0);

  let title = "Pembayaran";
  let list = success;
  if (filter === "failed") list = failed;
  const byNewest = (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
  list = [...list].sort(byNewest);

  const tabs = [
    { key: "success", label: `Berhasil (${success.length})` },
    { key: "failed", label: `Gagal/Pending (${failed.length})` },
    { key: "income", label: "Pemasukan" },
  ];
  const fmtDate = (iso) =>
    iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <AdminLayout title={title} subtitle="Riwayat verifikasi pembayaran buyer">
      <div className="space-y-4">
        <div className="inline-flex max-w-full overflow-x-auto p-1 bg-white border border-cardBorder rounded-xl gap-1">
          {tabs.map((t) => (
            <a
              key={t.key}
              href={`/admin/payments?filter=${t.key}`}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === t.key ? "bg-accentBlue text-white" : "text-[#7c8698] hover:text-[#344055]"
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {filter === "income" && (
          <div className={`${CARD} p-4`}>
            <div className="flex items-center gap-1.5 text-xs text-[#7c8698] font-medium"><WalletIcon size={14} /> Total pemasukan</div>
            <p className="text-2xl sm:text-3xl font-bold text-[#0d1526] font-mono tracking-tight mt-1">Rp{totalIncome.toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-[#9aa4b7] mt-0.5">dari {success.length} order berhasil</p>
          </div>
        )}

        {list.length === 0 && (
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-sm text-[#7c8698]">Tidak ada data.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((o) => {
            const buyer = buyers[o.buyer_id];
            const server = servers[o.server_id];
            const st = orderStatus(o.status);
            return (
              <div key={o.id} className={`${CARD} p-3.5 flex items-start justify-between gap-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0d1526] truncate">{buyer?.nama || "(dihapus)"}</p>
                  <p className="text-[11px] text-[#7c8698] truncate">{server?.nama || o.server_nama || "-"}</p>
                  <p className="text-[10px] text-[#9aa4b7] mt-1">{fmtDate(o.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-[#0d1526]">Rp{nominalOf(o).toLocaleString("id-ID")}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                  {o.bukti_pembayaran_url && (
                    <a href={o.bukti_pembayaran_url} target="_blank" rel="noopener noreferrer" className="block mt-1 text-[11px] font-semibold text-accentBlue">
                      Lihat bukti
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
