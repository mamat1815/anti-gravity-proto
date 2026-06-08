// app/setup/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';

export default function SetupPage() {
  const [apiKey, setApiKey] = useState('');
  const [authDomain, setAuthDomain] = useState('');
  const [projectId, setProjectId] = useState('');
  const [storageBucket, setStorageBucket] = useState('');
  const [messagingSenderId, setMessagingSenderId] = useState('');
  const [appId, setAppId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Ambil custom config jika ada
    const saved = localStorage.getItem('firebase_custom_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setApiKey(config.apiKey || '');
        setAuthDomain(config.authDomain || '');
        setProjectId(config.projectId || '');
        setStorageBucket(config.storageBucket || '');
        setMessagingSenderId(config.messagingSenderId || '');
        setAppId(config.appId || '');
        setIsSaved(true);
      } catch (e) {}
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !projectId) {
      setStatusMsg('❌ API Key dan Project ID wajib diisi!');
      return;
    }

    const config = {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
    };

    localStorage.setItem('firebase_custom_config', JSON.stringify(config));
    setStatusMsg('✅ Konfigurasi Firebase berhasil disimpan ke browser! Me-refresh halaman...');
    setIsSaved(true);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleClear = () => {
    localStorage.removeItem('firebase_custom_config');
    setApiKey('');
    setAuthDomain('');
    setProjectId('');
    setStorageBucket('');
    setMessagingSenderId('');
    setAppId('');
    setStatusMsg('🧹 Konfigurasi Firebase dihapus. Kembali menggunakan Mock (LocalStorage).');
    setIsSaved(false);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 pb-12">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6">
        <div className="glass-panel p-8 rounded-2xl border border-white/10 relative overflow-hidden">
          {/* Accent decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          
          <h1 className="text-3xl font-black mb-2 text-white">⚙️ Konfigurasi Firebase</h1>
          <p className="text-gray-400 mb-8 text-sm">
            Atur koneksi Firebase Firestore dan Auth di sini. Jika kosong, sistem otomatis menggunakan simulator lokal (**Mock Mode via LocalStorage**) agar Anda langsung bisa mencobanya.
          </p>

          {statusMsg && (
            <div className={`mb-6 p-4 rounded-xl border text-sm font-medium ${
              statusMsg.startsWith('✅') 
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20' 
                : 'bg-blue-950/40 text-blue-400 border-blue-500/20'
            }`}>
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Project ID (Wajib)</label>
                <input 
                  type="text" 
                  value={projectId} 
                  onChange={e => setProjectId(e.target.value)} 
                  placeholder="e.g. anti-gravity-cafe" 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">API Key (Wajib)</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="AIzaSy..." 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Auth Domain</label>
                <input 
                  type="text" 
                  value={authDomain} 
                  onChange={e => setAuthDomain(e.target.value)} 
                  placeholder="project-id.firebaseapp.com" 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Storage Bucket</label>
                <input 
                  type="text" 
                  value={storageBucket} 
                  onChange={e => setStorageBucket(e.target.value)} 
                  placeholder="project-id.appspot.com" 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">Messaging Sender ID</label>
                <input 
                  type="text" 
                  value={messagingSenderId} 
                  onChange={e => setMessagingSenderId(e.target.value)} 
                  placeholder="82910..." 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5">App ID</label>
                <input 
                  type="text" 
                  value={appId} 
                  onChange={e => setAppId(e.target.value)} 
                  placeholder="1:82910:web:..." 
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg transition duration-200 cursor-pointer"
              >
                Simpan Konfigurasi
              </button>
              
              {isSaved && (
                <button 
                  type="button" 
                  onClick={handleClear}
                  className="bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600 hover:text-white font-bold text-sm px-6 py-2.5 rounded-lg transition duration-200 cursor-pointer"
                >
                  Reset ke Mock DB
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-8 bg-slate-900/60 border border-white/5 p-6 rounded-2xl">
          <h2 className="text-lg font-bold mb-4 text-blue-400">💡 Cara Mengaktifkan Firebase</h2>
          <ol className="list-decimal list-inside space-y-3 text-xs text-gray-400 leading-relaxed">
            <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Firebase Console</a> dan buat project baru.</li>
            <li>Aktifkan **Authentication** dengan metode masuk **Email/Password**.</li>
            <li>Aktifkan **Cloud Firestore Database** dalam mode uji coba (Test Mode).</li>
            <li>Masuk ke Pengaturan Project (Project Settings) dan buat aplikasi berbasis **Web**.</li>
            <li>Salin objek `firebaseConfig` yang muncul di layar, lalu masukkan nilai-nilai di atas.</li>
            <li>Jika ingin integrasi server-side otomatis (API checkout & webhook): tambahkan environment variables di `.env.local` Anda dengan private key dari Admin SDK service account Firebase Anda (baca berkas `.env.example`).</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
