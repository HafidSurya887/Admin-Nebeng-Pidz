// Ini dipakai khusus di API routes (server-side), BUKAN di browser.
// Butuh Service Account Key dari Firebase Console:
// Project Settings > Service Accounts > Generate new private key
// Hasil file JSON-nya, copy 3 value ini ke .env.local (JANGAN commit file JSON-nya)

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const adminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    // private key di .env biasanya perlu replace \\n jadi \n
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
};

const adminApp = getApps().length ? getApps()[0] : initializeApp(adminConfig, "admin");

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
