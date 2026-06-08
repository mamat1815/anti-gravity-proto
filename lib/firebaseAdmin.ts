// lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

const getFirebaseAdminDb = () => {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.log("⚠️ Firebase Admin SDK tidak dikonfigurasi. Backend API akan beroperasi dalam Mock Mode.");
    return null;
  }

  // Cek jika kredensial masih berupa placeholder/contoh dari template
  if (
    projectId === 'your-project-id' || 
    clientEmail.includes('xxxxx') || 
    privateKey.includes('...')
  ) {
    console.log("⚠️ Kredensial Firebase di .env.local masih berupa placeholder. Backend API beroperasi dalam Mock Mode.");
    return null;
  }

  try {
    // Bersihkan spasi dan rapikan format private key
    let formattedPrivateKey = privateKey.trim();
    if (formattedPrivateKey.startsWith('"') && formattedPrivateKey.endsWith('"')) {
      formattedPrivateKey = formattedPrivateKey.slice(1, -1);
    }
    if (formattedPrivateKey.startsWith("'") && formattedPrivateKey.endsWith("'")) {
      formattedPrivateKey = formattedPrivateKey.slice(1, -1);
    }
    formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');

    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey,
        }),
      });
    }

    return admin.firestore();
  } catch (error) {
    console.error("❌ Gagal inisialisasi Firebase Admin SDK:", error);
    return null;
  }
};

export const adminDb = getFirebaseAdminDb();
export const isFirebaseAdminConfigured = adminDb !== null;
