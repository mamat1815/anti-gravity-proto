// app/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { dbService, Cafe, Reservation, Payout, UserProfile } from '@/lib/dbService';

export default function AdminPage() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);

  // Form states untuk Kafe Baru
  const [newCafeName, setNewCafeName] = useState('');
  const [newCafeDesc, setNewCafeDesc] = useState('');
  const [newCafeAddress, setNewCafeAddress] = useState('');
  const [newCafeImage, setNewCafeImage] = useState('');
  const [newCafeOwnerEmail, setNewCafeOwnerEmail] = useState('');
  const [newCafeOwnerName, setNewCafeOwnerName] = useState('');

  // Payout Modal/Form states
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [bankName, setBankName] = useState('Bank Mandiri');
  const [bankAccount, setBankAccount] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Pastikan user adalah admin
    dbService.getCurrentUser().then((u) => {
      setActiveUser(u);
      if (u?.role !== 'admin') {
        // Otomatis arahkan ke Quick Login Admin untuk kebutuhan demo
        dbService.quickLogin('admin');
      }
    });

    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allCafes = await dbService.getCafes();
      const allReservations = await dbService.getReservations();
      const allPayouts = await dbService.getPayouts();
      
      setCafes(allCafes);
      setReservations(allReservations);
      setPayouts(allPayouts);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCafeName || !newCafeOwnerEmail) return;
    setIsLoading(true);
    setMessage('');
    
    try {
      // 1. Buat/Daftarkan User Owner Kafe terlebih dahulu
      const ownerProfile = await dbService.register(
        newCafeOwnerEmail,
        newCafeOwnerName || `${newCafeName} Owner`,
        'cafe_owner',
        '' // cafeId akan diset setelah kafe dibuat
      );

      // 2. Buat profil Kafe
      const createdCafe = await dbService.createCafe(
        newCafeName,
        newCafeDesc,
        newCafeAddress,
        newCafeImage,
        ownerProfile.uid
      );

      // 3. Update profil user agar terhubung dengan ID kafe baru
      // Dalam Mock mode ini otomatis, di Firebase kita set cafeId ke owner profile
      if (typeof window !== 'undefined') {
        // Untuk mock kita perbarui user dengan meng-onboard cafeId
        const savedUsers = JSON.parse(localStorage.getItem('ag_users') || '[]');
        const idx = savedUsers.findIndex((u: any) => u.uid === ownerProfile.uid);
        if (idx !== -1) {
          savedUsers[idx].cafeId = createdCafe.id;
          localStorage.setItem('ag_users', JSON.stringify(savedUsers));
        }
      }

      // Reset form
      setNewCafeName('');
      setNewCafeDesc('');
      setNewCafeAddress('');
      setNewCafeImage('');
      setNewCafeOwnerEmail('');
      setNewCafeOwnerName('');
      setMessage(`✅ Kafe "${createdCafe.name}" & Pemilik berhasil didaftarkan!`);
      
      await loadData();
    } catch (err: any) {
      setMessage(`❌ Gagal onboarding: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCafe || !bankAccount) return;
    setIsLoading(true);
    setMessage('');

    try {
      // Panggil service untuk memproses pencairan
      const payoutResult = await dbService.processPayout(selectedCafe.id, bankName, bankAccount);
      
      // Jika Firebase Admin terkonfigurasi, kita juga panggil API Route untuk sinkronisasi DB server
      try {
        await fetch('/api/payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cafeId: selectedCafe.id,
            bankName,
            bankAccount
          })
        });
      } catch (err) {
        // Abaikan error API Route jika dalam client mock saja
      }

      setMessage(`✅ Dana Payout sebesar Rp ${payoutResult.amount.toLocaleString('id-ID')} telah sukses ditransfer ke ${selectedCafe.name}!`);
      setSelectedCafe(null);
      setBankAccount('');
      
      await loadData();
    } catch (err: any) {
      setMessage(`❌ Gagal Payout: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Kalkulasi total ledger platform
  const settledTrx = reservations.filter(r => r.status === 'settlement');
  const totalVolume = settledTrx.reduce((acc, r) => acc + r.grossAmount, 0);
  const totalAppFee = settledTrx.reduce((acc, r) => acc + r.appFee, 0);
  const totalCafeShare = settledTrx.reduce((acc, r) => acc + r.itemPrice, 0);

  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 pb-12">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">👑 Portal Admin Platform</h1>
            <p className="text-gray-400 text-sm">Kelola kafe terdaftar, pantau volume keuangan, dan proses pencairan dana.</p>
          </div>
          <button 
            onClick={loadData} 
            disabled={isLoading}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-white/5 text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            {isLoading ? 'Memuat...' : '🔄 Refresh Data'}
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

        {/* 1. KARTU STATISTIK PLATFORM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass-card p-6 rounded-2xl">
            <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">Volume Transaksi QRIS (Gross)</div>
            <div className="text-2xl font-black text-white">{formatRp(totalVolume)}</div>
            <div className="text-[10px] text-gray-500 mt-2">Total pembayaran masuk ke escrow platform</div>
          </div>
          
          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-500">
            <div className="text-xs font-black text-blue-400 uppercase tracking-wider mb-1">Pendapatan Platform (App Fee)</div>
            <div className="text-2xl font-black text-blue-400">{formatRp(totalAppFee)}</div>
            <div className="text-[10px] text-gray-500 mt-2">Potongan biaya jasa Rp 2.000 / transaksi</div>
          </div>

          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-amber-500">
            <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1">Total Saldo Kafe Tertunda</div>
            <div className="text-2xl font-black text-amber-400">
              {formatRp(cafes.reduce((acc, c) => acc + (c.balance || 0), 0))}
            </div>
            <div className="text-[10px] text-gray-500 mt-2">Uang yang akan ditransfer malam ini</div>
          </div>

          <div className="glass-card p-6 rounded-2xl border-l-4 border-l-emerald-500">
            <div className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-1">Total Saldo Sukses Ditransfer</div>
            <div className="text-2xl font-black text-emerald-400">
              {formatRp(cafes.reduce((acc, c) => acc + (c.transferredBalance || 0), 0))}
            </div>
            <div className="text-[10px] text-gray-500 mt-2">Pencairan dana kafe yang sukses diproses</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* KOLOM KIRI & TENGAH: PENGELOLAAN SALDO KAFE & LOG PAYOUT */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* PANEL PENCAIRAN DANA KAFE */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <span>🏦 Panel Payout (Transfer Malam Hari)</span>
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                Daftar saldo hak kafe dari transaksi reservasi pelanggan. Klik **"Kirim Transfer"** setelah melakukan transfer manual ke bank kafe.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase font-black tracking-wider">
                      <th className="pb-3">Kafe & ID</th>
                      <th className="pb-3">Saldo Tertunda</th>
                      <th className="pb-3">Sudah Ditransfer</th>
                      <th className="pb-3 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cafes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500">Belum ada kafe terdaftar</td>
                      </tr>
                    ) : (
                      cafes.map((cafe) => (
                        <tr key={cafe.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 font-medium">
                            <div className="font-bold text-white text-sm">{cafe.name}</div>
                            <div className="text-gray-500 text-[10px]">{cafe.id}</div>
                          </td>
                          <td className="py-4 font-semibold text-amber-400">
                            {formatRp(cafe.balance || 0)}
                          </td>
                          <td className="py-4 text-emerald-400">
                            {formatRp(cafe.transferredBalance || 0)}
                          </td>
                          <td className="py-4 text-right">
                            {(cafe.balance || 0) > 0 ? (
                              <button
                                onClick={() => setSelectedCafe(cafe)}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-1.5 rounded text-[11px] transition cursor-pointer"
                              >
                                Kirim Transfer
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-500 italic bg-gray-900 px-2 py-1 rounded">Settle</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FORM MODAL TRANSFER MANUAL */}
            {selectedCafe && (
              <div className="glass-panel p-6 rounded-2xl border-2 border-amber-500/30 bg-slate-900/90 relative pulse-glow">
                <button 
                  onClick={() => setSelectedCafe(null)} 
                  className="absolute top-4 right-4 text-gray-400 hover:text-white text-xs font-bold"
                >
                  ✕ Batal
                </button>
                <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <span className="text-amber-500">💰 Proses Payout:</span> {selectedCafe.name}
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Simulasikan transfer dana sebesar <strong className="text-amber-400">{formatRp(selectedCafe.balance)}</strong> dari platform ke rekening pemilik kafe.
                </p>

                <form onSubmit={handlePayoutSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Bank Penerima</label>
                      <select 
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="Bank Mandiri">Bank Mandiri</option>
                        <option value="BCA">BCA</option>
                        <option value="BNI">BNI</option>
                        <option value="BRI">BRI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nomor Rekening (Wajib)</label>
                      <input 
                        type="text" 
                        value={bankAccount}
                        onChange={e => setBankAccount(e.target.value)}
                        placeholder="e.g. 182901229302"
                        className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded text-xs transition cursor-pointer"
                  >
                    {isLoading ? 'Memproses Transfer...' : `Konfirmasi Transfer ${formatRp(selectedCafe.balance)} Now`}
                  </button>
                </form>
              </div>
            )}

            {/* LOG RIWAYAT TRANSFER (PAYOUTS) */}
            <div className="glass-panel p-6 rounded-2xl">
              <h2 className="text-lg font-bold mb-4 text-white">📜 Mutasi Riwayat Payouts Kafe</h2>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {payouts.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Belum ada riwayat pencairan dana</p>
                ) : (
                  payouts.map((pay) => (
                    <div key={pay.id} className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-xs flex justify-between items-start gap-4">
                      <div>
                        <div className="font-bold text-white">{pay.cafeName}</div>
                        <div className="text-[10px] text-gray-400 mt-1">
                          Transfer via **{pay.bankName}** (`{pay.bankAccount}`)
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">ID: {pay.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-emerald-400 text-sm">+{formatRp(pay.amount)}</div>
                        <div className="text-[9px] text-gray-500 mt-1">{new Date(pay.timestamp).toLocaleString('id-ID')}</div>
                        <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold uppercase mt-2 inline-block">
                          Sukses
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* KOLOM KANAN: FORM ONBOARD KAFE BARU */}
          <div>
            <div className="glass-panel p-6 rounded-2xl sticky top-28">
              <h2 className="text-xl font-bold mb-4 text-white">🏬 Daftarkan Kafe Baru</h2>
              <p className="text-xs text-gray-400 mb-6">
                Tambahkan outlet kafe baru ke dalam platform dan buatkan akun khusus untuk pengelola kafe tersebut.
              </p>

              <form onSubmit={handleCreateCafe} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nama Kafe (Wajib)</label>
                  <input 
                    type="text" 
                    value={newCafeName}
                    onChange={e => setNewCafeName(e.target.value)}
                    placeholder="e.g. Cafe Anti Gravitasi"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Alamat Kafe</label>
                  <input 
                    type="text" 
                    value={newCafeAddress}
                    onChange={e => setNewCafeAddress(e.target.value)}
                    placeholder="e.g. Jl. Thamrin No. 12"
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Deskripsi Singkat</label>
                  <textarea 
                    value={newCafeDesc}
                    onChange={e => setNewCafeDesc(e.target.value)}
                    placeholder="e.g. Menyediakan cold brew terbaik dengan biji kopi premium..."
                    rows={3}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">URL Gambar Kafe</label>
                  <input 
                    type="text" 
                    value={newCafeImage}
                    onChange={e => setNewCafeImage(e.target.value)}
                    placeholder="e.g. https://unsplash.com/..."
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="border-t border-white/5 pt-4">
                  <div className="text-[10px] font-bold text-blue-400 uppercase mb-3">Akun Pemilik / Pengelola Kafe:</div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nama Pemilik</label>
                      <input 
                        type="text" 
                        value={newCafeOwnerName}
                        onChange={e => setNewCafeOwnerName(e.target.value)}
                        placeholder="e.g. Pak Mulyono"
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Email Pemilik (Wajib)</label>
                      <input 
                        type="email" 
                        value={newCafeOwnerEmail}
                        onChange={e => setNewCafeOwnerEmail(e.target.value)}
                        placeholder="e.g. mulyono@cafe.com"
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                      <span className="text-[9px] text-gray-500 mt-1 block">Akun akan otomatis didaftarkan ke Database. Password default: `password123`.</span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition mt-4 cursor-pointer"
                >
                  {isLoading ? 'Mendaftarkan Kafe...' : '🚀 Daftarkan & Buat Akun'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
