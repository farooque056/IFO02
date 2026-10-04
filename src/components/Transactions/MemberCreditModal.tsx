import React, { useState, useEffect, useRef } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { PaymentMethod, TransactionRecord } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  X,
  CreditCard,
  Banknote,
  Building2,
  Calendar,
  User,
  Check,
  AlertCircle,
  Clock,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Wallet,
  Trash2,
  Edit2,
} from 'lucide-react';

interface MemberCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'give_credit' | 'repayment';
  preSelectedMemberId?: string;
  transactionToEdit?: TransactionRecord | null;
}

export const MemberCreditModal: React.FC<MemberCreditModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'give_credit',
  preSelectedMemberId,
  transactionToEdit,
}) => {
  const {
    members,
    transactions,
    netTreasuryBalance,
    giveMemberCredit,
    recordCreditRepayment,
    updateTransaction,
    deleteTransaction,
    requireAuth,
    isAdminUnlocked,
  } = useFinance();

  const [mode, setMode] = useState<'give_credit' | 'repayment'>(defaultMode);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    preSelectedMemberId || (members[0]?.id || '')
  );
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate credit balance for each member
  const memberCreditMap = React.useMemo(() => {
    const map = new Map<string, { given: number; repaid: number; outstanding: number }>();
    (members || []).forEach((m) => {
      if (m?.id) {
        map.set(m.id, { given: 0, repaid: 0, outstanding: 0 });
      }
    });

    (transactions || []).forEach((tx) => {
      if (!tx || !tx.memberId) return;
      const cur = map.get(tx.memberId) || { given: 0, repaid: 0, outstanding: 0 };
      if (tx.transactionType === 'Member Credit' && tx.paymentStatus !== 'Unpaid') {
        cur.given += Number(tx.amount) || 0;
      } else if (tx.transactionType === 'Credit Repayment' && tx.paymentStatus === 'Paid') {
        cur.repaid += Number(tx.amount) || 0;
      }
      cur.outstanding = Math.max(0, cur.given - cur.repaid);
      map.set(tx.memberId, cur);
    });

    return map;
  }, [members, transactions]);

  // Members who currently have an outstanding credit balance
  const membersWithOutstandingCredit = React.useMemo(() => {
    return (members || []).filter((m) => {
      if (!m || !m.id) return false;
      const stats = memberCreditMap.get(m.id);
      return (stats?.outstanding || 0) > 0;
    });
  }, [members, memberCreditMap]);

  const activeStats = memberCreditMap.get(selectedMemberId) || { given: 0, repaid: 0, outstanding: 0 };
  const selectedMember = (members || []).find((m) => m?.id === selectedMemberId);

  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justOpened) {
      if (transactionToEdit) {
        const isDisbursement = transactionToEdit.transactionType === 'Member Credit';
        setMode(isDisbursement ? 'give_credit' : 'repayment');
        setSelectedMemberId(transactionToEdit.memberId || members[0]?.id || '');
        setAmount(String(transactionToEdit.amount));
        setPaymentMethod(transactionToEdit.paymentMethod || 'bank');
        setDate(transactionToEdit.date || new Date().toISOString().slice(0, 10));
        setNotes(transactionToEdit.notes || '');
        setErrorMsg('');
        setShowDeleteConfirm(false);
      } else {
        setMode(defaultMode);
        const initialId =
          preSelectedMemberId ||
          (defaultMode === 'repayment' && membersWithOutstandingCredit.length > 0
            ? membersWithOutstandingCredit[0].id
            : members[0]?.id || '');
        setSelectedMemberId(initialId);
        setAmount('');
        setPaymentMethod('bank');
        setDate(new Date().toISOString().slice(0, 10));
        setNotes('');
        setErrorMsg('');
        setShowDeleteConfirm(false);
      }
    }
  }, [isOpen, defaultMode, preSelectedMemberId, membersWithOutstandingCredit, members, transactionToEdit]);

  // When switching to repayment, default to first member with outstanding balance if current has none
  const handleModeSwitch = (newMode: 'give_credit' | 'repayment') => {
    setMode(newMode);
    setErrorMsg('');
    if (newMode === 'repayment' && activeStats.outstanding === 0 && membersWithOutstandingCredit.length > 0) {
      setSelectedMemberId(membersWithOutstandingCredit[0].id);
    }
  };

  const handleMemberChange = (mId: string) => {
    setSelectedMemberId(mId);
    setErrorMsg('');
    const stats = memberCreditMap.get(mId);
    if (mode === 'repayment' && stats && stats.outstanding > 0) {
      setAmount(String(stats.outstanding));
    }
  };

  if (!isOpen) return null;

  const maxCreditLimit = Math.max(0, Math.floor(netTreasuryBalance * 0.5));

  const handleDelete = () => {
    if (!transactionToEdit) return;
    requireAuth(() => {
      deleteTransaction(transactionToEdit.transactionId);
      onClose();
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    if (!selectedMemberId) {
      setErrorMsg('Please select a member.');
      return;
    }

    // 50% Limit check for credit disbursement
    if (mode === 'give_credit') {
      if (netTreasuryBalance <= 0) {
        setErrorMsg('Cannot issue credit advance: Group Total Balance is zero or negative.');
        return;
      }
      if (numAmount > maxCreditLimit) {
        setErrorMsg(
          `Amount (${formatINR(numAmount)}) exceeds maximum 50% limit of Total Balance (${formatINR(maxCreditLimit)}). Allowed max loan is 50% of ₹${netTreasuryBalance.toLocaleString('en-IN')}.`
        );
        return;
      }
    }

    // If Editing an existing credit transaction
    if (transactionToEdit) {
      requireAuth(() => {
        updateTransaction(transactionToEdit.transactionId, {
          memberId: selectedMemberId,
          nameOrCategory: selectedMember?.name || transactionToEdit.nameOrCategory,
          amount: numAmount,
          paymentMethod,
          date,
          notes: notes.trim(),
          transactionType: mode === 'give_credit' ? 'Member Credit' : 'Credit Repayment',
          category: mode === 'give_credit' ? 'Member Credit Advance' : 'Member Credit Repayment',
        });
        onClose();
      });
      return;
    }

    if (mode === 'give_credit') {
      requireAuth(() => {
        giveMemberCredit({
          memberId: selectedMemberId,
          amount: numAmount,
          paymentMethod,
          date,
          notes: notes.trim(),
        });
        onClose();
      });
    } else {
      // Repayment
      requireAuth(() => {
        recordCreditRepayment({
          memberId: selectedMemberId,
          amount: numAmount,
          paymentMethod,
          date,
          notes: notes.trim(),
        });
        onClose();
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
                mode === 'give_credit'
                  ? 'bg-amber-950/80 border border-amber-800/60 text-amber-400'
                  : 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-400'
              }`}
            >
              {mode === 'give_credit' ? (
                <ArrowUpRight className="w-5 h-5 stroke-[2.4px]" />
              ) : (
                <ArrowDownLeft className="w-5 h-5 stroke-[2.4px]" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {transactionToEdit
                  ? `Edit Credit Entry (${transactionToEdit.transactionId})`
                  : mode === 'give_credit'
                  ? 'Give Credit / Advance to Member'
                  : 'Record Credit Repayment'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {transactionToEdit
                  ? 'Modify credit or repayment details or delete this entry'
                  : mode === 'give_credit'
                  ? 'Disburse cash or bank funds directly from group balance'
                  : 'Return funds back into group balance'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#0D1527]">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#0A1224] rounded-2xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => handleModeSwitch('give_credit')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'give_credit'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Give Credit / Advance</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeSwitch('repayment')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                mode === 'repayment'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Record Repayment</span>
            </button>
          </div>

          {/* Treasury Balance Health & 50% Loan Policy Card */}
          <div className="p-3.5 rounded-2xl bg-[#091122] border border-blue-900/40 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 font-semibold">Total Group Balance:</span>
              </div>
              <span className="font-extrabold font-mono-num text-cyan-400 text-sm">
                {formatINR(netTreasuryBalance)}
              </span>
            </div>

            {mode === 'give_credit' && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-300">
                    Max 50% Loan Credit Limit:
                  </span>
                </div>
                <span className="text-xs font-mono-num font-extrabold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/70">
                  {formatINR(maxCreditLimit)}
                </span>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Member Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Member <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => handleMemberChange(e.target.value)}
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
              required
            >
              {mode === 'repayment' && membersWithOutstandingCredit.length > 0 && (
                <optgroup label="Members with Active Credit">
                  {membersWithOutstandingCredit.map((m) => {
                    const stats = memberCreditMap.get(m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        👤 {m.name} — Outstanding: {formatINR(stats?.outstanding || 0)}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              <optgroup label={mode === 'repayment' ? 'All Community Members' : 'Community Members'}>
                {members.map((m) => {
                  const stats = memberCreditMap.get(m.id);
                  const balText = (stats?.outstanding || 0) > 0 ? ` (Owes ${formatINR(stats!.outstanding)})` : '';
                  return (
                    <option key={m.id} value={m.id}>
                      👤 {m.name} {m.role ? `(${m.role})` : ''} {balText}
                    </option>
                  );
                })}
              </optgroup>
            </select>
          </div>

          {/* Member Credit Status Banner */}
          {selectedMember && (
            <div className="p-3 rounded-2xl bg-[#0F1A30]/80 border border-slate-800/90 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Credit</span>
                <span className="font-bold font-mono-num text-amber-300">
                  {formatINR(activeStats.given)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Repaid</span>
                <span className="font-bold font-mono-num text-emerald-400">
                  {formatINR(activeStats.repaid)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Outstanding</span>
                <span
                  className={`font-extrabold font-mono-num ${
                    activeStats.outstanding > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatINR(activeStats.outstanding)}
                </span>
              </div>
            </div>
          )}

          {/* Amount (₹ INR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                {mode === 'give_credit' ? 'Credit Amount to Disburse' : 'Repayment Amount (₹)'}{' '}
                <span className="text-rose-400">*</span>
              </label>
              {mode === 'repayment' && activeStats.outstanding > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(activeStats.outstanding))}
                  className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline"
                >
                  Full Outstanding ({formatINR(activeStats.outstanding)})
                </button>
              )}
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold text-lg pointer-events-none font-mono">
                ₹
              </div>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-9 pr-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-xl font-extrabold font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {/* Live 50% Limit Validation Indicator */}
            {mode === 'give_credit' && (parseFloat(amount) || 0) > 0 && (
              <div className="mt-1.5 text-xs">
                {(parseFloat(amount) || 0) > maxCreditLimit ? (
                  <p className="text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Exceeds 50% Total Balance limit (Max allowed: {formatINR(maxCreditLimit)})</span>
                  </p>
                ) : (
                  <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Allowed under 50% limit (
                      {netTreasuryBalance > 0
                        ? Math.round(((parseFloat(amount) || 0) / netTreasuryBalance) * 100)
                        : 0}
                      % of Total Balance)
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Quick Amount Presets */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick:</span>
              {mode === 'give_credit' && maxCreditLimit > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(maxCreditLimit))}
                  className="px-2.5 py-0.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/50 text-[11px] font-mono-num font-bold transition-all"
                  title="Credit 50% maximum limit"
                >
                  Max 50% ({formatINR(maxCreditLimit)})
                </button>
              )}
              {[1000, 2000, 5000, 10000, 20000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="px-2 py-0.5 rounded-lg bg-[#15223C] hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700/80 text-[11px] font-mono-num font-semibold transition-all"
                >
                  +{formatINR(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method (Cash vs Bank Transfer / UPI) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Disbursement / Payment Method <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2.5 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-blue-950/80 border-blue-500/80 text-blue-300 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/40'
                    : 'bg-[#111A2E] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>🏦 Bank / UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                    : 'bg-[#111A2E] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>💵 Cash</span>
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono-num font-medium"
              required
            />
          </div>

          {/* Notes / Purpose */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Notes / Purpose / Terms (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === 'give_credit'
                  ? 'e.g., Emergency personal assistance loan, repayment by next month'
                  : 'e.g., GPay ref #928371, partial repayment of emergency advance'
              }
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Delete Confirmation Box */}
          {showDeleteConfirm && transactionToEdit && (
            <div className="p-3.5 bg-rose-950/90 border border-rose-800 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Permanently delete credit entry {transactionToEdit.transactionId}?
              </p>
              <p className="text-[11px] text-rose-200">
                Amount: <strong className="text-white">{formatINR(transactionToEdit.amount)}</strong>. Group treasury balance and member credit balances will recalculate immediately.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Yes, Delete Entry
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {transactionToEdit ? (
            <div className="flex gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-3 px-3.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800/80 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Delete this credit transaction"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-2xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className={`flex-1 py-3 text-white text-sm font-bold rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'give_credit'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                <Check className="w-4 h-4 stroke-[2.8px]" />
                <span>Update Entry</span>
                {!isAdminUnlocked && <Lock className="w-3.5 h-3.5 ml-1 text-white/80" />}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-2xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`flex-1 py-3 text-white text-sm font-bold rounded-2xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === 'give_credit'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                <Check className="w-4 h-4 stroke-[2.8px]" />
                <span>{mode === 'give_credit' ? 'Disburse Credit' : 'Save Repayment'}</span>
                {!isAdminUnlocked && <Lock className="w-3.5 h-3.5 ml-1 text-white/80" />}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
