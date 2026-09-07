import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { EventItem, PaymentMethod } from '../../types';
import { formatINR, calculateEventSummary } from '../../utils/formatters';
import {
  X,
  CheckCircle2,
  Banknote,
  Building2,
  Calendar,
  User,
  CreditCard,
  Check,
  AlertCircle,
  Heart,
  Gift,
  Coins,
} from 'lucide-react';

interface RecordMemberPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  preSelectedMemberId?: string;
  defaultAmount?: number;
}

export const RecordMemberPaymentModal: React.FC<RecordMemberPaymentModalProps> = ({
  isOpen,
  onClose,
  event,
  preSelectedMemberId,
  defaultAmount,
}) => {
  const {
    members,
    expenses,
    transactions,
    totalCollected,
    setTotalCollected,
    addExpense,
    addTransaction,
    markMemberPaid,
    addCategoryToEvent,
  } = useFinance();

  const enrolledMembers = members.filter((m) => event.memberIds.includes(m.id));

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    preSelectedMemberId || (enrolledMembers[0]?.id || '')
  );
  const [recordType, setRecordType] = useState<'settlement' | 'expense'>('settlement');
  const [amount, setAmount] = useState<string>(defaultAmount ? String(defaultAmount) : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentTitle, setPaymentTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [category, setCategory] = useState<string>('Member Contribution');
  const [addToTreasury, setAddToTreasury] = useState<boolean>(true);

  // Financial summary of the event using central calculation
  const eventSummary = useMemo(() => {
    return calculateEventSummary(event, expenses, members, transactions);
  }, [event, expenses, members, transactions]);

  // Compute remaining due for selected member using eventSummary
  const memberDueInfo = useMemo(() => {
    if (!selectedMemberId) return { totalPaid: 0, share: 0, owed: 0, extraDonation: 0, isDonor: false, isPaid: false, isExempt: false };
    const memberSettlement = eventSummary.memberSettlement.find((m) => m.memberId === selectedMemberId);
    if (!memberSettlement) {
      return { totalPaid: 0, share: 0, owed: 0, extraDonation: 0, isDonor: false, isPaid: false, isExempt: false };
    }
    const isExempt = memberSettlement.isExemptFromSplit;
    const isPaid = memberSettlement.status === 'paid' || memberSettlement.status === 'settled';
    const share = isExempt ? 0 : memberSettlement.expectedShare;
    const totalPaid = memberSettlement.totalPaid;
    const owed = isExempt || isPaid ? 0 : Math.max(0, share - totalPaid);
    const extraDonation = memberSettlement.extraDonation || 0;
    const isDonor = memberSettlement.isDonor || extraDonation > 0;
    return { totalPaid, share, owed, extraDonation, isDonor, isPaid, isExempt };
  }, [selectedMemberId, eventSummary]);

  useEffect(() => {
    if (isOpen) {
      const initialMemberId = preSelectedMemberId || (enrolledMembers[0]?.id || '');
      setSelectedMemberId(initialMemberId);

      const mem = members.find((m) => m.id === initialMemberId);
      const memName = mem ? mem.name : 'Member';

      const memberSettlement = eventSummary.memberSettlement.find((m) => m.memberId === initialMemberId);
      const isExempt = memberSettlement?.isExemptFromSplit || false;
      const isPaid = memberSettlement?.status === 'paid' || memberSettlement?.status === 'settled';
      const owed = isExempt || isPaid ? 0 : Math.max(0, (memberSettlement?.expectedShare || 0) - (memberSettlement?.totalPaid || 0));

      if (defaultAmount !== undefined && defaultAmount > 0) {
        setAmount(String(defaultAmount));
      } else if (isExempt || isPaid || owed === 0) {
        setAmount('');
      } else if (owed > 0) {
        setAmount(String(owed));
      } else {
        setAmount(String(eventSummary.perMemberCost || 500));
      }

      setPaymentTitle(isExempt ? `Gift / Contribution - ${memName}` : `Share Settlement - ${memName}`);
      setPaymentMethod('bank');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      setCategory('Member Contribution');
      setRecordType('settlement');
      setAddToTreasury(true);
    }
  }, [isOpen, preSelectedMemberId, defaultAmount, eventSummary, enrolledMembers, members]);

  // When member changes, update suggested amount & title
  const handleMemberChange = (mId: string) => {
    setSelectedMemberId(mId);
    const mem = members.find((m) => m.id === mId);
    const memName = mem ? mem.name : 'Member';

    const memberSettlement = eventSummary.memberSettlement.find((m) => m.memberId === mId);
    const isExempt = memberSettlement?.isExemptFromSplit || false;
    const isPaid = memberSettlement?.status === 'paid' || memberSettlement?.status === 'settled';
    const owed = isExempt || isPaid ? 0 : Math.max(0, (memberSettlement?.expectedShare || 0) - (memberSettlement?.totalPaid || 0));

    setPaymentTitle(isExempt ? `Gift / Contribution - ${memName}` : `Share Settlement - ${memName}`);

    if (isExempt || isPaid || owed === 0) {
      setAmount('');
    } else if (owed > 0) {
      setAmount(String(owed));
    } else {
      setAmount(String(eventSummary.perMemberCost || 500));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    if (!selectedMemberId) return;

    if (recordType === 'settlement') {
      const selectedMember = members.find((m) => m.id === selectedMemberId);

      // 1. Mark member as settled on the event
      markMemberPaid(event.id, selectedMemberId, true);

      // 2. Persist real contribution transaction to Firestore & ledger for live cross-device sync
      addTransaction({
        event: event.name,
        eventId: event.id,
        date: date,
        transactionType: 'Contribution',
        nameOrCategory: selectedMember?.name || 'Member Contribution',
        amount: numAmount,
        paymentStatus: 'Paid',
        notes: notes.trim() || `Event contribution share for ${event.name}`,
        memberId: selectedMemberId,
        paymentMethod: paymentMethod,
      });
      
      // 3. If credited to group fund treasury, increment total collected revenue
      if (addToTreasury) {
        setTotalCollected(totalCollected + numAmount);
      }
    } else {
      // Out-of-pocket expense bill incurred for the event
      const selectedMember = members.find((m) => m.id === selectedMemberId);
      const finalTitle = paymentTitle.trim() || `Event Expense - ${selectedMember?.name || 'Member'}`;

      if (!event.categories.includes(category)) {
        addCategoryToEvent(event.id, category);
      }

      addExpense({
        eventId: event.id,
        name: finalTitle,
        category: category,
        amount: numAmount,
        date: date,
        paidById: selectedMemberId,
        paymentMethod: paymentMethod,
        notes: notes.trim() ? notes.trim() : `Expense bill paid by ${selectedMember?.name || 'Member'}`,
      });
    }

    onClose();
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-slate-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#111A2E]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 stroke-[2.4px]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Record Member Payment
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {event.name}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Record Type Mode Switcher */}
          <div className="p-1 bg-[#0B1323] border border-slate-800 rounded-xl grid grid-cols-2 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setRecordType('settlement')}
              className={`py-2 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                recordType === 'settlement'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Settle Due / Share</span>
            </button>

            <button
              type="button"
              onClick={() => setRecordType('expense')}
              className={`py-2 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                recordType === 'expense'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Event Bill / Expense</span>
            </button>
          </div>

          {/* Member Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              Paying Member <span className="text-rose-400">*</span>
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => handleMemberChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
              required
            >
              {enrolledMembers.map((m) => {
                const isWedding = event.weddingPersonId === m.id || (event.exemptMemberIds || []).includes(m.id);
                return (
                  <option key={m.id} value={m.id}>
                    {isWedding ? '💍 ' : ''}{m.name} {isWedding ? '(Wedding Member - Exempt)' : m.role ? `(${m.role})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Wedding Exemption Banner if wedding person selected */}
          {memberDueInfo.isExempt && (
            <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2.5 shadow-sm">
              <span className="text-lg shrink-0">💍</span>
              <div>
                <p className="font-bold text-white">
                  Wedding Member Exemption (₹0 Share)
                </p>
                <p className="text-[11px] text-rose-300 mt-0.5">
                  This member is the groom/bride of this event and is exempt from cost splitting. Any payment entered here is recorded as a voluntary gift or personal contribution.
                </p>
              </div>
            </div>
          )}

          {/* Voluntary Donor Banner if already donated extra */}
          {!memberDueInfo.isExempt && memberDueInfo.isDonor && memberDueInfo.extraDonation > 0 && (
            <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-700/80 text-amber-200 text-xs flex items-center gap-2.5 shadow-sm">
              <span className="text-lg shrink-0">✨</span>
              <div>
                <p className="font-bold text-amber-200">
                  Voluntary Donor (Fully Paid)
                </p>
                <p className="text-[11px] text-amber-300/90 mt-0.5">
                  Contributed {formatINR(memberDueInfo.totalPaid)}, including an extra voluntary donation of <strong className="text-amber-200">+{formatINR(memberDueInfo.extraDonation)}</strong> beyond their {eventSummary.splitMode === 'minimum' ? 'minimum required share' : 'share'} of {formatINR(memberDueInfo.share)}. Balance owed is <strong className="text-emerald-300">₹0</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Fully Settled Banner (without extra donation) */}
          {!memberDueInfo.isExempt && !memberDueInfo.isDonor && memberDueInfo.isPaid && (
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-2.5 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-emerald-200">
                  Member Fully Settled
                </p>
                <p className="text-[11px] text-emerald-300/90 mt-0.5">
                  This member has completely settled their share ({formatINR(memberDueInfo.share)}). Remaining due is <strong className="text-emerald-300">₹0</strong>. Any new amount will be recorded as an additional voluntary contribution.
                </p>
              </div>
            </div>
          )}

          {/* Member Balance Status Box */}
          <div className="p-3 rounded-2xl bg-[#0B1323]/90 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {eventSummary.splitMode === 'minimum' ? 'Floor Share' : 'Calculated Share'}
              </span>
              <span className={`text-sm font-bold font-mono-num ${memberDueInfo.isExempt ? 'text-rose-400' : 'text-slate-200'}`}>
                {memberDueInfo.isExempt ? '₹0 (Exempt)' : formatINR(memberDueInfo.share)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Already Paid
              </span>
              <span className="text-sm font-bold font-mono-num text-emerald-400">
                {formatINR(memberDueInfo.totalPaid)}
                {memberDueInfo.extraDonation > 0 && (
                  <span className="text-[10px] text-amber-300 block font-semibold">
                    (+{formatINR(memberDueInfo.extraDonation)} extra)
                  </span>
                )}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Pending Due
              </span>
              <span className={`text-sm font-extrabold font-mono-num ${memberDueInfo.isExempt || memberDueInfo.isPaid || memberDueInfo.owed === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {memberDueInfo.isExempt ? 'None (₹0)' : memberDueInfo.isPaid || memberDueInfo.owed === 0 ? 'Settled (₹0)' : formatINR(memberDueInfo.owed)}
              </span>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                Amount Received (₹) <span className="text-rose-400">*</span>
              </label>
              {memberDueInfo.owed > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(memberDueInfo.owed))}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                >
                  Set Full Pending ({formatINR(memberDueInfo.owed)})
                </button>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                ₹
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                step="1"
                min="1"
                className="w-full pl-8 pr-3.5 py-2.5 bg-[#0B1323] border border-slate-700/80 rounded-xl text-base font-bold text-white font-mono-num focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {/* Quick Donation & Amount Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Quick:</span>
              {memberDueInfo.owed > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(memberDueInfo.owed))}
                  className="px-2 py-0.5 rounded-lg bg-[#142038] hover:bg-blue-600/30 text-blue-300 border border-blue-800 text-[11px] font-mono-num font-semibold cursor-pointer"
                >
                  Exact ({formatINR(memberDueInfo.owed)})
                </button>
              )}
              {[200, 500, 1000].map((addExtra) => {
                const base = memberDueInfo.owed > 0 ? memberDueInfo.owed : (Number(eventSummary.perMemberCost) || 500);
                const totalWithExtra = base + addExtra;
                return (
                  <button
                    key={addExtra}
                    type="button"
                    onClick={() => setAmount(String(totalWithExtra))}
                    className="px-2 py-0.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 text-[11px] font-mono-num font-semibold cursor-pointer"
                  >
                    +{formatINR(addExtra)} donate
                  </button>
                );
              })}
            </div>

            {/* Voluntary Donation Celebratory Banner */}
            {(() => {
              const enteredNum = parseFloat(amount) || 0;
              const owed = memberDueInfo.owed;
              if (!memberDueInfo.isExempt && enteredNum > 0) {
                if (owed > 0 && enteredNum > owed) {
                  const extra = enteredNum - owed;
                  return (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-600/70 text-xs text-emerald-200 flex items-center gap-2 mt-1">
                      <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        <strong>Voluntary Donation:</strong> Covers {formatINR(owed)} pending share with an extra donation of <strong className="text-emerald-300 font-mono-num">+{formatINR(extra)}</strong>!
                      </span>
                    </div>
                  );
                } else if (memberDueInfo.isPaid && enteredNum > 0) {
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-600/70 text-xs text-amber-200 flex items-center gap-2 mt-1">
                      <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Additional Contribution:</strong> Member is already settled. This entire <strong className="text-amber-300 font-mono-num">{formatINR(enteredNum)}</strong> will be recorded as voluntary donation!
                      </span>
                    </div>
                  );
                }
              }
              return null;
            })()}
          </div>

          {/* Payment Method Toggle (Cash vs Bank / UPI) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              Payment Method Received <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                    : 'bg-[#0B1323] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Bank / UPI (GPay)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                    : 'bg-[#0B1323] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Cash Received</span>
              </button>
            </div>
          </div>

          {/* Credit to Treasury checkbox for settlements */}
          {recordType === 'settlement' && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-900/50 cursor-pointer text-xs text-blue-200">
              <input
                type="checkbox"
                checked={addToTreasury}
                onChange={(e) => setAddToTreasury(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Credit this collection to <strong>Tm ISHAL Treasury</strong> revenue</span>
            </label>
          )}

          {/* Payment Date & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Payment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1323] border border-slate-700/80 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B1323] border border-slate-700/80 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300">
              Notes / Reference (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GPay UPI Ref #827391 or Cash handed over"
              className="w-full px-3 py-2 bg-[#0B1323] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[2.8px]" />
              {recordType === 'settlement' ? 'Clear Due & Mark Settled' : 'Save Event Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
