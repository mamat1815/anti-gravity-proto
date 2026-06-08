// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import Navbar from '@/components/Navbar';
import { dbService, Cafe, MenuItem, Reservation, UserProfile } from '@/lib/dbService';

export default function Home() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  // Status Pilihan Pelanggan
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [cart, setCart] = useState<{ [itemId: string]: { item: MenuItem; quantity: number } }>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'browse' | 'history'>('browse');

  useEffect(() => {
    // 1. Ambil user aktif, jika tidak ada, login sebagai customer secara default
    dbService.getCurrentUser().then(u => {
      if (!u) {
        dbService.quickLogin('customer');
      } else {
        setActiveUser(u);
        loadData(u.uid);
      }
    });
  }, []);

  const loadData = async (userId: string) => {
    setIsLoading(true);
    try {
      const allCafes = await dbService.getCafes();
      setCafes(allCafes);
      
      const userRes = await dbService.getReservationsByCustomer(userId);
      setReservations(userRes);

      // Set default cafe terpilih ke kafe pertama jika ada
      if (allCafes.length > 0 && !selectedCafe) {
        setSelectedCafe(allCafes[0]);
      }
    } catch (e) {
      console.error("Gagal load data marketplace", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCafe = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setCart({}); // Reset keranjang jika berganti kafe
  };

  const updateCartQuantity = (item: MenuItem, change: number) => {
    const newCart = { ...cart };
    if (!newCart[item.id]) {
      newCart[item.id] = { item, quantity: 0 };
    }
    
    newCart[item.id].quantity += change;
    
    if (newCart[item.id].quantity <= 0) {
      delete newCart[item.id];
    }
    setCart(newCart);
  };

  // Kalkulasi biaya
  const getCartTotals = () => {
    const items = Object.values(cart);
    const itemPrice = items.reduce((acc, c) => acc + (c.item.price * c.quantity), 0);
    const appFee = itemPrice > 0 ? 2000 : 0; // Flat app fee Rp 2.000
    const targetClean = itemPrice + appFee;
    const grossAmount = itemPrice > 0 ? Math.ceil(targetClean / 0.993) : 0; // QRIS gross up 0.7%
    return { itemPrice, appFee, grossAmount, items };
  };

  const handleCheckout = async (simulateDirect = false) => {
    const { itemPrice, appFee, grossAmount, items } = getCartTotals();
    if (itemPrice === 0 || !selectedCafe || !activeUser) return;
    
    setIsLoading(true);
    setMessage('');

    try {
      // 1. Catat pemesanan & kalkulasi ke DB
      const itemsOrdered = items.map(c => ({
        name: c.item.name,
        quantity: c.quantity,
        price: c.item.price
      }));

      // Panggil backend API checkout untuk generate Token Midtrans
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeId: selectedCafe.id,
          cafeName: selectedCafe.name,
          itemPrice,
          appFee,
          customerId: activeUser.uid,
          customerName: activeUser.name,
          customerEmail: activeUser.email,
          itemsOrdered
        }),
      });

      const checkoutData = await res.json();
      if (!res.ok) throw new Error(checkoutData.error || 'Gagal membuat transaksi');

      const orderId = checkoutData.orderId;

      // 2. Simpan order ke client-side dbService (Firestore/Mock) jika API Route gagal/mode mock
      const reservationCreated = await dbService.createReservation(
        selectedCafe.id,
        selectedCafe.name,
        activeUser.uid,
        activeUser.name,
        activeUser.email,
        itemPrice,
        appFee,
        itemsOrdered
      );

      // Jika user memilih tombol SIMULASI LANGSUNG (untuk test bypass Midtrans di localhost)
      if (simulateDirect) {
        await dbService.markAsPaid(orderId);
        setMessage('✅ [SIMULASI] Transaksi berhasil dibayar instan!');
        setCart({});
        await loadData(activeUser.uid);
        setActiveTab('history');
        setIsLoading(false);
        return;
      }

      // 3. Luncurkan Popup Midtrans Snap
      window.snap.pay(checkoutData.token, {
        onSuccess: async function (result: any) {
          // Update status ke settlement di DB
          await dbService.markAsPaid(orderId);
          alert('🎉 Pembayaran Berhasil! Reservasi Anda telah dikonfirmasi.');
          setCart({});
          await loadData(activeUser.uid);
          setActiveTab('history');
        },
        onPending: function (result: any) {
          alert('⏳ Pembayaran pending. Segera selesaikan pembayaran QRIS Anda.');
          loadData(activeUser.uid);
          setActiveTab('history');
        },
        onError: function (result: any) {
          alert('❌ Pembayaran gagal. Silakan coba lagi.');
        },
        onClose: function () {
          alert('Anda menutup popup pembayaran.');
        }
      });

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const { itemPrice, appFee, grossAmount, items: cartItems } = getCartTotals();
  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 pb-12">
      {/* Inject Midtrans Snap Script */}
      <Script 
        src="https://app.sandbox.midtrans.com/snap/snap.js" 
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="lazyOnload"
      />

      <Navbar />

      <main className="max-w-7xl mx-auto px-6">
        
        {/* HERO BANNER */}
        <div className="glass-panel p-8 rounded-3xl mb-8 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 justify-between border border-white/5">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center md:text-left z-10">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2 leading-tight">
              Pesan Meja Kafe & <span className="text-blue-400">Ngopi Instan</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base max-w-xl">
              Cari kafe favoritmu, pesan menu, dan bayar aman dengan QRIS Midtrans. Dana aman di platform sebelum ditransfer ke kafe tujuan.
            </p>
          </div>

          <div className="flex gap-3 z-10">
            <button 
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                activeTab === 'browse' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              ☕ Cari Kafe
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
                activeTab === 'history' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              📜 Reservasi Saya ({reservations.length})
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-sm font-semibold flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-xs opacity-50">Tutup</button>
          </div>
        )}

        {/* TAB 1: BROWSE CAFES */}
        {activeTab === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* PANEL KIRI: LIST KAFE */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-black text-white uppercase tracking-wider mb-2">🏬 Kafe Terdaftar</h2>
              
              <div className="space-y-3">
                {cafes.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Belum ada kafe terdaftar</p>
                ) : (
                  cafes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCafe(c)}
                      className={`w-full text-left p-4 rounded-2xl transition-all border flex gap-3 items-center ${
                        selectedCafe?.id === c.id 
                          ? 'bg-blue-600/10 text-white border-blue-500/40' 
                          : 'glass-card text-gray-300 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <img 
                        src={c.imageUrl} 
                        alt={c.name} 
                        className="w-12 h-12 object-cover rounded-lg border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{c.name}</div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {c.address}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* PANEL TENGAH: DETAIL KAFE & MENU */}
            <div className="lg:col-span-2 space-y-6">
              {selectedCafe ? (
                <>
                  {/* Banner Kafe terpilih */}
                  <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left">
                      <img 
                        src={selectedCafe.imageUrl} 
                        alt={selectedCafe.name} 
                        className="w-20 h-20 object-cover rounded-xl border border-white/10"
                      />
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedCafe.name}</h2>
                        <p className="text-gray-400 text-xs mt-1 leading-relaxed">{selectedCafe.description}</p>
                        <p className="text-gray-500 text-[10px] mt-2">📍 {selectedCafe.address}</p>
                      </div>
                    </div>
                  </div>

                  {/* Daftar Menu Kafe */}
                  <div className="glass-panel p-6 rounded-2xl">
                    <h3 className="text-base font-bold text-white mb-4">🛒 Daftar Menu Tersedia</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {!selectedCafe.menu || selectedCafe.menu.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-6 text-center col-span-2">Kafe ini belum mengisi menu hidangannya.</p>
                      ) : (
                        selectedCafe.menu.map((item) => {
                          const quantity = cart[item.id]?.quantity || 0;
                          return (
                            <div key={item.id} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex gap-3 items-start">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="w-14 h-14 object-cover rounded-lg border border-white/5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-white text-xs truncate">{item.name}</div>
                                <div className="text-emerald-400 font-bold text-xs mt-0.5">{formatRp(item.price)}</div>
                                <p className="text-gray-500 text-[9px] mt-1 line-clamp-1">{item.description}</p>
                                
                                <div className="flex justify-between items-center mt-3">
                                  {quantity > 0 ? (
                                    <div className="flex items-center gap-2.5">
                                      <button 
                                        onClick={() => updateCartQuantity(item, -1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-gray-800 text-xs font-bold text-white hover:bg-gray-700 transition"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-bold text-white">{quantity}</span>
                                      <button 
                                        onClick={() => updateCartQuantity(item, 1)}
                                        className="w-5 h-5 flex items-center justify-center rounded bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 transition"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => updateCartQuantity(item, 1)}
                                      className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-[10px] font-bold px-2.5 py-1 rounded transition cursor-pointer"
                                    >
                                      Pesan Menu
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-panel p-8 text-center text-gray-500 rounded-2xl py-20">
                  🏬 Pilih kafe terlebih dahulu untuk memesan menu
                </div>
              )}
            </div>

            {/* PANEL KANAN: RINGKASAN PEMESANAN & CHECKOUT */}
            <div className="lg:col-span-1">
              <div className="glass-panel p-6 rounded-2xl sticky top-28 border border-white/5">
                <h3 className="text-base font-bold text-white mb-4 flex items-center gap-1.5">
                  <span>🛍️ Keranjang Reservasi</span>
                  {selectedCafe && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                      {selectedCafe.name}
                    </span>
                  )}
                </h3>

                {cartItems.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-500 italic">
                    Keranjang kosong.<br/>Pilih menu kopi/pastry di samping.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Daftar Item Keranjang */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {cartItems.map((c) => (
                        <div key={c.item.id} className="text-xs flex justify-between items-center py-1.5 border-b border-white/5">
                          <div>
                            <div className="font-bold text-white">{c.item.name}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {c.quantity}x @ {formatRp(c.item.price)}
                            </div>
                          </div>
                          <div className="font-bold text-gray-200">{formatRp(c.item.price * c.quantity)}</div>
                        </div>
                      ))}
                    </div>

                    {/* Rincian Finansial */}
                    <div className="space-y-2 text-xs pt-4 border-t border-white/5">
                      <div className="flex justify-between text-gray-400">
                        <span>Harga Menu (Net Kafe)</span>
                        <span>{formatRp(itemPrice)}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Biaya Platform (App Fee)</span>
                        <span>{formatRp(appFee)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500 text-[10px]">
                        <span>Pemberlakuan QRIS Fee (0.7%)</span>
                        <span>Dihitung</span>
                      </div>
                      
                      <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-white/10">
                        <span>Total Pembayaran (Gross)</span>
                        <span className="text-blue-400">{formatRp(grossAmount)}</span>
                      </div>
                    </div>

                    {/* Tombol Pembayaran */}
                    <div className="space-y-2 pt-4">
                      <button
                        onClick={() => handleCheckout(false)}
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs tracking-wider transition uppercase disabled:opacity-50 glow-btn-primary cursor-pointer"
                      >
                        {isLoading ? 'Memproses...' : '💳 Bayar via QRIS Midtrans'}
                      </button>

                      {/* OPSI MOCK BYPASS (Sangat berguna untuk peninjau lokal tanpa setup key asli) */}
                      <button
                        onClick={() => handleCheckout(true)}
                        disabled={isLoading}
                        className="w-full bg-slate-900 hover:bg-gray-800 text-gray-400 border border-white/5 font-bold py-2 rounded-lg text-[10px] transition cursor-pointer"
                      >
                        ⚡ Simulasi Bayar Instan (Bypass Midtrans)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: MY RESERVATION HISTORY */}
        {activeTab === 'history' && (
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-xl font-bold mb-6 text-white">📜 Riwayat Reservasi Anda</h2>

            {reservations.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-12 text-center">Belum ada riwayat transaksi pemesanan reservasi.</p>
            ) : (
              <div className="space-y-4">
                {reservations.map((res) => (
                  <div 
                    key={res.orderId} 
                    className="bg-slate-900/60 p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{res.orderId}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          res.status === 'settlement' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-950 text-amber-400 border border-amber-500/20'
                        }`}>
                          {res.status === 'settlement' ? 'Lunas' : 'Menunggu Pembayaran'}
                        </span>
                      </div>
                      
                      <div className="font-bold text-gray-200 text-base mt-2">🏢 {res.cafeName}</div>
                      
                      <div className="text-gray-400 mt-2 max-w-xl">
                        <strong className="text-gray-300">Detail Pesanan:</strong>{' '}
                        {res.itemsOrdered && res.itemsOrdered.length > 0 
                          ? res.itemsOrdered.map(i => `${i.name} (x${i.quantity})`).join(', ') 
                          : 'Kopi & Reservasi Tempat'}
                      </div>
                    </div>

                    <div className="text-left md:text-right min-w-[120px]">
                      <div className="text-[10px] text-gray-400">Total Nominal</div>
                      <div className="text-lg font-black text-blue-400">{formatRp(res.grossAmount)}</div>
                      <div className="text-[9px] text-gray-500 mt-1">
                        {new Date(res.createdAt).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}