// lib/dbService.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';

// Interfaces
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl: string;
}

export interface Cafe {
  id: string;
  name: string;
  description: string;
  address: string;
  imageUrl: string;
  ownerId: string;
  balance: number; // Saldo yang belum dicairkan ke kafe
  transferredBalance: number; // Saldo yang sudah dicairkan ke kafe
  menu: MenuItem[];
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'cafe_owner' | 'customer';
  cafeId?: string; // Khusus untuk role cafe_owner
}

export interface Reservation {
  orderId: string;
  cafeId: string;
  cafeName: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  itemPrice: number;
  appFee: number;
  grossAmount: number;
  status: 'pending' | 'settlement' | 'failed';
  payoutStatus: 'pending' | 'transferred';
  createdAt: string;
  payoutTimestamp?: string;
  itemsOrdered?: { name: string; quantity: number; price: number }[];
}

export interface Payout {
  id: string;
  cafeId: string;
  cafeName: string;
  amount: number;
  status: 'success';
  timestamp: string;
  bankName: string;
  bankAccount: string;
}

// 1. Dapatkan konfigurasi Firebase
const getFirebaseConfig = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('firebase_custom_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal parsing custom Firebase config", e);
      }
    }
  }
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
};

const config = getFirebaseConfig();
export const isFirebaseConfigured = !!(config.apiKey && config.projectId);

// 2. Inisialisasi Firebase (jika sudah dikonfigurasi)
let firebaseApp: any = null;
let firestoreDb: any = null;
let firebaseAuth: any = null;

if (isFirebaseConfigured) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
  } catch (e) {
    console.error("Gagal inisialisasi Firebase", e);
  }
}

