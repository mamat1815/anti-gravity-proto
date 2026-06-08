// components/Navbar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { dbService, UserProfile, isFirebaseConfigured } from '@/lib/dbService';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ambil user aktif dari dbService
    dbService.getCurrentUser().then(setUser);
  }, []);

  const handleRoleChange = (role: 'admin' | 'cafe_owner' | 'customer', cafeId?: string) => {
    dbService.quickLogin(role, cafeId);
  };

  if (!mounted) return null;

  return (
    <nav className="glass-panel sticky top-0 z-50 px-6 py-4 mb-6 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-wider text-blue-500 font-mono">
              ANTI<span className="text-white">GRAVITY</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1.0
            </span>
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="flex items-center flex-wrap gap-2 text-sm">
          <Link 
            href="/" 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              pathname === '/' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ☕ Jelajah Kafe
          </Link>

          {user?.role === 'cafe_owner' && (
            <Link 
              href="/cafe" 
              className={`px-4 py-2 rounded-lg font-medium transition ${
                pathname === '/cafe' 
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🏬 Portal Kafe
            </Link>
          )}

          {user?.role === 'admin' && (
            <Link 
              href="/admin" 
              className={`px-4 py-2 rounded-lg font-medium transition ${
                pathname === '/admin' 
                  ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              👑 Portal Admin
            </Link>
          )}

          <Link 
            href="/setup" 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              pathname === '/setup' 
                ? 'bg-gray-600/20 text-gray-300 border border-gray-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ⚙️ Setup Firebase
          </Link>
        </div>

        {/* Database & Role Quick Switcher Panel */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Status Database */}
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-black/40">
            <span className={`w-2 h-2 rounded-full ${isFirebaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={isFirebaseConfigured ? 'text-emerald-400' : 'text-amber-400'}>
              {isFirebaseConfigured ? 'Firebase Firestore' : 'Mock (LocalStorage)'}
            </span>
          </div>

          {/* User Info / Role Selector */}
          <div className="flex items-center gap-2 bg-gray-800/80 border border-white/5 rounded-lg px-3 py-1.5">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-white leading-tight">{user?.name || 'Tamu'}</div>
              <div className="text-[10px] text-gray-400 capitalize">{user?.role ? user.role.replace('_', ' ') : 'customer'}</div>
            </div>
            
            <div className="border-l border-white/10 h-6 mx-1 hidden sm:block" />
            
            {/* Quick Switch Dropdown */}
            <div className="relative group">
              <button className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white text-xs font-bold px-2 py-1 rounded transition flex items-center gap-1">
                <span>Ganti Peran</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className="absolute right-0 mt-2 w-56 glass-card bg-slate-900 rounded-lg shadow-xl border border-white/10 py-1 hidden group-hover:block z-50">
                <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase font-black border-b border-white/5">
                  Pilih Peran Demo:
                </div>
                <button 
                  onClick={() => handleRoleChange('customer')} 
                  className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-blue-600 hover:text-white transition flex items-center gap-2"
                >
                  👤 Pelanggan (Budi)
                </button>
                <button 
                  onClick={() => handleRoleChange('cafe_owner', 'cafe-1')} 
                  className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-emerald-600 hover:text-white transition flex items-center gap-2"
                >
                  🏬 Pemilik Kafe 1 (Senja)
                </button>
                <button 
                  onClick={() => handleRoleChange('cafe_owner', 'cafe-2')} 
                  className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-emerald-600 hover:text-white transition flex items-center gap-2"
                >
                  🏬 Pemilik Kafe 2 (Gravity)
                </button>
                <button 
                  onClick={() => handleRoleChange('admin')} 
                  className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-violet-600 hover:text-white transition flex items-center gap-2"
                >
                  👑 Admin Platform (Mamat)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
