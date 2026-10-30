// Ikon SVG garis (stroke) pengganti emoji. Warna ikut `currentColor`,
// ukuran diatur lewat prop `size` atau className.

function Svg({ size = 16, className = "", strokeWidth = 2, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const BoltIcon = (p) => (
  <Svg {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></Svg>
);
export const BellIcon = (p) => (
  <Svg {...p}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" /></Svg>
);
export const BookIcon = (p) => (
  <Svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5v14zM4 19.5A2.5 2.5 0 006.5 22H20v-5" /></Svg>
);
export const CloseIcon = (p) => (
  <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>
);
export const CheckIcon = (p) => (
  <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>
);
export const AlertIcon = (p) => (
  <Svg {...p}><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" /></Svg>
);
export const InfoIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>
);
export const KeyIcon = (p) => (
  <Svg {...p}><path d="M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3-3.5 3.5z" /></Svg>
);
export const EyeIcon = (p) => (
  <Svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const EyeOffIcon = (p) => (
  <Svg {...p}><path d="M17.9 17.9A10.9 10.9 0 0112 20C5 20 1 12 1 12a18.5 18.5 0 015.1-5.9M9.9 4.2A9.1 9.1 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.2 3.2M14.1 14.1a3 3 0 11-4.2-4.2M1 1l22 22" /></Svg>
);
export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></Svg>
);
export const CopyIcon = (p) => (
  <Svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></Svg>
);
export const ChevronDownIcon = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
);
export const SendIcon = (p) => (
  <Svg {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
);
export const MegaphoneIcon = (p) => (
  <Svg {...p}><path d="M3 11v2a1 1 0 001 1h3l5 4V6L7 10H4a1 1 0 00-1 1zM16 8a5 5 0 010 8M19 5a9 9 0 010 14" /></Svg>
);
export const GlobeIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" /></Svg>
);
export const ChatIcon = (p) => (
  <Svg {...p}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></Svg>
);
export const PlayIcon = (p) => (
  <Svg {...p}><path d="M6 4l14 8-14 8V4z" /></Svg>
);
export const MusicIcon = (p) => (
  <Svg {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></Svg>
);
export const UsersIcon = (p) => (
  <Svg {...p}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" /></Svg>
);
export const ChartIcon = (p) => (
  <Svg {...p}><path d="M18 20V10M12 20V4M6 20v-6" /></Svg>
);
export const ShieldIcon = (p) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>
);
export const LockIcon = (p) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></Svg>
);
export const RefreshIcon = (p) => (
  <Svg {...p}><path d="M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.8-3.4L23 10M1 14l4.7 4.4A9 9 0 0020.5 15" /></Svg>
);
export const TrashIcon = (p) => (
  <Svg {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6" /></Svg>
);
export const FlagIcon = (p) => (
  <Svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></Svg>
);
export const ShieldCheckIcon = (p) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" /></Svg>
);

export const GridIcon = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></Svg>
);
export const ServerIcon = (p) => (
  <Svg {...p}><rect x="2" y="3" width="20" height="8" rx="2" /><rect x="2" y="13" width="20" height="8" rx="2" /><path d="M6 7h.01M6 17h.01" /></Svg>
);
export const WalletIcon = (p) => (
  <Svg {...p}><path d="M20 12V8a2 2 0 00-2-2H5a2 2 0 010-4h13M3 5v14a2 2 0 002 2h15a1 1 0 001-1v-4M18 13h4v4h-4a2 2 0 010-4z" /></Svg>
);
export const QrIcon = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></Svg>
);
export const MailIcon = (p) => (
  <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></Svg>
);
export const PencilIcon = (p) => (
  <Svg {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></Svg>
);
export const ArrowUpIcon = (p) => (
  <Svg {...p}><path d="M12 19V5M5 12l7-7 7 7" /></Svg>
);
export const ArrowDownIcon = (p) => (
  <Svg {...p}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>
);
export const PlusIcon = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const LogoutIcon = (p) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></Svg>
);
export const ExternalIcon = (p) => (
  <Svg {...p}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></Svg>
);
