import React, { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { PaymentMethod, TransactionRecord, TransactionStatus, TransactionType } from '../../types';
import { formatINR } from '../../utils/formatters';
import { X, Edit2, Trash2, Calendar, CreditCard, Banknote, Building2, Check, AlertCircle } from 'lucide-react';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionRecord | null;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const { events, updateTransaction, deleteTransaction, requireAuth } = useFinance();

  const [nameOrCategory, setNameOrCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('Contribution');
  const [paymentStatus, setPaymentStatus] = useState<TransactionStatus>('Paid');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (transaction) {
      setNameOrCategory(transaction.nameOrCategory || '');
      setAmount(String(transaction.amount || ''));
      setDate(transaction.date || new Date().toISOString().slice(0, 10));
      setTransactionType(transaction.transactionType || 'Contribution');
      setPaymentStatus(transaction.paymentStatus || 'Paid');
      setPaymentMethod(transaction.paymentMethod || 'bank');
      setSelectedEventId(transaction.eventId || '');
      setCategory(transaction.category || '');
      setNotes(transaction.notes || '');
      setShowDeleteConfirm(false);
      setError('');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!nameOrCategory.trim()) {
      setError('Please enter a member name or description.');
      return;
    }

    const selectedEv = events.find((ev) => ev.id === selectedEventId);
    const eventName = selectedEv ? selectedEv.name : transaction.event;

    requireAuth(() => {
      updateTransaction(transaction.transactionId, {
        nameOrCategory: nameOrCategory.trim(),
        amount: numAmount,
        date,
        transactionType,
        paymentStatus,
        paymentMethod,
        eventId: selectedEventId || transaction.eventId,
        event: eventName,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    });
  };

  const handleDelete = () => {
    requireAuth(() => {
      deleteTransaction(transaction.transactionId);
      setShowDeleteConfirm(false);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-[#111A2E]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Edit Transaction Entry</h2>
                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/80">
                  {transaction.transactionId}
                </span>
              </div>
              <p className="text-xs text-slate-400">Modify accounting ledger record or delete entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Amount (₹) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3.5 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white font-mono-num font-bold text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Transaction Type</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="w-full px-3 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="Contribution">Contribution (Inflow)</option>
                <option value="Expense">Expense (Outflow)</option>
                <option value="Member Credit">Member Credit (Advance Given)</option>
                <option value="Credit Repayment">Credit Repayment (Returned)</option>
                <option value="Opening Balance">Opening Balance</option>
              </select>
            </div>
          </div>

          {/* Member Name / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Member Name / Payee Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={nameOrCategory}
              onChange={(e) => setNameOrCategory(e.target.value)}
              placeholder="e.g. Salman Faris or Catering Services"
              className="w-full px-3.5 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Event and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Associated Event</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="">General / Treasury Fund</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Payment Method & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500/60 shadow-xs'
                      : 'bg-[#0B1323] text-slate-400 border-slate-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Bank / UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-xs'
                      : 'bg-[#0B1323] text-slate-400 border-slate-800'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as TransactionStatus)}
                className="w-full px-3 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="Paid">Paid / Cleared</option>
                <option value="Unpaid">Unpaid / Due</option>
                <option value="Recorded">Recorded</option>
              </select>
            </div>
          </div>

          {/* Category & Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Category / Tag</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Member Contribution, Catering, Logistics"
              className="w-full px-3.5 py-2 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Notes / Description</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks or receipt details..."
              className="w-full px-3.5 py-2 bg-[#0B1323] border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Delete confirmation section */}
          {showDeleteConfirm ? (
            <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-800 space-y-2">
              <div className="flex items-center gap-2 text-rose-200 text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Permanently delete entry {transaction.transactionId}?</span>
              </div>
              <p className="text-[11px] text-rose-300/80">
                This will remove {formatINR(transaction.amount)} from transaction records and recalculate running treasury balance.
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="py-2 px-3 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 cursor-pointer active:scale-95"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3px]" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
