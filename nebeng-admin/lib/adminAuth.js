import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "pidzgantengbanget18@pidzstore.com").split(",");

// Dipanggil di tiap halaman admin (kecuali /admin/login) buat proteksi akses
export function useAdminGuard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.replace("/admin/login");
        return;
      }
      setAdminUser(user);
      setChecking(false);
    });
    return () => unsub();
  }, [router]);

  return { adminUser, checking };
}
