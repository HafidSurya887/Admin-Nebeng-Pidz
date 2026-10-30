import { useState } from "react";
import { useRouter } from "next/router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { LockIcon, ShieldCheckIcon } from "../../components/Icons";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin/dashboard");
    } catch (err) {
      setError("Email atau password salah");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-4">
      <div className="w-full max-w-sm sm:max-w-md space-y-4">
        <a href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || "/"} className="inline-flex items-center gap-1.5 text-xs text-[#5b6472] hover:text-[#0d1526] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
          <span>Kembali ke Halaman Utama</span>
        </a>

        <div className="bg-white border-2 border-amber-300 rounded-3xl p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] space-y-5 relative overflow-hidden">
          <div className="flex justify-between items-center relative">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300">
              <ShieldCheckIcon size={12} /> Admin Access Only
            </span>
          </div>

          <div className="text-left space-y-1 relative">
            <h1 className="text-xl font-extrabold text-[#0d1526] tracking-tight">Login Portal Admin</h1>
            <p className="text-[11px] text-[#7c8698]">Masukkan kredensial otentikasi pemilik server Nebeng Impulse</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 relative">
            <div>
              <label className="block text-[11px] font-bold text-[#475168] uppercase tracking-wider mb-1.5">Email (Gmail Admin)</label>
              <input
                className="w-full bg-[#f7f9fc] border-2 border-[#eef1f7] rounded-xl px-3.5 py-2.5 text-xs text-[#101828] placeholder:text-[#9aa4b7] focus:border-amber-400 focus:outline-none font-medium"
                placeholder="admin@gmail.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#475168] uppercase tracking-wider mb-1.5">Password Admin</label>
              <input
                className="w-full bg-[#f7f9fc] border-2 border-[#eef1f7] rounded-xl px-3.5 py-2.5 text-xs text-[#101828] placeholder:text-[#9aa4b7] focus:border-amber-400 focus:outline-none font-medium"
                placeholder="••••••••••••"
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold text-sm rounded-xl transition-colors mt-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2C9.243 2 7 4.243 7 7v3H6c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-8c0-1.103-.897-2-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 7V7c0-1.654 1.346-3 3-3s3 1.346 3 3v2H9z" /></svg>
              <span>{loading ? "Memproses..." : "Masuk Panel Admin"}</span>
            </button>
          </form>

          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-800 flex items-center gap-2 relative">
            <LockIcon size={13} className="shrink-0" />
            <span>Akses dipantau secara real-time. Semua percobaan masuk tercatat dengan IP.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
