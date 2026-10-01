import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { CreditNote, PaymentMethod } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  X,
  CreditCard,
  Building2,
  Wallet,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowDownLeft,
} from 'lucide-react';

interface RecordCreditRepaymentModalProps {
  creditNote: CreditNote | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RecordCreditRepaymentModal: React.FC<RecordCreditRepaymentModalProps> = ({
  creditNote,
  isOpen,
  onClose,
}) => {
  const { recordCreditRepayment, requireAuth } = useFinance();

  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [repaymentDate, setRepaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    if (creditNote) {
      setAmount(creditNote.remainingAmount.toString());
      setPaymentMethod(creditNote.paymentMethod || 'bank');
      setError('');
    }
  }, [creditNote]);

  if (!isOpen || !creditNote) return null;

  const numAmount = parseFloat(amount) || 0;
  const remainingAfter = Math.max(0, creditNote.remainingAmount - numAmount);
  const isFullSettlement = numAmount >= creditNote.remainingAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid repayment amount.');
      return;
    }
    if (numAmount > creditNote.remainingAmount) {
      setError(`Repayment cannot exceed remaining amount of ${formatINR(creditNote.remainingAmount)}.`);
      return;
    }

    requireAuth(() => {
      recordCreditRepayment(creditNote.id, {
        amount: numAmount,
        paymentMethod,
        date: repaymentDate,
        notes: notes.trim() || undefined,
      });
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-[#111A2E]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Record Credit Repayment</h2>
              <p className="text-xs text-slate-400">Receive funds from member directly into our Balance amount</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Credit Note Voucher Info Card */}
          <div className="p-3.5 bg-[#0B1323] rounded-2xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/80">
                {creditNote.voucherNo}
              </span>
              <span className="font-bold text-white text-sm">{creditNote.memberName}</span>
            </div>
            <p className="text-xs text-slate-400 truncate">{creditNote.purpose}</p>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center font-mono-num">
              <div>
                <span className="text-[10px] text-slate-500 block">Total Issued</span>
                <span className="text-xs font-bold text-white">{formatINR(creditNote.amount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Repaid</span>
                <span className="text-xs font-bold text-emerald-400">{formatINR(creditNote.repaidAmount)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Remaining</span>
                <span className="text-xs font-extrabold text-amber-400">{formatINR(creditNote.remainingAmount)}</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800/70 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Repayment Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-300">Repayment Amount (₹ INR):</label>
              <button
                type="button"
                onClick={() => setAmount(creditNote.remainingAmount.toString())}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                Full Repayment ({formatINR(creditNote.remainingAmount)})
              </button>
            </div>
            <input
              type="number"
              min="1"
              max={creditNote.remainingAmount}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
              placeholder={`Max: ${creditNote.remainingAmount}`}
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            {numAmount > 0 && numAmount <= creditNote.remainingAmount && (
              <p className="text-[11px] text-slate-400 font-mono">
                Remaining after repayment: <strong className="text-white">{formatINR(remainingAfter)}</strong>{' '}
                {isFullSettlement ? '(Will mark as Fully Settled ✓)' : ''}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Payment Received Via:</label>
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
                <span>Bank / UPI Account</span>
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

          {/* Repayment Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Repayment Date:</label>
            <input
              type="date"
              value={repaymentDate}
              onChange={(e) => setRepaymentDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400">Notes / Reference (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GPay UPI Ref: 4892019..."
              className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
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
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Repayment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
