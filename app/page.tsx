// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

// Tipe Data Prototipe
interface Transaction {
  orderId: string;
  cafeName: string;
  grossAmount: number;
  netCafe: number;
  netApp: number;
  status: string;
  timestamp: string;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cafeBalance, setCafeBalance] = useState<number>(0);
  const [appBalance, setAppBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Load data dari LocalStorage saat komponen dirender
  useEffect(() => {
    const savedTrx = JSON.parse(localStorage.getItem('ag_transactions') || '[]');
    const savedCafe = parseInt(localStorage.getItem('ag_cafe_balance') || '0');
    const savedApp = parseInt(localStorage.getItem('ag_app_balance') || '0');
    
    setTransactions(savedTrx);
    setCafeBalance(savedCafe);
    setAppBalance(savedApp);
  }, []);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      // 1. Panggil API Route internal kita
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeId: 'C-001',
          cafeName: 'Cafe Anti Gravity',
          itemPrice: 20000,
          appFee: 2000
        }),
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);

      // 2. Buka Snap Popup
      window.snap.pay(data.token, {
        onSuccess: function (result: any) {
          // PROSES LEDGER (Disimpan ke LocalStorage)
          
          const newTrx: Transaction = {
            orderId: data.orderId,
            cafeName: 'Cafe Anti Gravity',
            grossAmount: data.grossAmount,
            netCafe: data.itemPrice,
            netApp: data.appFee,
            status: 'settlement',
            timestamp: new Date().toLocaleString()
          };

          const updatedTrx = [newTrx, ...transactions];
          const newCafeBalance = cafeBalance + data.itemPrice;
          const newAppBalance = appBalance + data.appFee;

          // Simpan ke State
          setTransactions(updatedTrx);
          setCafeBalance(newCafeBalance);
          setAppBalance(newAppBalance);

          // Simpan ke LocalStorage
          localStorage.setItem('ag_transactions', JSON.stringify(updatedTrx));
          localStorage.setItem('ag_cafe_balance', newCafeBalance.toString());
          localStorage.setItem('ag_app_balance', newAppBalance.toString());

          alert('Pembayaran Berhasil! Saldo Ledger telah diperbarui.');
        },
        onPending: function (result: any) {
          alert('Menunggu pembayaran Anda!');
        },
        onError: function (result: any) {
          alert('Pembayaran gagal!');
        },
        onClose: function () {
          alert('Anda menutup popup tanpa menyelesaikan pembayaran');
        }
      });

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLedger = () => {
    localStorage.removeItem('ag_transactions');
    localStorage.removeItem('ag_cafe_balance');
    localStorage.removeItem('ag_app_balance');
    setTransactions([]);
    setCafeBalance(0);
    setAppBalance(0);
  };

  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  return (
    <main className="p-8 max-w-4xl mx-auto font-sans">
      {/* Inject Midtrans Snap Script */}
      <Script 
        src="https://app.sandbox.midtrans.com/snap/snap.js" 
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="lazyOnload"
      />

      <h1 className="text-3xl font-bold mb-8 text-blue-600">Anti Gravity - Prototype</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Panel Checkout */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-xl font-semibold mb-4 border-b pb-2">Simulasi Beli Kopi</h2>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between"><span>Harga Kopi</span><span>Rp 20.000</span></div>
            <div className="flex justify-between"><span>Biaya Aplikasi</span><span>Rp 2.000</span></div>
            <div className="flex justify-between text-gray-500 text-sm"><span>Biaya QRIS (0.7%)</span><span>Dihitung otomatis</span></div>
          </div>
          <button 
            onClick={handleCheckout} 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : 'Bayar via QRIS Midtrans'}
          </button>
        </div>

        {/* Panel Ledger */}
        <div className="bg-gray-800 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-gray-600 pb-2">
            <h2 className="text-xl font-semibold text-blue-400">Live Ledger (LocalStorage)</h2>
            <button onClick={clearLedger} className="text-xs bg-red-600 px-2 py-1 rounded hover:bg-red-700">Reset</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Saldo Kafe</div>
              <div className="text-xl font-bold text-green-400">{formatRp(cafeBalance)}</div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <div className="text-sm text-gray-400">Saldo Aplikasi</div>
              <div className="text-xl font-bold text-blue-400">{formatRp(appBalance)}</div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-400 mb-2">Histori Transaksi</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada transaksi</p>
            ) : (
              transactions.map((trx, idx) => (
                <div key={idx} className="bg-gray-700 p-3 rounded text-xs flex flex-col gap-1">
                  <div className="flex justify-between font-bold">
                    <span>{trx.orderId}</span>
                    <span className="text-yellow-400">{formatRp(trx.grossAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Split: Kafe {formatRp(trx.netCafe)} | App {formatRp(trx.netApp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}