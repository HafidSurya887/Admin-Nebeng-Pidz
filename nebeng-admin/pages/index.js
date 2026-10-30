import { useEffect } from "react";
import { useRouter } from "next/router";

// Web admin nggak punya halaman publik: langsung lempar ke dashboard
// (kalau belum login, useAdminGuard otomatis lanjut ke /admin/login).
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);
  return null;
}
