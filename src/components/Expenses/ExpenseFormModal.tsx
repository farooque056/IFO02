import React, { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Expense, PaymentMethod } from '../../types';
import { formatINR } from '../../utils/formatters';
import {
  X,
  Receipt,
  IndianRupee,
  Tag,
  User,
  Calendar,
  FileText,
  Trash2,
  Plus,
  Banknote,
  Building2,
  Split,
  Users,
  Calculator,
} from 'lucide-react';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEventId?: string | null;
  expenseToEdit?: Expense | null;
  onOpenCreateEvent?: () => void;
}

export const OTHER_EXPENSES_ID = 'ev_other_expenses';
export const DEFAULT_OTHER_EXPENSES_CATEGORIES = [
  'General & Maintenance',
  'Tea, Snacks & Refreshments',
  'Charity & Sadqa',
  'Office, Utilities & Rent',
  'Printing & Stationery',
  'Travel & Fuel',
  'Equipment & Supplies',
  'Emergency Assistance',
  'Miscellaneous',
];

type ExpenseTypeMode = 'active_event' | 'other_expenses';

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  initialEventId,
  expenseToEdit,
  onOpenCreateEvent,
}) => {
  const {
    events,
    members,
    netTreasuryBalance,
    addEvent,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategoryToEvent,
  } = useFinance();

  const [expenseTypeMode, setExpenseTypeMode] = useState<ExpenseTypeMode>('active_event');
  const [eventId, setEventId] = useState<string>('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCatInput, setShowCustomCatInput] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidById, setPaidById] = useState('fund');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 1. Existing Other Expenses event (if created)
  const otherExpensesEvent = events.find(
    (ev) => ev.id === OTHER_EXPENSES_ID || ev.name.trim().toLowerCase() === 'other expenses'
  );

  // 2. Active Events only (strictly status === 'active', excluding other_expenses)
  const activeEvents = events.filter(
    (ev) =>
      ev.status === 'active' &&
      ev.id !== OTHER_EXPENSES_ID &&
      ev.name.trim().toLowerCase() !== 'other expenses'
  );

  // 3. Selectable active events (also keeps the currently edited expense's event if not active anymore)
  const selectableEvents = events.filter((ev) => {
    if (ev.id === OTHER_EXPENSES_ID || ev.name.trim().toLowerCase() === 'other expenses') {
      return false;
    }
    if (ev.status === 'active') return true;
    if (expenseToEdit && ev.id === expenseToEdit.eventId) return true;
    return false;
  });

  // Selected event object to retrieve its categories and participating members
  const currentEvent = events.find((e) => e.id === eventId);
  const eventCategories =
    expenseTypeMode === 'other_expenses'
      ? otherExpensesEvent?.categories || DEFAULT_OTHER_EXPENSES_CATEGORIES
      : currentEvent?.categories || [
          'Food & Catering',
          'Drinks & Juices',
          'Transportation',
          'Venue',
          'Disposable Items',
          'Miscellaneous',
        ];

  // Participating members in this event or group pool for Other Expenses
  const participatingMembers =
    expenseTypeMode === 'other_expenses'
      ? members
      : members.filter((m) => (currentEvent?.memberIds || []).includes(m.id));

  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        const isOther =
          expenseToEdit.eventId === OTHER_EXPENSES_ID ||
          events.find((e) => e.id === expenseToEdit.eventId)?.name.trim().toLowerCase() ===
            'other expenses';

        if (isOther) {
          setExpenseTypeMode('other_expenses');
          setEventId(expenseToEdit.eventId || OTHER_EXPENSES_ID);
        } else {
          setExpenseTypeMode('active_event');
          setEventId(expenseToEdit.eventId);
        }

        setName(expenseToEdit.name);
        setAmount(String(expenseToEdit.amount));
        setCategory(expenseToEdit.category);
        setPaymentMethod(expenseToEdit.paymentMethod || 'cash');
        setDate(expenseToEdit.date);
        setPaidById(expenseToEdit.paidById);
        setNotes(expenseToEdit.notes || '');
      } else {
        setName('');
        setAmount('');
        setPaymentMethod('cash');
        setDate(new Date().toISOString().slice(0, 10));
        setPaidById('fund');
        setNotes('');

        const isInitialOther =
          initialEventId === OTHER_EXPENSES_ID ||
          (initialEventId &&
            events.find((e) => e.id === initialEventId)?.name.trim().toLowerCase() ===
              'other expenses');

        if (isInitialOther) {
          setExpenseTypeMode('other_expenses');
          const targetId = otherExpensesEvent?.id || OTHER_EXPENSES_ID;
          setEventId(targetId);
          setCategory(otherExpensesEvent?.categories?.[0] || 'General & Maintenance');
        } else if (initialEventId && events.some((e) => e.id === initialEventId)) {
          setExpenseTypeMode('active_event');
          setEventId(initialEventId);
          const ev = events.find((e) => e.id === initialEventId);
          setCategory(ev?.categories?.[0] || 'Food & Catering');
        } else if (activeEvents.length > 0) {
          setExpenseTypeMode('active_event');
          setEventId(activeEvents[0].id);
          setCategory(activeEvents[0].categories?.[0] || 'Food & Catering');
        } else {
          // If no active events exist, default to Other Expenses
          setExpenseTypeMode('other_expenses');
          const targetId = otherExpensesEvent?.id || OTHER_EXPENSES_ID;
          setEventId(targetId);
          setCategory(otherExpensesEvent?.categories?.[0] || 'General & Maintenance');
        }
      }
      setShowCustomCatInput(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, expenseToEdit, initialEventId, events]);

  if (!isOpen) return null;

  const handleSwitchMode = (mode: ExpenseTypeMode) => {
    setExpenseTypeMode(mode);
    if (mode === 'other_expenses') {
      const targetId = otherExpensesEvent?.id || OTHER_EXPENSES_ID;
      setEventId(targetId);
      const targetCats = otherExpensesEvent?.categories || DEFAULT_OTHER_EXPENSES_CATEGORIES;
      setCategory(targetCats[0] || 'General & Maintenance');
    } else {
      if (selectableEvents.length > 0) {
        const defaultEv = selectableEvents[0];
        setEventId(defaultEv.id);
        setCategory(defaultEv.categories?.[0] || 'Food & Catering');
      } else {
        setEventId('');
        setCategory('Food & Catering');
      }
    }
  };

  const handleEventChange = (newEvId: string) => {
    if (newEvId === 'NEW_OTHER_EXPENSES' || newEvId === OTHER_EXPENSES_ID) {
      handleSwitchMode('other_expenses');
      return;
    }
    setExpenseTypeMode('active_event');
    setEventId(newEvId);
    const ev = events.find((e) => e.id === newEvId);
    if (ev && ev.categories && ev.categories.length > 0) {
      if (!ev.categories.includes(category)) {
        setCategory(ev.categories[0]);
      }
    }
  };

  const handleAddCustomCategory = () => {
    if (!customCategory.trim()) return;
    const cleanCat = customCategory.trim();
    if (expenseTypeMode === 'other_expenses') {
      if (otherExpensesEvent) {
        addCategoryToEvent(otherExpensesEvent.id, cleanCat);
      }
    } else if (eventId) {
      addCategoryToEvent(eventId, cleanCat);
    }
    setCategory(cleanCat);
    setCustomCategory('');
    setShowCustomCatInput(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetEventId = eventId;

    if (expenseTypeMode === 'other_expenses') {
      if (otherExpensesEvent) {
        targetEventId = otherExpensesEvent.id;
      } else {
        // Automatically create the dedicated "Other Expenses" event
        targetEventId = addEvent({
          id: OTHER_EXPENSES_ID,
          name: 'Other Expenses',
          type: 'custom',
          date: new Date().toISOString().slice(0, 10),
          status: 'active',
          location: 'Tm ISHAL General Fund',
          memberIds: members.map((m) => m.id),
          settledMemberIds: [],
          categories: DEFAULT_OTHER_EXPENSES_CATEGORIES,
          notes: 'Non-event routine and general community fund expenses.',
        });
      }
    }

    if (!targetEventId || !name.trim() || !amount || Number(amount) <= 0) {
      return;
    }

    const finalCategory =
      category ||
      (expenseTypeMode === 'other_expenses' ? 'General & Maintenance' : 'Miscellaneous');
    const numAmount = parseFloat(amount);

    if (expenseToEdit) {
      updateExpense(expenseToEdit.id, {
        eventId: targetEventId,
        name: name.trim(),
        amount: numAmount,
        category: finalCategory,
        paymentMethod,
        date,
        paidById,
        notes: notes.trim(),
      });
    } else {
      addExpense({
        eventId: targetEventId,
        name: name.trim(),
        amount: numAmount,
        category: finalCategory,
        paymentMethod,
        date,
        paidById,
        notes: notes.trim(),
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (expenseToEdit) {
      deleteExpense(expenseToEdit.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <Receipt className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {expenseToEdit ? 'Edit Expense' : 'Record New Expense'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Tm ISHAL Accounting Entry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1 bg-[#0D1527]">
          {/* EXPENSE CLASSIFICATION: ACTIVE EVENT vs OTHER EXPENSES */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Expense Type <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] font-semibold text-blue-400">
                {expenseTypeMode === 'active_event' ? 'Active Function' : 'Non-Event General'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0A1224] rounded-2xl border border-slate-800/80">
              <button
                type="button"
                onClick={() => handleSwitchMode('active_event')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  expenseTypeMode === 'active_event'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#121D38]'
                }`}
              >
                <span>🎯 Active Event</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono-num ${
                    expenseTypeMode === 'active_event'
                      ? 'bg-blue-800/80 text-blue-100'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {activeEvents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchMode('other_expenses')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  expenseTypeMode === 'other_expenses'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#121D38]'
                }`}
              >
                <span>📦 Other Expenses</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    expenseTypeMode === 'other_expenses'
                      ? 'bg-amber-800/80 text-amber-100 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Non-Event
                </span>
              </button>
            </div>
          </div>

          {/* ACTIVE EVENT MODE: ONLY SHOW ACTIVE EVENTS */}
          {expenseTypeMode === 'active_event' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Active Event <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Events Only
                </span>
              </div>

              {selectableEvents.length === 0 ? (
                <div className="p-4 bg-[#111A2E] border border-blue-900/60 rounded-2xl space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="text-base">ℹ️</span>
                    <div>
                      <p className="text-xs text-blue-200 font-bold">No active events found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        Completed historical events are hidden. You can record under{' '}
                        <strong className="text-amber-300 font-semibold">Other Expenses</strong> or
                        create a new active event.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSwitchMode('other_expenses')}
                      className="flex-1 py-2 px-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded-xl text-xs font-bold transition-all text-center"
                    >
                      Use Other Expenses
                    </button>
                    {onOpenCreateEvent && (
                      <button
                        type="button"
                        onClick={onOpenCreateEvent}
                        className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        + Create Event
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <select
                  value={eventId}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
                  required
                >
                  <optgroup label="Active Events">
                    {selectableEvents.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        🟢 {ev.name} ({ev.date})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Non-Event Options">
                    <option value="NEW_OTHER_EXPENSES">
                      📦 Other Expenses (Non-Event Expenses)
                    </option>
                  </optgroup>
                </select>
              )}
            </div>
          )}

          {/* OTHER EXPENSES MODE: EXPLICIT NON-EVENT CREATION / RECORDING */}
          {expenseTypeMode === 'other_expenses' && (
            <div className="p-4 bg-gradient-to-br from-amber-950/30 via-[#10192F] to-[#0D1527] border border-amber-800/40 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-sm">
                    📦
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      Other Expenses (Petty Cash Book)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Disbursed directly from Community Treasury Balance
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/70 border border-amber-700/70 text-amber-300 font-bold uppercase tracking-wider block">
                    No Member Collection
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono font-medium block mt-0.5">
                    Available: {formatINR(netTreasuryBalance)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                Zero member collection required. Routine disbursements (refreshments, stationery, utilities, maintenance, or emergency aid) are deducted directly from the total available fund cash balance.
              </p>
            </div>
          )}

          {/* 2. Expense Item Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Expense Title / Description <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Mandi Biryani, Disposable Glasses, TT Bus Fuel"
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              required
            />
          </div>

          {/* 3. Amount (INR ₹) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Amount (₹ INR) <span className="text-rose-400">*</span>
            </label>
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
                className="w-full pl-9 pr-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-xl font-extrabold font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all"
                required
              />
            </div>

            {/* Quick Amount Presets */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Quick:</span>
              {[500, 1000, 2000, 5000, 10000].map((preset) => (
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

            {/* LIVE PARTICIPATING MEMBERS SPLIT BREAKDOWN */}
            {amount && Number(amount) > 0 && (
              <div className="mt-2.5 p-3 rounded-2xl bg-[#0B1426] border border-blue-900/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                    <Split className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-blue-300 block">
                      Participating Member Split ({participatingMembers.length} members)
                    </span>
                    <p className="text-xs text-slate-300 truncate">
                      {participatingMembers.length > 0
                        ? `Each member's share for this entry:`
                        : 'No participating members enrolled in event'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-extrabold text-blue-400 font-mono-num block">
                    {participatingMembers.length > 0
                      ? `${formatINR(Math.round(Number(amount) / participatingMembers.length))}`
                      : '₹0'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">per participant</span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Category Selector with Custom Option */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Expense Category <span className="text-rose-400">*</span>
              </label>
              {!showCustomCatInput && (
                <button
                  type="button"
                  onClick={() => setShowCustomCatInput(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.8px]" /> Custom Category
                </button>
              )}
            </div>

            {/* Pill selector of available categories */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-[#0A1325]/70 rounded-2xl border border-slate-800/80">
              {eventCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    category === cat
                      ? 'bg-blue-600 text-white shadow-xs scale-102 font-bold'
                      : 'bg-[#111A2E] text-slate-300 hover:bg-[#16233E] border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Custom Category Input */}
            {showCustomCatInput && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter new category name"
                  className="flex-1 px-3.5 py-2 bg-[#111A2E] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomCatInput(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* 5. Paid By (Payer) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Paid By <span className="text-rose-400">*</span>
            </label>
            <select
              value={paidById}
              onChange={(e) => setPaidById(e.target.value)}
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
            >
              <option value="fund">🏦 Tm ISHAL Common Fund / Cash Pool</option>
              <optgroup label="Event Participants (Members)">
                {participatingMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.name} {m.role ? `(${m.role})` : ''}
                  </option>
                ))}
              </optgroup>
              {members.length > participatingMembers.length && (
                <optgroup label="Other Tm ISHAL Members">
                  {members
                    .filter((m) => !(currentEvent?.memberIds || []).includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        👤 {m.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 5.5. Payment Method (Cash vs Bank Transfer / Online) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Payment Mode <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2.5 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                    : 'bg-[#111A2E] border-slate-800 text-slate-400 hover:text-white hover:bg-[#15223C]'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>💵 Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2.5 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  paymentMethod === 'bank'
                    ? 'bg-blue-950/80 border-blue-500/80 text-blue-300 shadow-md shadow-blue-950/40 ring-1 ring-blue-500/40'
                    : 'bg-[#111A2E] border-slate-800 text-slate-400 hover:text-white hover:bg-[#15223C]'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>🏦 Bank / UPI</span>
              </button>
            </div>
          </div>

          {/* 6. Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-mono-num font-medium"
            />
          </div>

          {/* 7. Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Notes / Receipt Remarks (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Paid via GPay to Caterer, receipt #402"
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>

          {/* Delete Expense Section (When Editing) */}
          {expenseToEdit && (
            <div className="pt-2 border-t border-slate-800">
              {showDeleteConfirm ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 space-y-2.5">
                  <p className="text-xs text-rose-300 font-bold">
                    Delete this expense of {formatINR(expenseToEdit.amount)}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white rounded-xl shadow-xs"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-950/40 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Expense
                </button>
              )}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-600/30 transition-all active:scale-98"
            >
              {expenseToEdit ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