// ==========================================
// MOCK DATA SEED (Untuk LocalStorage Fallback)
// ==========================================
const DEFAULT_CAFES: Cafe[] = [
  {
    id: 'cafe-1',
    name: 'Kopi Kenangan Senja',
    description: 'Kafe estetik dengan pemandangan sore yang indah dan racikan kopi arabika lokal premium.',
    address: 'Jl. Senopati No. 45, Jakarta Selatan',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    ownerId: 'owner-cafe-1',
    balance: 0,
    transferredBalance: 0,
    createdAt: new Date().toISOString(),
    menu: [
      { id: 'm1', name: 'Kopi Susu Senja', price: 22000, description: 'Espresso dengan susu segar dan sirup gula aren khas.', imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
      { id: 'm2', name: 'Caramel Macchiato', price: 28000, description: 'Kombinasi espresso, susu, vanila, dan saus karamel manis.', imageUrl: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
      { id: 'm3', name: 'Croissant Butter', price: 20000, description: 'Pastry mentega renyah buatan sendiri, cocok sebagai teman kopi.', imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
    ]
  },
  {
    id: 'cafe-2',
    name: 'Space Gravity Brew',
    description: 'Konsep minimalis industrial futuristik dengan teknologi brewing modern.',
    address: 'Jl. Dago Atas No. 102, Bandung',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    ownerId: 'owner-cafe-2',
    balance: 0,
    transferredBalance: 0,
    createdAt: new Date().toISOString(),
    menu: [
      { id: 'm4', name: 'Black Hole Cold Brew', price: 25000, description: 'Kopi seduh dingin selama 16 jam, segar dan rendah asam.', imageUrl: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
      { id: 'm5', name: 'Galaxy Matcha Latte', price: 27000, description: 'Matcha Jepang premium dengan susu creamy hangat/dingin.', imageUrl: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3' },
    ]
  }
];

const DEFAULT_USERS: UserProfile[] = [
  { uid: 'admin-1', email: 'admin@reservasi.com', name: 'Mamat Owner App', role: 'admin' },
  { uid: 'owner-cafe-1', email: 'owner1@cafe.com', name: 'Budi Senja', role: 'cafe_owner', cafeId: 'cafe-1' },
  { uid: 'owner-cafe-2', email: 'owner2@cafe.com', name: 'Siti Gravity', role: 'cafe_owner', cafeId: 'cafe-2' },
  { uid: 'cust-1', email: 'budi@gmail.com', name: 'Budi Pembeli', role: 'customer' }
];

// Helper LocalStorage
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : defaultValue;
};

const setStorageItem = (key: string, value: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

// ==========================================
// UNIFIED DATA SERVICE (MOCK + REAL FIREBASE)
// ==========================================
export const dbService = {
  // ------------------------------------------
  // AUTHENTICATION SERVICES
  // ------------------------------------------
  async getCurrentUser(): Promise<UserProfile | null> {
    if (typeof window === 'undefined') return null;
    const sessionUser = getStorageItem<UserProfile | null>('ag_session_user', null);
    
    if (isFirebaseConfigured && firebaseAuth) {
      // Tunggu state auth firebase settle
      return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
          unsubscribe();
          if (fbUser) {
            // Ambil profile dari Firestore
            try {
              const docSnap = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
              if (docSnap.exists()) {
                const profile = { uid: fbUser.uid, ...docSnap.data() } as UserProfile;
                setStorageItem('ag_session_user', profile);
                resolve(profile);
              } else {
                resolve(sessionUser); // fallback
              }
            } catch (e) {
              resolve(sessionUser);
            }
          } else {
            setStorageItem('ag_session_user', null);
            resolve(null);
          }
        });
      });
    }
    return sessionUser;
  },

  async login(email: string, password: string): Promise<UserProfile> {
    if (isFirebaseConfigured && firebaseAuth) {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const uid = userCredential.user.uid;
      const userDoc = await getDoc(doc(firestoreDb, 'users', uid));
      if (!userDoc.exists()) throw new Error("Profil pengguna tidak ditemukan di Firestore!");
      const profile = { uid, ...userDoc.data() } as UserProfile;
      setStorageItem('ag_session_user', profile);
      return profile;
    } else {
      // Mock Login
      const users = getStorageItem<UserProfile[]>('ag_users', DEFAULT_USERS);
      const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!found) throw new Error("Email tidak terdaftar (Gunakan tombol Quick Login jika ragu)!");
      // Kita mock password bypass
      setStorageItem('ag_session_user', found);
      return found;
    }
  },

  async register(email: string, name: string, role: 'admin' | 'cafe_owner' | 'customer', cafeId?: string): Promise<UserProfile> {
    if (isFirebaseConfigured && firebaseAuth) {
      // Daftar di Firebase Auth (password default mock: 'password123' untuk demo/setup)
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, 'password123');
      const uid = userCredential.user.uid;
      const profile: UserProfile = { uid, email, name, role, cafeId };
      await setDoc(doc(firestoreDb, 'users', uid), { email, name, role, cafeId: cafeId || null });
      setStorageItem('ag_session_user', profile);
      return profile;
    } else {
      // Mock Register
      const users = getStorageItem<UserProfile[]>('ag_users', DEFAULT_USERS);
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("Email sudah terdaftar!");
      }
      const newProfile: UserProfile = { uid: `u-${Date.now()}`, email, name, role, cafeId };
      const updatedUsers = [...users, newProfile];
      setStorageItem('ag_users', updatedUsers);
      setStorageItem('ag_session_user', newProfile);
      return newProfile;
    }
  },

  async logout(): Promise<void> {
    if (isFirebaseConfigured && firebaseAuth) {
      await signOut(firebaseAuth);
    }
    setStorageItem('ag_session_user', null);
  },

  // Switch role instan untuk mode demo
  quickLogin(role: 'admin' | 'cafe_owner' | 'customer', specificCafeId?: string) {
    const users = getStorageItem<UserProfile[]>('ag_users', DEFAULT_USERS);
    let found = users.find(u => u.role === role && (!specificCafeId || u.cafeId === specificCafeId));
    if (!found) {
      // Buat akun dummy baru jika tidak ada
      found = {
        uid: `quick-${role}-${Date.now()}`,
        email: `${role}@demo.com`,
        name: `Demo ${role.toUpperCase()}`,
        role,
        cafeId: specificCafeId || (role === 'cafe_owner' ? 'cafe-1' : undefined)
      };
      setStorageItem('ag_users', [...users, found]);
    }
    setStorageItem('ag_session_user', found);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },

  // ------------------------------------------
  // CAFE SERVICES
  // ------------------------------------------
  async getCafes(): Promise<Cafe[]> {
    if (isFirebaseConfigured && firestoreDb) {
      const snap = await getDocs(collection(firestoreDb, 'cafes'));
      const cafes: Cafe[] = [];
      snap.forEach(d => {
        cafes.push({ id: d.id, ...d.data() } as Cafe);
      });
      return cafes;
    } else {
      return getStorageItem<Cafe[]>('ag_cafes', DEFAULT_CAFES);
    }
  },

  async getCafeById(id: string): Promise<Cafe | null> {
    if (isFirebaseConfigured && firestoreDb) {
      const docSnap = await getDoc(doc(firestoreDb, 'cafes', id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Cafe;
      }
      return null;
    } else {
      const cafes = await this.getCafes();
      return cafes.find(c => c.id === id) || null;
    }
  },

  async createCafe(name: string, description: string, address: string, imageUrl: string, ownerId: string): Promise<Cafe> {
    const newCafe: Omit<Cafe, 'id'> = {
      name,
      description,
      address,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500',
      ownerId,
      balance: 0,
      transferredBalance: 0,
      menu: [],
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured && firestoreDb) {
      const docRef = await addDoc(collection(firestoreDb, 'cafes'), newCafe);
      return { id: docRef.id, ...newCafe } as Cafe;
    } else {
      const cafes = await this.getCafes();
      const cafeCreated: Cafe = { id: `cafe-${Date.now()}`, ...newCafe };
      setStorageItem('ag_cafes', [...cafes, cafeCreated]);
      return cafeCreated;
    }
  },

  async updateCafeMenu(cafeId: string, menu: MenuItem[]): Promise<void> {
    if (isFirebaseConfigured && firestoreDb) {
      await updateDoc(doc(firestoreDb, 'cafes', cafeId), { menu });
    } else {
      const cafes = await this.getCafes();
      const idx = cafes.findIndex(c => c.id === cafeId);
      if (idx !== -1) {
        cafes[idx].menu = menu;
        setStorageItem('ag_cafes', cafes);
      }
    }
  },

  // ------------------------------------------
  // RESERVATION & TRANSACTION SERVICES
  // ------------------------------------------
  async createReservation(
    cafeId: string, 
    cafeName: string, 
    customerId: string, 
    customerName: string, 
    customerEmail: string,
    itemPrice: number,
    appFee: number,
    itemsOrdered?: { name: string; quantity: number; price: number }[]
  ): Promise<Reservation> {
    const targetClean = itemPrice + appFee;
    const grossAmount = Math.ceil(targetClean / 0.993); // QRIS gross up 0.7%

    const orderId = `AG-${Date.now()}`;
    const reservation: Reservation = {
      orderId,
      cafeId,
      cafeName,
      customerId,
      customerName,
      customerEmail,
      itemPrice,
      appFee,
      grossAmount,
      status: 'pending',
      payoutStatus: 'pending',
      createdAt: new Date().toISOString(),
      itemsOrdered: itemsOrdered || []
    };

    if (isFirebaseConfigured && firestoreDb) {
      await setDoc(doc(firestoreDb, 'reservations', orderId), reservation);
    } else {
      const reservations = getStorageItem<Reservation[]>('ag_reservations', []);
      setStorageItem('ag_reservations', [reservation, ...reservations]);
    }
    return reservation;
  },

  async getReservations(): Promise<Reservation[]> {
    if (isFirebaseConfigured && firestoreDb) {
      const snap = await getDocs(query(collection(firestoreDb, 'reservations'), orderBy('createdAt', 'desc')));
      const list: Reservation[] = [];
      snap.forEach(d => {
        list.push(d.data() as Reservation);
      });
      return list;
    } else {
      return getStorageItem<Reservation[]>('ag_reservations', []);
    }
  },

  async getReservationsByCustomer(customerId: string): Promise<Reservation[]> {
    if (isFirebaseConfigured && firestoreDb) {
      const q = query(
        collection(firestoreDb, 'reservations'), 
        where('customerId', '==', customerId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Reservation[] = [];
      snap.forEach(d => {
        list.push(d.data() as Reservation);
      });
      return list;
    } else {
      const all = await this.getReservations();
      return all.filter(r => r.customerId === customerId);
    }
  },

  async getReservationsByCafe(cafeId: string): Promise<Reservation[]> {
    if (isFirebaseConfigured && firestoreDb) {
      const q = query(
        collection(firestoreDb, 'reservations'), 
        where('cafeId', '==', cafeId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Reservation[] = [];
      snap.forEach(d => {
        list.push(d.data() as Reservation);
      });
      return list;
    } else {
      const all = await this.getReservations();
      return all.filter(r => r.cafeId === cafeId);
    }
  },

  // Fungsi untuk mensimulasikan Pembayaran Sukses dari Client Side
  // (Penting jika webhook tidak dapat diakses di localhost/tanpa Ngrok)
  async markAsPaid(orderId: string): Promise<void> {
    if (isFirebaseConfigured && firestoreDb) {
      const docRef = doc(firestoreDb, 'reservations', orderId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Reservation;
        if (data.status !== 'settlement') {
          // 1. Update status reservasi ke settlement
          await updateDoc(docRef, { status: 'settlement' });
          
          // 2. Tambah saldo kafe
          const cafeRef = doc(firestoreDb, 'cafes', data.cafeId);
          const cafeSnap = await getDoc(cafeRef);
          if (cafeSnap.exists()) {
            const cafeData = cafeSnap.data() as Cafe;
            const currentBalance = cafeData.balance || 0;
            await updateDoc(cafeRef, { balance: currentBalance + data.itemPrice });
          }
        }
      }
    } else {
      const reservations = getStorageItem<Reservation[]>('ag_reservations', []);
      const idx = reservations.findIndex(r => r.orderId === orderId);
      if (idx !== -1 && reservations[idx].status !== 'settlement') {
        reservations[idx].status = 'settlement';
        setStorageItem('ag_reservations', reservations);

        // Tambah saldo kafe
        const cafes = getStorageItem<Cafe[]>('ag_cafes', DEFAULT_CAFES);
        const cafeIdx = cafes.findIndex(c => c.id === reservations[idx].cafeId);
        if (cafeIdx !== -1) {
          cafes[cafeIdx].balance = (cafes[cafeIdx].balance || 0) + reservations[idx].itemPrice;
          setStorageItem('ag_cafes', cafes);
        }
      }
    }
  },

  // ------------------------------------------
  // PAYOUT (TRANSFER MALAM HARI) SERVICES
  // ------------------------------------------
  async getPayouts(): Promise<Payout[]> {
    if (isFirebaseConfigured && firestoreDb) {
      const snap = await getDocs(query(collection(firestoreDb, 'payouts'), orderBy('timestamp', 'desc')));
      const list: Payout[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Payout);
      });
      return list;
    } else {
      return getStorageItem<Payout[]>('ag_payouts', []);
    }
  },

  async processPayout(cafeId: string, bankName: string, bankAccount: string): Promise<Payout> {
    // Ambil data kafe
    const cafe = await this.getCafeById(cafeId);
    if (!cafe) throw new Error("Kafe tidak ditemukan!");
    
    const amountToTransfer = cafe.balance;
    if (amountToTransfer <= 0) throw new Error("Tidak ada saldo tertunda untuk ditransfer!");

    const newPayout: Omit<Payout, 'id'> = {
      cafeId,
      cafeName: cafe.name,
      amount: amountToTransfer,
      status: 'success',
      timestamp: new Date().toISOString(),
      bankName,
      bankAccount
    };

    if (isFirebaseConfigured && firestoreDb) {
      // 1. Catat log Payout
      const payoutRef = await addDoc(collection(firestoreDb, 'payouts'), newPayout);
      
      // 2. Potong saldo kafe di Firestore dan pindahkan ke transferredBalance
      const cafeRef = doc(firestoreDb, 'cafes', cafeId);
      await updateDoc(cafeRef, {
        balance: 0,
        transferredBalance: (cafe.transferredBalance || 0) + amountToTransfer
      });

      // 3. Update status pembayaran/reservasi kafe ini yang masih pending payout ke status transferred
      const reservationsRef = collection(firestoreDb, 'reservations');
      const q = query(reservationsRef, where('cafeId', '==', cafeId), where('status', '==', 'settlement'), where('payoutStatus', '==', 'pending'));
      const querySnap = await getDocs(q);
      const batchPromises: Promise<any>[] = [];
      querySnap.forEach(d => {
        batchPromises.push(updateDoc(doc(firestoreDb, 'reservations', d.id), {
          payoutStatus: 'transferred',
          payoutTimestamp: new Date().toISOString()
        }));
      });
      await Promise.all(batchPromises);

      return { id: payoutRef.id, ...newPayout } as Payout;
    } else {
      // Mock Payout
      const payouts = getStorageItem<Payout[]>('ag_payouts', []);
      const payoutCreated: Payout = {
        id: `pay-${Date.now()}`,
        ...newPayout
      };
      
      // Update balance kafe
      const cafes = await this.getCafes();
      const cafeIdx = cafes.findIndex(c => c.id === cafeId);
      if (cafeIdx !== -1) {
        cafes[cafeIdx].balance = 0;
        cafes[cafeIdx].transferredBalance = (cafes[cafeIdx].transferredBalance || 0) + amountToTransfer;
        setStorageItem('ag_cafes', cafes);
      }

      // Update reservations
      const reservations = getStorageItem<Reservation[]>('ag_reservations', []);
      const updatedReservations = reservations.map(r => {
        if (r.cafeId === cafeId && r.status === 'settlement' && r.payoutStatus === 'pending') {
          return {
            ...r,
            payoutStatus: 'transferred' as const,
            payoutTimestamp: new Date().toISOString()
          };
        }
        return r;
      });
      setStorageItem('ag_reservations', updatedReservations);
      setStorageItem('ag_payouts', [payoutCreated, ...payouts]);
      
      return payoutCreated;
    }
  }
};
