import React, { useRef, useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { downloadAllDataCSV, formatINR } from '../utils/formatters';
import { downloadCommunityMasterReportPDF } from '../utils/pdfGenerator';
import {
  X,
  Shield,
  KeyRound,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Info,
  Check,
  AlertTriangle,
  Lock,
  Unlock,
  Wallet,
  ArrowDownLeft,
  DollarSign,
  Cloud,
  RefreshCw,
  Smartphone,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    events,
    expenses,
    members,
    transactions,
    openingBalance,
    totalCollected,
    setOpeningBalance,
    setTotalCollected,
    isAdminUnlocked,
    sharedPin,
    openPinModal,
    lockAdmin,
    resetToDefaults,
    eraseAllData,
    exportToJSON,
    importFromJSON,
    requireAuth,
    cloudSyncStatus,
    lastCloudSync,
    forceSyncToCloud,
  } = useFinance();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string }>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);

  // Fund balance inputs
  const [openingInput, setOpeningInput] = useState(openingBalance.toString());
  const [collectedInput, setCollectedInput] = useState(totalCollected.toString());
  const [fundSavedToast, setFundSavedToast] = useState(false);

  useEffect(() => {
    setOpeningInput(openingBalance.toString());
    setCollectedInput(totalCollected.toString());
  }, [openingBalance, totalCollected, isOpen]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    await forceSyncToCloud();
    setIsSyncingManual(false);
    setImportStatus({ success: true, message: 'Cloud synchronization refreshed! All devices in sync.' });
  };

  const handleSaveFundSettings = (e: React.FormEvent) => {
    e.preventDefault();
    requireAuth(() => {
      const openVal = parseFloat(openingInput) || 0;
      const collVal = parseFloat(collectedInput) || 0;
      setOpeningBalance(openVal);
      setTotalCollected(collVal);
      setFundSavedToast(true);
      setTimeout(() => setFundSavedToast(false), 3000);
    });
  };

  const handleExportJSON = () => {
    const jsonStr = exportToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tm_ISHAL_Finance_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    requireAuth(() => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const res = importFromJSON(content);
        setImportStatus(res);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    });
  };

  const handleResetData = () => {
    requireAuth(() => {
      eraseAllData();
      setShowResetConfirm(false);
      setImportStatus({ success: true, message: 'All app data permanently erased successfully!' });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <Shield className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">Settings & Backup</h3>
              <p className="text-[11px] text-slate-400 font-medium">Tm ISHAL Financial Management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-4.5 overflow-y-auto bg-[#0D1527]">
          {/* Status feedback */}
          {importStatus.message && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                importStatus.success
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-semibold'
                  : 'bg-rose-950/60 border border-rose-800/80 text-rose-300 font-semibold'
              }`}
            >
              {importStatus.success ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Cloud Synchronization Section */}
          <div className="bg-[#111A2E] border border-blue-900/50 rounded-3xl p-4.5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-blue-400" />
                Live Cloud Sync Across Phones
              </h4>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold border border-emerald-800/80 bg-emerald-950/70 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{cloudSyncStatus === 'connected' ? 'Cloud Connected' : cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Local Mode'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#0B1323] border border-slate-800/80 rounded-2xl">
              <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-200">
                  Universal Multi-Device Ledger
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  All devices (phones, tablets, PCs) share the exact same live ledger. Any entry added or updated on one phone synchronizes automatically with all other phones in real time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[11px] text-slate-400">
              <span>
                {lastCloudSync ? `Last synced: ${lastCloudSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Auto-sync active'}
              </span>
              <button
                onClick={handleManualSync}
                disabled={isSyncingManual}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold text-[11px] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingManual ? 'animate-spin' : ''}`} />
                <span>{isSyncingManual ? 'Syncing...' : 'Sync Cloud Now'}</span>
              </button>
            </div>
          </div>

          {/* Section 1: Authentication & PIN */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-4.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-400" />
              Shared Access & PIN
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {isAdminUnlocked ? 'Admin Mode Active' : 'Viewing Only (Locked)'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Admin PIN: <span className="font-mono-num text-blue-400 font-bold tracking-wider">{isAdminUnlocked ? sharedPin : '••••'}</span>
                </p>
              </div>
              {isAdminUnlocked ? (
                <button
                  onClick={lockAdmin}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl flex items-center gap-1.5 transition-colors border border-slate-700"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Lock
                </button>
              ) : (
                <button
                  onClick={() => openPinModal()}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-colors active:scale-95"
                >
                  <Unlock className="w-3.5 h-3.5 stroke-[2.4px]" />
                  Unlock Admin
                </button>
              )}
            </div>

            {isAdminUnlocked && (
              <div className="pt-2.5 border-t border-slate-800">
                <button
                  onClick={() => openPinModal()}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                >
                  Change Admin PIN →
                </button>
              </div>
            )}
          </div>

          {/* Section 1.5: Community Fund Setup (Total Collected Amount / Revenue) */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-blue-400" />
                Community Revenue & Fund Pool
              </h4>
              {fundSavedToast && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-400 font-medium">
              Configure total collected revenue and member subscriptions for the community treasury.
            </p>

            <form onSubmit={handleSaveFundSettings} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <span>Total Collected / Revenue (₹)</span>
                </label>
                <input
                  type="number"
                  value={collectedInput}
                  onChange={(e) => setCollectedInput(e.target.value)}
                  className="w-full bg-[#0B1323] border border-slate-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-emerald-400 font-mono-num focus:outline-none focus:border-blue-500"
                  placeholder="95000"
                />
                <span className="text-[10px] text-slate-500 block">Total member contributions and collected funds</span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-colors active:scale-[0.99]"
              >
                <Check className="w-3.5 h-3.5 stroke-[2.4px]" />
                Update Collected Revenue
              </button>
            </form>
          </div>

          {/* Section 2: Export & Spreadsheet */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-4.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-400" />
              Export & Financial Reports
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Download well-designed PDF reports for auditing or offline statements, or export raw data for spreadsheets.
            </p>

            {/* Featured PDF Download Button */}
            <button
              onClick={() => downloadCommunityMasterReportPDF(events, expenses, members, totalCollected, openingBalance, transactions)}
              className="w-full p-4 bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-blue-950/70 hover:from-blue-800/70 hover:to-indigo-900/70 border border-blue-700/60 hover:border-blue-500/80 rounded-2xl text-left transition-all shadow-md flex items-center justify-between group active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30 shrink-0">
                  <FileText className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Master Financial Statement (PDF)</span>
                    <span className="text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-xs">
                      PDF
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-200/80 font-medium mt-0.5">
                    Complete income, expenses, events & treasury summary
                  </p>
                </div>
              </div>
              <Download className="w-4 h-4 text-blue-300 group-hover:translate-y-0.5 transition-transform shrink-0" />
            </button>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => downloadAllDataCSV(events, expenses, members)}
                className="p-3.5 bg-[#0B1323] hover:bg-[#15223C] border border-slate-800 rounded-2xl text-left text-xs font-medium text-slate-200 flex flex-col gap-1 transition-all shadow-xs group"
              >
                <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>All CSV Data</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono-num font-semibold">{expenses.length} total records</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="p-3.5 bg-[#0B1323] hover:bg-[#15223C] border border-slate-800 rounded-2xl text-left text-xs font-medium text-slate-200 flex flex-col gap-1 transition-all shadow-xs group"
              >
                <div className="flex items-center gap-1.5 text-white font-bold">
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>JSON Backup</span>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">Full state snapshot</span>
              </button>
            </div>
          </div>

          {/* Section 3: Restore / Import */}
          <div className="bg-[#111A2E] border border-slate-800 rounded-3xl p-4.5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-blue-400" />
              Restore from Backup
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Import a previously exported JSON backup file to restore all events, members, and expenses.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-[#0B1323] hover:bg-[#15223C] border border-slate-800 text-xs font-bold text-slate-200 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Upload className="w-4 h-4 text-blue-400 stroke-[2.2px]" />
              Select JSON Backup File
            </button>
          </div>

          {/* Section 4: Clear All Data */}
          <div className="bg-rose-950/30 border border-rose-900/60 rounded-3xl p-4.5 space-y-2.5">
            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              Clear All Data
            </h4>
            <p className="text-xs text-slate-400 font-medium">
              Erase all recorded events, expenses, members, and fund balances to start with a clean slate.
            </p>
            {showResetConfirm ? (
              <div className="bg-[#0D1527] border border-rose-800/80 p-3.5 rounded-2xl space-y-2.5 shadow-xs">
                <p className="text-xs font-bold text-rose-300">
                  Are you sure you want to permanently clear all data? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetData}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold rounded-xl text-white shadow-xs"
                  >
                    Yes, Clear All
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2.5 bg-[#0B1323] hover:bg-rose-950/40 text-rose-400 border border-rose-900/60 text-xs font-bold rounded-2xl transition-colors shadow-xs"
              >
                Clear All Data
              </button>
            )}
          </div>

          {/* About Tm ISHAL & IFO */}
          <div className="pt-2 text-center text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-300">IFO — Ishal Finance Organizer</p>
            <p>Designed for the <strong className="text-slate-200">Tm ISHAL</strong> Community</p>
            <p className="text-[11px] text-slate-500">Free, Local-First, Instant Group Accounting</p>
          </div>
        </div>
      </div>
    </div>
  );
};
