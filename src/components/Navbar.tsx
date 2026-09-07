import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Lock, Unlock, Settings, Search, X, Cloud, RefreshCw, CloudOff } from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const {
    isAdminUnlocked,
    lockAdmin,
    openPinModal,
    searchQuery,
    setSearchQuery,
    cloudSyncStatus,
    forceSyncToCloud,
  } = useFinance();

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-[#0D1527]/90 backdrop-blur-xl border-b border-slate-800/80 text-white transition-all">
      <div className="max-w-md md:max-w-4xl mx-auto px-4 sm:px-6 py-3.5">
        {isSearchOpen ? (
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search events, expenses, members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-[#131F37] border border-slate-700/80 focus:bg-[#16233E] rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {/* Logo & Brand Identity */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-extrabold text-sm tracking-wider shadow-sm shadow-blue-500/30 ring-1 ring-white/10">
                IFO
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-white leading-tight tracking-tight">
                    IFO
                  </h1>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 tracking-tight">
                  By Tm ISHAL
                </p>
              </div>
            </div>

            {/* Actions & Status */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Cloud Synchronization Status Indicator */}
              {cloudSyncStatus === 'connected' && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 rounded-xl shadow-xs"
                  title="Real-Time Cloud Synced: All phones share identical live data automatically"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Live Cloud</span>
                </div>
              )}
              {cloudSyncStatus === 'syncing' && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60 rounded-xl shadow-xs"
                  title="Syncing live data across devices..."
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="hidden sm:inline">Syncing</span>
                </div>
              )}
              {cloudSyncStatus === 'error' && (
                <button
                  onClick={() => forceSyncToCloud()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-red-950/60 text-red-400 border border-red-800/60 rounded-xl hover:bg-red-900/60 transition-colors shadow-xs"
                  title="Cloud Sync issue. Click to retry connecting."
                >
                  <CloudOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Retry Sync</span>
                </button>
              )}

              {/* Search Toggle */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all"
                title="Search records"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              {/* Status Indicator & Lock / Unlock */}
              {isAdminUnlocked ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={lockAdmin}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/70 rounded-xl hover:bg-emerald-900/60 transition-all shadow-xs"
                    title="Admin Unlocked - Click to lock"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Admin Active</span>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPinModal()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/30 transition-all active:scale-95 border border-blue-400/20"
                    title="Click to unlock Admin with PIN"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-100" />
                    <span>Admin</span>
                  </button>
                </div>
              )}

              {/* Settings */}
              <button
                onClick={onOpenSettings}
                className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all"
                title="Settings & Backup"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
