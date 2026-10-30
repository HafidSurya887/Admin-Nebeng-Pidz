import { useRouter } from "next/router";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {
  BoltIcon, GridIcon, ServerIcon, UsersIcon, WalletIcon,
  QrIcon, MailIcon, FlagIcon, LogoutIcon, ExternalIcon,
} from "./Icons";

const MAIN_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "/";

const navItems = [
  { href: "/admin/dashboard", label: "Ringkasan", icon: GridIcon },
  { href: "/admin/servers", label: "Server", icon: ServerIcon },
  { href: "/admin/users", label: "User", icon: UsersIcon },
  { href: "/admin/payments?filter=success", label: "Pembayaran", icon: WalletIcon },
  { href: "/admin/pembayaran-otomatis", label: "QRIS Otomatis", icon: QrIcon },
  { href: "/admin/messages", label: "Pesan", icon: MailIcon },
  { href: "/admin/tickets", label: "Laporan", icon: FlagIcon },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-accentBlue flex items-center justify-center text-white">
        <BoltIcon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-[#0d1526] tracking-tight leading-none">Nebeng Impulse</h3>
        <span className="text-[10px] text-[#7c8698] font-medium">Panel Admin</span>
      </div>
    </div>
  );
}

export default function AdminLayout({ title, subtitle, actions, children }) {
  const router = useRouter();
  const currentBase = router.pathname;

  async function handleLogout() {
    await signOut(auth);
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-[#101828] md:flex">
      {/* Sidebar: tablet / desktop / HP landscape lebar */}
      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-60 shrink-0 bg-white border-r border-cardBorder sticky top-0 h-screen overflow-y-auto">
        <div className="px-4 py-4 border-b border-cardBorder">
          <Brand />
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold text-[#9aa4b7] uppercase tracking-wider">Menu</p>
          {navItems.map((item) => {
            const active = currentBase === item.href.split("?")[0];
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  active ? "bg-[#eaf0ff] text-accentBlue" : "text-[#475168] hover:bg-[#f5f7fb]"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="p-3 border-t border-cardBorder space-y-0.5">
          <a href={MAIN_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#475168] hover:bg-[#f5f7fb]">
            <ExternalIcon size={16} /> Situs Utama
          </a>
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-rose-600 hover:bg-rose-50">
            <LogoutIcon size={16} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Header + tab: HP tegak */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-cardBorder">
          <div className="px-3 py-2.5 flex items-center justify-between">
            <Brand />
            <div className="flex items-center gap-1.5">
              <a href={MAIN_URL} target="_blank" rel="noreferrer" aria-label="Situs utama" className="w-8 h-8 rounded-lg border border-cardBorder flex items-center justify-center text-[#475168]">
                <ExternalIcon size={15} />
              </a>
              <button onClick={handleLogout} aria-label="Keluar" className="w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 flex items-center justify-center text-rose-600">
                <LogoutIcon size={15} />
              </button>
            </div>
          </div>
          <div className="px-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
            {navItems.map((item) => {
              const active = currentBase === item.href.split("?")[0];
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                    active ? "bg-accentBlue text-white border-accentBlue" : "bg-white text-[#475168] border-cardBorder"
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </header>

        <main className="px-3 sm:px-5 lg:px-7 py-4 sm:py-6 max-w-6xl mx-auto">
          {(title || actions) && (
            <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                {title && <h1 className="text-xl sm:text-2xl font-bold text-[#0d1526] tracking-tight">{title}</h1>}
                {subtitle && <p className="text-xs sm:text-sm text-[#7c8698] mt-0.5">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
