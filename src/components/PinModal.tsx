import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Lock, Unlock, X, KeyRound, Check, AlertCircle, Delete } from 'lucide-react';

export const PinModal: React.FC = () => {
  const {
    isPinModalOpen,
    closePinModal,
    unlockWithPin,
    isAdminUnlocked,
    sharedPin,
    changePin
  } = useFinance();

  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState<'unlock' | 'change'>('unlock');

  // For change PIN
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changeSuccess, setChangeSuccess] = useState('');

  if (!isPinModalOpen) return null;

  const handleNumpadClick = (digit: string) => {
    setErrorMsg('');
    if (pinInput.length < 6) {
      const next = pinInput + digit;
      setPinInput(next);
      if (next.length === 4) {
        // Auto-check on 4 digits
        const ok = unlockWithPin(next);
        if (!ok) {
          setErrorMsg('Incorrect PIN. Please try again.');
        } else {
          setPinInput('');
          setErrorMsg('');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;
    const ok = unlockWithPin(pinInput);
    if (!ok) {
      setErrorMsg('Incorrect PIN. Please try again.');
    } else {
      setPinInput('');
      setErrorMsg('');
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setChangeSuccess('');

    if (newPin !== confirmPin) {
      setErrorMsg('New PINs do not match.');
      return;
    }

    const res = changePin(oldPin, newPin);
    if (!res.success) {
      setErrorMsg(res.message);
    } else {
      setChangeSuccess('Shared PIN successfully updated!');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setMode('unlock');
        closePinModal();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {mode === 'unlock' ? 'Admin Security' : 'Change Admin PIN'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {mode === 'unlock' ? 'Required to create & edit records' : 'Update the 4-digit Admin PIN'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setPinInput('');
              setErrorMsg('');
              closePinModal();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 bg-[#0D1527]">
          {mode === 'unlock' ? (
            <div>
              <div className="text-center mb-5">
                <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 shadow-xs">
                  <Lock className="w-6 h-6 stroke-[2.2px]" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  Enter 4-Digit Admin PIN
                </h4>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Enter authorized PIN to unlock administrative controls
                </p>
              </div>

              {/* PIN Dots Indicator */}
              <div className="flex justify-center items-center gap-3 mb-6">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                      pinInput.length > idx
                        ? 'bg-blue-500 border-blue-500 scale-125 shadow-xs shadow-blue-500/30'
                        : 'border-slate-700 bg-[#111A2E]'
                    }`}
                  />
                ))}
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-300 bg-rose-950/60 border border-rose-800/80 py-2.5 px-3 rounded-2xl mb-4 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Virtual Numpad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleNumpadClick(digit)}
                    className="h-13 rounded-2xl bg-[#111A2E] hover:bg-[#16233E] border border-slate-800 active:scale-95 text-lg font-bold font-mono-num text-white transition-all flex items-center justify-center shadow-xs hover:border-slate-700"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setErrorMsg('');
                  }}
                  className="h-13 rounded-2xl bg-[#0B1323] hover:bg-slate-800 text-xs font-bold text-slate-400 active:scale-95 transition-all flex items-center justify-center border border-slate-800"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpadClick('0')}
                  className="h-13 rounded-2xl bg-[#111A2E] hover:bg-[#16233E] border border-slate-800 active:scale-95 text-lg font-bold font-mono-num text-white transition-all flex items-center justify-center shadow-xs hover:border-slate-700"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-13 rounded-2xl bg-[#0B1323] hover:bg-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all flex items-center justify-center border border-slate-800"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5 stroke-[2.2px]" />
                </button>
              </div>

              {/* Option to change PIN if already unlocked */}
              {isAdminUnlocked && (
                <div className="text-center pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('change');
                      setErrorMsg('');
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors"
                  >
                    Change Admin PIN →
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Change PIN Mode */
            <form onSubmit={handleChangePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Current PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  placeholder="Enter current PIN"
                  className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  New PIN (min 4 digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter new 4-6 digit PIN"
                  className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Confirm new PIN"
                  className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
                  required
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800/80 py-2.5 px-3.5 rounded-2xl font-semibold">
                  {errorMsg}
                </div>
              )}

              {changeSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800/80 py-2.5 px-3.5 rounded-2xl font-semibold">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{changeSuccess}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('unlock');
                    setErrorMsg('');
                  }}
                  className="flex-1 py-3 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-md shadow-blue-600/30 transition-all active:scale-98"
                >
                  Save New PIN
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
