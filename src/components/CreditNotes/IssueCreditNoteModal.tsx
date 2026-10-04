import React, { useState, useMemo, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { CreditNote, PaymentMethod } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  X,
  CreditCard,
  Wallet,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileText,
  User,
  ShieldAlert,
} from 'lucide-react';

interface IssueCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMemberId?: string;
  creditNoteToEdit?: CreditNote | null;
}

export const IssueCreditNoteModal: React.FC<IssueCreditNoteModalProps> = ({
  isOpen,
  onClose,
  preselectedMemberId,
  creditNoteToEdit,
}) => {
  const {
    members,
    openingBalance,
    transactions,
    expenses,
    addCreditNote,
    updateCreditNote,
    requireAuth,
  } = useFinance();

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    creditNoteToEdit?.memberId || preselectedMemberId || members[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>(
    creditNoteToEdit ? String(creditNoteToEdit.amount) : '2000'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    creditNoteToEdit?.paymentMethod || 'bank'
  );
  const [purpose, setPurpose] = useState<string>(
    creditNoteToEdit?.purpose || 'Emergency Welfare Support'
  );
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(
    creditNoteToEdit?.date || new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>(
    creditNoteToEdit?.dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>(creditNoteToEdit?.notes || '');
  const [error, setError] = useState<string>('');

  // Sync state when creditNoteToEdit or preselectedMemberId changes
  useEffect(() => {
    if (creditNoteToEdit) {
      setSelectedMemberId(creditNoteToEdit.memberId);
      setAmount(String(creditNoteToEdit.amount));
      setPaymentMethod(creditNoteToEdit.paymentMethod);
      setPurpose(creditNoteToEdit.purpose);
      setIssueDate(creditNoteToEdit.date);
      setDueDate(creditNoteToEdit.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setNotes(creditNoteToEdit.notes || '');
      setError('');
    } else if (preselectedMemberId) {
      setSelectedMemberId(preselectedMemberId);
    } else if (members[0]?.id && !selectedMemberId) {
      setSelectedMemberId(members[0].id);
    }
  }, [creditNoteToEdit, preselectedMemberId, members]);

  // Calculate live available treasury balance
  const treasuryInfo = useMemo(() => {
    const verifiedCollections = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const verifiedExpenses = transactions
      .filter((tx) => tx.transactionType === 'Expense')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalBalance = openingBalance + verifiedCollections - verifiedExpenses;

    const cashExpenses = expenses
      .filter((e) => (e.paymentMethod || 'cash') === 'cash')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const cashCollections = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && (tx.paymentMethod || 'cash') === 'cash')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const cashInHand = cashCollections - cashExpenses;

    const bankExpenses = expenses
      .filter((e) => e.paymentMethod === 'bank')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const bankCollections = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && tx.paymentMethod === 'bank')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const bankBalance = openingBalance + bankCollections - bankExpenses;

    return { totalBalance, cashInHand, bankBalance };
  }, [transactions, expenses, openingBalance]);

  if (!isOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  // Maximum credit limit is 50% of the Total Balance
  const maxCreditLimit = Math.max(0, Math.floor(treasuryInfo.totalBalance * 0.5));
  const isExceeding50Percent = numAmount > maxCreditLimit;
  const activePurpose = purpose === 'Custom' ? customPurpose : purpose;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      setError('Please select a member.');
      return;
    }
    if (numAmount <= 0) {
      setError('Please enter a valid credit amount.');
      return;
    }
    if (numAmount > maxCreditLimit) {
      setError(
        `Credit advance is limited to 50% of Total Balance (${formatINR(maxCreditLimit)}). Maximum credit allowed is ${formatINR(maxCreditLimit)}.`
      );
      return;
    }
    if (!activePurpose.trim()) {
      setError('Please specify the purpose for this credit advance.');
      return;
    }

    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) return;

    requireAuth(() => {
      if (creditNoteToEdit) {
        updateCreditNote(creditNoteToEdit.id, {
          memberId: member.id,
          memberName: member.name,
          amount: numAmount,
          date: issueDate,
          dueDate,
          paymentMethod,
          purpose: activePurpose.trim(),
          notes: notes.trim(),
        });
      } else {
        addCreditNote({
          memberId: member.id,
          memberName: member.name,
          amount: numAmount,
          date: issueDate,
          dueDate,
          paymentMethod,
          purpose: activePurpose.trim(),
          notes: notes.trim(),
        });
      }
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-[#111A2E]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Issue Credit Note / Advance</h2>
              <p className="text-xs text-slate-400">Disburse advance credit to member directly from our Balance amount</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Treasury Balance Live Snapshot */}
          <div className="p-3 bg-[#0B1323] rounded-2xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10.5px] uppercase font-bold text-slate-400 block tracking-wider">
                Available Treasury Balance
              </span>
              <p className="text-base font-extrabold text-cyan-400 font-mono-num">
                {formatINR(treasuryInfo.totalBalance)}
              </p>
            </div>
            <div className="text-right text-[11px] font-mono-num text-slate-400">
              <span className="block">Cash: <strong className="text-amber-300">{formatINR(treasuryInfo.cashInHand)}</strong></span>
              <span className="block">Bank: <strong className="text-cyan-300">{formatINR(treasuryInfo.bankBalance)}</strong></span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/70 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {isExceeding50Percent && (
            <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold">Amount exceeds 50% limit of total balance ({formatINR(maxCreditLimit)})</p>
                <p className="text-[11px] text-amber-400/80">Maximum allowed credit is 50% of group balance.</p>
              </div>
            </div>
          )}

          {/* Member Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" /> Recipient Member:
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.role ? `(${m.role})` : ''} • {m.phone || 'No phone'}
                </option>
              ))}
            </select>
          </div>

          {/* Credit Amount & Quick Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">Credit Amount (₹ INR):</label>
              <span className="text-[11px] text-blue-400 font-mono-num font-bold">
                {numAmount > 0 ? formatINR(numAmount) : ''}
              </span>
            </div>
            <input
              type="number"
              min="100"
              step="100"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder="e.g. 5000"
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
              {[1000, 2000, 3000, 5000, 10000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-2.5 py-1 rounded-lg bg-[#0D1527] hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-white font-mono transition-colors shrink-0"
                >
                  +{formatINR(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Disbursement Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Disbursement Method (From Balance):</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'bank'
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-[#0D1527] border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank / Online UPI</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-blue-600/30 border-blue-500 text-blue-300 ring-1 ring-blue-500/50'
                    : 'bg-[#0D1527] border-slate-700/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Physical Cash</span>
              </button>
            </div>
          </div>

          {/* Purpose / Category Preset */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Purpose / Reason:</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="Emergency Welfare Support">Emergency Welfare Support</option>
              <option value="Medical Advance Support">Medical Advance Support</option>
              <option value="Travel & Relocation Aid">Travel & Relocation Aid</option>
              <option value="Event Purchase Advance">Event Purchase Advance</option>
              <option value="Family Welfare Assistance">Family Welfare Assistance</option>
              <option value="Custom">Other (Custom Purpose)</option>
            </select>
            {purpose === 'Custom' && (
              <input
                type="text"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
                placeholder="Enter specific purpose..."
                className="w-full px-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
              />
            )}
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400">Issue Date:</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400">Target Repayment Date:</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">Notes & Agreement (Optional):</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved by coordinators, to be repaid upon monthly salary..."
              className="w-full px-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Disburse from Balance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
