// app/cafe/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { dbService, Cafe, MenuItem, Reservation, UserProfile } from '@/lib/dbService';

export default function CafeOwnerPage() {
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // Form states untuk menu baru / edit menu
  const [menuId, setMenuId] = useState('');
  const [menuName, setMenuName] = useState('');
  const [menuPrice, setMenuPrice] = useState(0);
  const [menuDesc, setMenuDesc] = useState('');
  const [menuImg, setMenuImg] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    dbService.getCurrentUser().then((u) => {
      setActiveUser(u);
      if (u?.role !== 'cafe_owner') {
        // Otomatis login sebagai cafe owner 1 untuk kemudahan demo
        dbService.quickLogin('cafe_owner', 'cafe-1');
      } else {
        loadCafeData(u.cafeId || 'cafe-1');
      }
    });
  }, []);

  const loadCafeData = async (cafeId: string) => {
    setIsLoading(true);
    try {
      const cafeDetails = await dbService.getCafeById(cafeId);
      if (cafeDetails) {
        setCafe(cafeDetails);
        const cafeReservations = await dbService.getReservationsByCafe(cafeId);
        setReservations(cafeReservations);
      }
    } catch (e) {
      console.error("Gagal memuat data kafe", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafe || !menuName || menuPrice <= 0) return;
    setIsLoading(true);
    setMessage('');

    try {
      let updatedMenu = [...(cafe.menu || [])];

      if (isEditing) {
        // Mode EDIT menu
        updatedMenu = updatedMenu.map(item => {
          if (item.id === menuId) {
            return {
              id: item.id,
              name: menuName,
              price: menuPrice,
              description: menuDesc,
              imageUrl: menuImg || item.imageUrl
            };
          }
          return item;
        });
      } else {
        // Mode TAMBAH menu baru
        const newItem: MenuItem = {
          id: `item-${Date.now()}`,
          name: menuName,
          price: menuPrice,
          description: menuDesc,
          imageUrl: menuImg || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500'
        };
        updatedMenu.push(newItem);
      }

      await dbService.updateCafeMenu(cafe.id, updatedMenu);
      setMessage(isEditing ? '✅ Menu berhasil diperbarui!' : '✅ Menu baru berhasil ditambahkan!');
      
      // Reset form
      setMenuId('');
      setMenuName('');
      setMenuPrice(0);
      setMenuDesc('');
      setMenuImg('');
      setIsEditing(false);

      // Refresh data
      await loadCafeData(cafe.id);
    } catch (err: any) {
      setMessage(`❌ Gagal menyimpan menu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (item: MenuItem) => {
    setIsEditing(true);
    setMenuId(item.id);
    setMenuName(item.name);
    setMenuPrice(item.price);
    setMenuDesc(item.description);
    setMenuImg(item.imageUrl);
  };

  const handleDeleteMenu = async (itemId: string) => {
    if (!cafe) return;
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini?')) return;
    setIsLoading(true);
    setMessage('');

    try {
      const updatedMenu = (cafe.menu || []).filter(item => item.id !== itemId);
      await dbService.updateCafeMenu(cafe.id, updatedMenu);
      setMessage('✅ Menu berhasil dihapus!');
      await loadCafeData(cafe.id);
    } catch (err: any) {
      setMessage(`❌ Gagal menghapus menu: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMenuId('');
    setMenuName('');
    setMenuPrice(0);
    setMenuDesc('');
    setMenuImg('');
  };

  if (!cafe) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Memuat Portal Kafe Anda...</p>
        </div>
      </div>
    );
  }

  // Kalkulasi statistik kafe
  const settledReservations = reservations.filter(r => r.status === 'settlement');
  const totalSales = settledReservations.reduce((acc, r) => acc + r.itemPrice, 0);
  const pendingPayout = cafe.balance || 0;
  const receivedPayout = cafe.transferredBalance || 0;

  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6">
        
        {/* DETAIL PROFILE KAFE */}
        <div className="glass-panel p-6 rounded-2xl mb-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <img 
            src={cafe.imageUrl} 
            alt={cafe.name} 
            className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-xl border border-white/10"
          />

          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-white">{cafe.name}</h1>
            <p className="text-gray-400 text-xs mt-1 md:max-w-2xl">{cafe.description}</p>
            <p className="text-gray-500 text-[11px] mt-2">📍 {cafe.address}</p>
          </div>

          <button 
            onClick={() => loadCafeData(cafe.id)} 
            disabled={isLoading}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-white/5 text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            {isLoading ? 'Memproses...' : '🔄 Refresh Dashboard'}
          </button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex justify-between items-center ${
            message.startsWith('❌') 
              ? 'bg-red-950/40 text-red-400 border-red-500/20' 
              : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
          }`}>
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-xs opacity-50 hover:opacity-100">Tutup</button>
          </div>
        )}

        {/* 1. KARTU RINGKASAN SALDO KAFE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6 rounded-2xl">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">Total Pendapatan Bersih Kafe</div>
            <div className="text-2xl font-black text-white">{formatRp(totalSales)}</div>
            <div className="text-[10px] text-gray-500 mt-2">Akumulasi seluruh transaksi reservasi yang berstatus lunas</div>
          </div>

          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-amber-500">
            <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1">Saldo Tertunda (Escrow Platform)</div>
            <div className="text-2xl font-black text-amber-400">{formatRp(pendingPayout)}</div>
            <div className="text-[10px] text-gray-500 mt-2">Dipegang platform & akan ditransfer Admin malam ini</div>
          </div>

          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-emerald-500">
            <div className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1">Saldo Sudah Diterima (Sukses TF)</div>
            <div className="text-2xl font-black text-emerald-400">{formatRp(receivedPayout)}</div>
            <div className="text-[10px] text-gray-500 mt-2">Sudah ditransfer oleh Admin ke rekening Anda</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* KOLOM KIRI & TENGAH: MANAJEMEN MENU */}
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">📋 Daftar Menu Kafe Anda</h2>
                <span className="text-xs text-gray-400">{cafe.menu?.length || 0} Item Tersedia</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(!cafe.menu || cafe.menu.length === 0) ? (
                  <p className="text-xs text-gray-500 italic py-6 col-span-2 text-center">Belum ada menu. Silakan tambahkan menu baru di form sebelah kanan.</p>
                ) : (
                  cafe.menu.map((item) => (
                    <div key={item.id} className="bg-slate-900/40 p-4 rounded-xl border border-white/5 flex gap-4 items-start">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name} 
                        className="w-16 h-16 object-cover rounded-lg border border-white/5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white text-sm truncate">{item.name}</div>
                        <div className="text-emerald-400 font-bold text-xs mt-0.5">{formatRp(item.price)}</div>
                        <p className="text-gray-400 text-[10px] mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                        
                        <div className="flex gap-3 mt-3 pt-2 border-t border-white/5">
                          <button 
                            onClick={() => handleEditClick(item)}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition"
                          >
                            ✏️ Edit Harga/Detail
                          </button>
                          <button 
                            onClick={() => handleDeleteMenu(item.id)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 transition"
                          >
                            🗑️ Hapus
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TABEL TRANSAKSI MASUK KAFE */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-4 text-white">💰 Histori Transaksi Masuk</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase font-black">
                      <th className="pb-3">Order ID / Pelanggan</th>
                      <th className="pb-3">Menu Dipesan</th>
                      <th className="pb-3">Net Kafe</th>
                      <th className="pb-3">Status QRIS</th>
                      <th className="pb-3">Payout Transfer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reservations.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-500">Belum ada pemesanan masuk</td>
                      </tr>
                    ) : (
                      reservations.map((trx) => (
                        <tr key={trx.orderId} className="hover:bg-white/5 transition-colors">
                          <td className="py-4">
                            <div className="font-bold text-white">{trx.orderId}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{trx.customerName}</div>
                          </td>
                          <td className="py-4">
                            <div className="max-w-xs truncate text-[11px] text-gray-300">
                              {trx.itemsOrdered && trx.itemsOrdered.length > 0 
                                ? trx.itemsOrdered.map(i => `${i.name} (${i.quantity}x)`).join(', ')
                                : 'Reservasi Meja & Kopi'}
                            </div>
                          </td>
                          <td className="py-4 font-bold text-emerald-400">{formatRp(trx.itemPrice)}</td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              trx.status === 'settlement' 
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-950 text-amber-400 border border-amber-500/20'
                            }`}>
                              {trx.status === 'settlement' ? 'Lunas' : 'Pending'}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              trx.payoutStatus === 'transferred'
                                ? 'bg-blue-950 text-blue-400 border border-blue-500/20'
                                : 'bg-slate-900 text-gray-500 border border-white/5'
                            }`}>
                              {trx.payoutStatus === 'transferred' ? 'Sudah TF' : 'Tertunda'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: FORM TAMBAH / EDIT MENU */}
          <div>
            <div className="glass-panel p-6 rounded-2xl sticky top-28">
              <h3 className="text-xl font-bold mb-4 text-white">
                {isEditing ? '✏️ Edit Item Menu' : '➕ Tambah Menu Baru'}
              </h3>
              <p className="text-xs text-gray-400 mb-6">
                Ubah harga, detail deskripsi, nama menu, atau tambahkan item kuliner baru untuk kafe Anda.
              </p>

              <form onSubmit={handleSaveMenu} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nama Menu (Wajib)</label>
                  <input 
                    type="text" 
                    value={menuName}
                    onChange={e => setMenuName(e.target.value)}
                    placeholder="e.g. Kopi Susu Creamy"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Harga Bersih Menu (Rp) (Wajib)</label>
                  <input 
                    type="number" 
                    value={menuPrice || ''}
                    onChange={e => setMenuPrice(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 25000"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <span className="text-[9px] text-gray-500 mt-1 block">Ini harga bersih yang akan Anda terima (belum termasuk app fee Rp 2.000).</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Deskripsi Hidangan</label>
                  <textarea 
                    value={menuDesc}
                    onChange={e => setMenuDesc(e.target.value)}
                    placeholder="e.g. Espresso blend arabika robusta dengan krimer nabati super creamy..."
                    rows={3}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">URL Gambar Menu</label>
                  <input 
                    type="text" 
                    value={menuImg}
                    onChange={e => setMenuImg(e.target.value)}
                    placeholder="e.g. https://images.unsplash.com/..."
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg text-xs transition cursor-pointer"
                  >
                    {isLoading ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah ke Menu'}
                  </button>
                  
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-400 border border-white/5 font-bold px-4 py-2.5 rounded-lg text-xs transition cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
