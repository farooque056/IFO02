import React, { useState, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { EventItem, EventStatus, EventType, PaymentMethod, EventSplitMode } from '../../types';
import { EVENT_TYPE_CATEGORIES, EVENT_TYPE_LABELS } from '../../data/initialData';
import { formatINR } from '../../utils/formatters';
import {
  X,
  CalendarPlus,
  Users,
  MapPin,
  Calendar,
  Tag,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Banknote,
  Building2,
  CreditCard,
  Receipt,
  UserCheck,
  Split,
  Calculator,
  Gift,
  HeartHandshake,
  Coins,
} from 'lucide-react';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventToEdit?: EventItem | null;
  defaultDate?: string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  eventToEdit,
  defaultDate,
}) => {
  const { members, addEvent, updateEvent, deleteEvent, addExpense, requireAuth } = useFinance();

  const [name, setName] = useState('');
  const [type, setType] = useState<EventType>('iftar');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<EventStatus>('active');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [weddingPersonId, setWeddingPersonId] = useState<string>('');

  // Split Calculation Modes
  const [splitMode, setSplitMode] = useState<EventSplitMode>('even');
  const [targetSplitAmount, setTargetSplitAmount] = useState<string>('');
  const [minimumAmountPerPerson, setMinimumAmountPerPerson] = useState<string>('500');

  // Initial Event Amount & Split State
  const [initialAmount, setInitialAmount] = useState<string>('');
  const [paidById, setPaidById] = useState<string>('fund');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [initialExpenseCategory, setInitialExpenseCategory] = useState<string>('');
  const [initialExpenseTitle, setInitialExpenseTitle] = useState<string>('');

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (eventToEdit) {
        setName(eventToEdit.name);
        setType(eventToEdit.type);
        setDate(eventToEdit.date);
        setLocation(eventToEdit.location || '');
        setStatus(eventToEdit.status);
        setWeddingPersonId(eventToEdit.weddingPersonId || '');
        setSelectedMemberIds(eventToEdit.memberIds || []);
        setCategories(eventToEdit.categories || EVENT_TYPE_CATEGORIES[eventToEdit.type]);
        setNotes(eventToEdit.notes || '');
        setSplitMode(eventToEdit.splitMode || 'even');
        setTargetSplitAmount(eventToEdit.targetSplitAmount ? String(eventToEdit.targetSplitAmount) : '');
        setMinimumAmountPerPerson(eventToEdit.minimumAmountPerPerson ? String(eventToEdit.minimumAmountPerPerson) : '500');
        setInitialAmount('');
        setPaidById('fund');
        setPaymentMethod('cash');
      } else {
        setName('');
        setType('iftar');
        setDate(defaultDate || new Date().toISOString().slice(0, 10));
        setLocation('');
        setStatus('active');
        setWeddingPersonId('');
        // Default to all members selected
        setSelectedMemberIds(members.map((m) => m.id));
        setCategories(EVENT_TYPE_CATEGORIES.iftar);
        setNotes('');
        setSplitMode('even');
        setTargetSplitAmount('');
        setMinimumAmountPerPerson('500');
        setInitialAmount('');
        setPaidById('fund');
        setPaymentMethod('cash');
        setInitialExpenseCategory(EVENT_TYPE_CATEGORIES.iftar[0] || 'Food & Catering');
        setInitialExpenseTitle('');
      }
      setNewCatInput('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, eventToEdit, defaultDate, members]);

  // Live split calculation
  const parsedAmount = parseFloat(initialAmount) || 0;
  const parsedTargetSplit = parseFloat(targetSplitAmount) || 0;
  const parsedMinimumAmount = parseFloat(minimumAmountPerPerson) || 0;
  const participantCount = selectedMemberIds.length;
  const isWeddingPersonExempt = Boolean(
    type === 'wedding' && weddingPersonId && selectedMemberIds.includes(weddingPersonId)
  );
  const splittingCount = isWeddingPersonExempt
    ? Math.max(1, participantCount - 1)
    : participantCount;

  // Amount used for even calculation (either explicit target or initial entered expense)
  const activeEvenTarget = parsedTargetSplit > 0 ? parsedTargetSplit : parsedAmount;
  const perMemberSplit =
    splittingCount > 0 && activeEvenTarget > 0
      ? Math.round(activeEvenTarget / splittingCount)
      : 0;
  const perMemberEvenSplit = perMemberSplit;
  const totalMinimumTarget = splittingCount > 0 && parsedMinimumAmount > 0
    ? parsedMinimumAmount * splittingCount
    : 0;

  if (!isOpen) return null;

  const handleTypeChange = (newType: EventType) => {
    setType(newType);
    const newCats = EVENT_TYPE_CATEGORIES[newType];
    setCategories(newCats);
    if (newCats.length > 0 && !newCats.includes(initialExpenseCategory)) {
      setInitialExpenseCategory(newCats[0]);
    }
    // If switching to wedding, auto-suggest or sync groom and event name
    if (newType === 'wedding') {
      if (!weddingPersonId && name.trim()) {
        const lowerName = name.toLowerCase();
        const matchedMember = members.find((m) => lowerName.includes(m.name.toLowerCase()));
        if (matchedMember) {
          setWeddingPersonId(matchedMember.id);
          if (!selectedMemberIds.includes(matchedMember.id)) {
            setSelectedMemberIds((prev) => [...prev, matchedMember.id]);
          }
        }
      } else if (weddingPersonId) {
        const groom = members.find((m) => m.id === weddingPersonId);
        if (groom && (!name.trim() || name.endsWith("'s Wedding") || name.endsWith(" Wedding") || name === 'Wedding Event')) {
          setName(`${groom.name}'s Wedding`);
        }
      }
    }
  };

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAllMembers = () => {
    setSelectedMemberIds(members.map((m) => m.id));
  };

  const handleDeselectAllMembers = () => {
    setSelectedMemberIds([]);
  };

  const handleAddCategory = () => {
    if (!newCatInput.trim()) return;
    const cat = newCatInput.trim();
    if (!categories.includes(cat)) {
      setCategories([...categories, cat]);
    }
    setNewCatInput('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter((c) => c !== catToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const groomMember = members.find((m) => m.id === weddingPersonId);
    let resolvedName = name.trim();
    if (!resolvedName) {
      if (type === 'wedding') {
        resolvedName = groomMember ? `${groomMember.name}'s Wedding` : 'Wedding Event';
      } else {
        return;
      }
    }

    const actualWeddingPersonId = type === 'wedding' && weddingPersonId ? weddingPersonId : undefined;
    const actualExemptIds = actualWeddingPersonId ? [actualWeddingPersonId] : [];

    const parsedTarget = splitMode === 'even' && parsedTargetSplit > 0 ? parsedTargetSplit : undefined;
    const parsedMin = splitMode === 'minimum' && parsedMinimumAmount > 0 ? parsedMinimumAmount : undefined;

    if (eventToEdit) {
      updateEvent(eventToEdit.id, {
        name: resolvedName,
        type,
        date,
        location: location.trim(),
        status,
        weddingPersonId: actualWeddingPersonId,
        exemptMemberIds: actualExemptIds,
        memberIds: selectedMemberIds,
        categories,
        splitMode,
        targetSplitAmount: parsedTarget,
        minimumAmountPerPerson: parsedMin,
        notes: notes.trim(),
      });

      // If an extra amount was entered while editing, record it as an expense
      if (parsedAmount > 0) {
        addExpense({
          eventId: eventToEdit.id,
          name: initialExpenseTitle.trim() || `${resolvedName} - Additional Expense`,
          category: initialExpenseCategory || categories[0] || 'Event Budget',
          amount: parsedAmount,
          date,
          paidById,
          paymentMethod,
          notes: notes ? `${notes} (Added during event edit)` : `Expense split among ${splittingCount} participating members`,
        });
      }
    } else {
      const newEventId = addEvent({
        name: resolvedName,
        type,
        date,
        location: location.trim(),
        status,
        weddingPersonId: actualWeddingPersonId,
        exemptMemberIds: actualExemptIds,
        memberIds: selectedMemberIds,
        categories: categories.length > 0 ? categories : EVENT_TYPE_CATEGORIES[type],
        splitMode,
        targetSplitAmount: parsedTarget,
        minimumAmountPerPerson: parsedMin,
        notes: notes.trim(),
      });

      // If initial amount is provided, automatically add initial expense record
      if (parsedAmount > 0 && newEventId) {
        addExpense({
          eventId: newEventId,
          name: initialExpenseTitle.trim() || `${resolvedName} - Initial Budget / Cost`,
          category: initialExpenseCategory || categories[0] || 'Event Budget',
          amount: parsedAmount,
          date,
          paidById,
          paymentMethod,
          notes: notes ? `${notes} (Initial Event Amount)` : `Initial event amount split among ${splittingCount} participating members`,
        });
      }
    }

    onClose();
  };

  const handleDelete = () => {
    if (eventToEdit) {
      requireAuth(() => {
        deleteEvent(eventToEdit.id);
        onClose();
      });
    }
  };

  const eventTypesList: EventType[] = [
    'iftar',
    'wedding',
    'picnic',
    'eid',
    'sports',
    'meeting',
    'party',
    'custom',
  ];

  const selectedMembersList = members.filter((m) => selectedMemberIds.includes(m.id));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <CalendarPlus className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                {eventToEdit ? 'Edit Event Details' : 'Create New Event'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Tm ISHAL Group Financial Record
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

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1 bg-[#0D1527]">
          {/* 1. Event Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Event / Function Name{' '}
                {type === 'wedding' ? (
                  <span className="text-emerald-400 font-semibold normal-case text-[11px] ml-1 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                    (Not mandatory for Wedding • auto-set from Groom)
                  </span>
                ) : (
                  <span className="text-rose-400">*</span>
                )}
              </label>
              {type === 'wedding' && weddingPersonId && (
                <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
                  💍 Groom: {members.find((m) => m.id === weddingPersonId)?.name}
                </span>
              )}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === 'wedding'
                  ? weddingPersonId
                    ? `${members.find((m) => m.id === weddingPersonId)?.name}'s Wedding (Auto-set)`
                    : "e.g., Groom's Wedding (Optional - auto-named from groom)"
                  : 'e.g., Tm ISHAL Grand Iftar 2026, Wayanad Trip'
              }
              className="w-full px-4 py-3 bg-[#111A2E] border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-semibold"
              required={type !== 'wedding'}
            />
            {type === 'wedding' && (
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  {weddingPersonId
                    ? `Groom selected: if left empty, will automatically save as "${members.find((m) => m.id === weddingPersonId)?.name}'s Wedding".`
                    : 'Choose the Groom in the wedding card below and the event name will be set automatically!'}
                </span>
              </p>
            )}
          </div>

          {/* 2. Event Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Event Type (Sets Default Categories) <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {eventTypesList.map((t) => {
                const isSelected = type === t;
                const info = EVENT_TYPE_LABELS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border text-center transition-all duration-150 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs scale-102 font-bold'
                        : 'bg-[#111A2E] text-slate-300 border-slate-800 hover:bg-[#16233E]'
                    }`}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2.5 Wedding Member Celebrant Card (Exempt from split) */}
          {type === 'wedding' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/70 via-[#1B1226] to-[#121A2E] border-2 border-rose-500/60 shadow-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center font-bold text-lg shrink-0">
                    💍
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      Wedding Team Member (Groom / Bride)
                      <span className="text-[10px] uppercase font-extrabold bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40">
                        Zero Split • ₹0
                      </span>
                    </h4>
                    <p className="text-[11px] text-rose-200/80 mt-0.5">
                      It is our team member's wedding! Cost will <strong>NOT be split</strong> to the wedding person. Remaining members will share the expense.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-300 mb-1.5">
                  Select Team Member Getting Married (Groom / Bride)
                </label>
                <select
                  value={weddingPersonId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setWeddingPersonId(newId);
                    const groom = members.find((m) => m.id === newId);
                    if (groom) {
                      // Automatically set name if empty or previous wedding template
                      if (!name.trim() || name.endsWith("'s Wedding") || name.endsWith(" Wedding") || name === 'Wedding Event') {
                        setName(`${groom.name}'s Wedding`);
                      }
                    }
                    if (newId && !selectedMemberIds.includes(newId)) {
                      setSelectedMemberIds((prev) => [...prev, newId]);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#0D1527] border border-rose-800/80 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                >
                  <option value="">-- Choose Team Member (e.g. Ameen, Shanavas, Fayis...) --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.phone ? `(${m.phone})` : ''} {m.role ? `• ${m.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {weddingPersonId ? (
                <div className="p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎉</span>
                    <span>
                      <strong>{members.find((m) => m.id === weddingPersonId)?.name}</strong> will pay <strong>₹0 share</strong> (Exempt from split).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const prevGroom = members.find((m) => m.id === weddingPersonId);
                      setWeddingPersonId('');
                      if (prevGroom && name === `${prevGroom.name}'s Wedding`) {
                        setName('');
                      }
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-200 underline font-medium cursor-pointer"
                  >
                    Clear exemption
                  </button>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-400 italic">
                  Tip: If this is an outside wedding where all attending members split equally, leave this unselected.
                </p>
              )}
            </div>
          )}

          {/* 3. Date, Location & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#111A2E] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-mono-num font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Hall or City"
                className="w-full px-3.5 py-2.5 bg-[#111A2E] border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="w-full px-3.5 py-2.5 bg-[#111A2E] border border-slate-800 rounded-2xl text-xs text-white focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
              >
                <option value="active">Active (Open)</option>
                <option value="hold">On Hold (Paused)</option>
                <option value="completed">Closed (Completed)</option>
                <option value="planning">Planning (Upcoming)</option>
              </select>
            </div>
          </div>

          {/* 4. Select Participating Members */}
          <div className="bg-[#0A1325]/70 p-4 rounded-2xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-400" />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Participating Members ({selectedMemberIds.length} of {members.length})
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllMembers}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold"
                >
                  Select All
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAllMembers}
                  className="text-[11px] text-slate-400 hover:text-slate-200 font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
              {members.map((member) => {
                const isSelected = selectedMemberIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleToggleMember(member.id)}
                    className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-blue-950/60 border-blue-800/80 text-white shadow-xs'
                        : 'bg-[#111A2E] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-slate-600 bg-[#0B1323]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3px]" />}
                    </div>
                    <span className="text-xs font-semibold truncate">{member.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. EVENT CASH SPLIT CALCULATION MODES */}
          <div className="bg-[#0B1426] p-4.5 rounded-3xl border border-blue-900/50 shadow-inner space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                  <Split className="w-4 h-4" />
                </div>
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                    Event Cash Split Calculation
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Choose how event costs are divided and collected from members
                  </p>
                </div>
              </div>
            </div>

            {/* Split Mode Selector (Two explicit options) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Mode 1: Even Split */}
              <button
                type="button"
                onClick={() => setSplitMode('even')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  splitMode === 'even'
                    ? 'bg-gradient-to-br from-blue-950/80 to-[#101E3D] border-blue-500 text-white shadow-lg shadow-blue-900/20 ring-1 ring-blue-500/50'
                    : 'bg-[#0E172B] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-blue-300">
                    <Split className="w-3.5 h-3.5 text-blue-400" />
                    <span>1. Particular Amount Even Split</span>
                  </span>
                  {splitMode === 'even' && (
                    <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Divide a particular fixed target amount or actual expenses equally across members.
                </p>
              </button>

              {/* Mode 2: Minimum Amount Per Person (with voluntary donations) */}
              <button
                type="button"
                onClick={() => {
                  setSplitMode('minimum');
                  if (!minimumAmountPerPerson) setMinimumAmountPerPerson('500');
                }}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  splitMode === 'minimum'
                    ? 'bg-gradient-to-br from-emerald-950/80 to-[#0D2924] border-emerald-500 text-white shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/50'
                    : 'bg-[#0E172B] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-300">
                    <Gift className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2. Minimum Amount Per Person</span>
                  </span>
                  {splitMode === 'minimum' && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Set minimum mandatory floor. <strong className="text-emerald-300">Someone can donate more money!</strong>
                </p>
              </button>
            </div>

            {/* MODE 1 CONFIGURATION: Particular Amount Splitting Even */}
            {splitMode === 'even' && (
              <div className="p-3.5 rounded-2xl bg-[#0E172B] border border-blue-900/40 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Calculator className="w-3.5 h-3.5 text-blue-400" />
                      Particular Target Amount to Split (₹)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Enter fixed budget to split equally, or leave 0 to split actual expenses as bills arrive
                    </p>
                  </div>
                  {targetSplitAmount && (
                    <button
                      type="button"
                      onClick={() => setTargetSplitAmount('')}
                      className="text-[10px] font-bold text-slate-400 hover:text-white"
                    >
                      Clear Target
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-blue-400 font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={targetSplitAmount}
                    onChange={(e) => setTargetSplitAmount(e.target.value)}
                    placeholder={parsedAmount > 0 ? `Splitting initial ${formatINR(parsedAmount)}` : "0 (Split actual total bills)"}
                    className="w-full pl-8 pr-4 py-2.5 bg-[#080E1C] border border-slate-700 rounded-xl text-base font-extrabold font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Quick Target Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Presets:</span>
                  {[2000, 5000, 10000, 20000, 50000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTargetSplitAmount(String(preset))}
                      className="px-2 py-0.5 rounded-lg bg-[#142038] hover:bg-blue-600/30 text-slate-300 hover:text-blue-200 border border-slate-700 text-[11px] font-mono-num font-semibold transition-all"
                    >
                      {formatINR(preset)}
                    </button>
                  ))}
                </div>

                {/* Live Even Calculation Summary */}
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-[#080E1C] border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Target to Split</span>
                    <span className="text-sm font-extrabold text-white font-mono-num">
                      {activeEvenTarget > 0 ? formatINR(activeEvenTarget) : 'Actual Expenses'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60">
                    <span className="text-[10px] text-blue-300 uppercase font-bold block">
                      Per Member ({splittingCount} members)
                    </span>
                    <span className="text-sm font-extrabold text-blue-400 font-mono-num">
                      {activeEvenTarget > 0 && splittingCount > 0
                        ? `${formatINR(perMemberEvenSplit)} / person`
                        : 'Dynamic based on bills'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2 CONFIGURATION: Minimum Amount Per Person (Donations allowed) */}
            {splitMode === 'minimum' && (
              <div className="p-3.5 rounded-2xl bg-[#0E1E26] border border-emerald-900/50 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-emerald-400" />
                      Minimum Floor Amount Per Person (₹) <span className="text-rose-400">*</span>
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Mandatory baseline each member must pay. Anyone can donate more!
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-emerald-400 font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={minimumAmountPerPerson}
                    onChange={(e) => setMinimumAmountPerPerson(e.target.value)}
                    placeholder="500"
                    className="w-full pl-8 pr-4 py-2.5 bg-[#071517] border border-emerald-800/80 rounded-xl text-base font-extrabold font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* Quick Minimum Amount Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-emerald-400/80 font-bold uppercase mr-1">Floor Presets:</span>
                  {[200, 300, 500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMinimumAmountPerPerson(String(preset))}
                      className="px-2 py-0.5 rounded-lg bg-[#0C2424] hover:bg-emerald-600/30 text-emerald-300 hover:text-emerald-100 border border-emerald-800/80 text-[11px] font-mono-num font-semibold transition-all"
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>

                {/* Mode Explanation Banner */}
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-xs text-emerald-200 flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[11px] leading-tight">
                    <strong>Donation Friendly:</strong> Every member owes at least <strong>{formatINR(parsedMinimumAmount)}</strong>. Any member who pays more will have the excess celebrated as a voluntary donation!
                  </p>
                </div>

                {/* Live Minimum Calculation Cards */}
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="p-2.5 rounded-xl bg-[#071517] border border-emerald-900/70">
                    <span className="text-[10px] text-emerald-400/80 uppercase font-bold block">Minimum / Person</span>
                    <span className="text-sm font-extrabold text-emerald-300 font-mono-num">
                      {formatINR(parsedMinimumAmount)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80">
                    <span className="text-[10px] text-emerald-300 uppercase font-bold block">
                      Target Minimum ({splittingCount} members)
                    </span>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono-num">
                      {formatINR(totalMinimumTarget)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Wedding Person Exemption Banner */}
            {isWeddingPersonExempt && (
              <div className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>💍</span>
                  <span>
                    Wedding member (<strong>{members.find((m) => m.id === weddingPersonId)?.name}</strong>) is exempt from split.
                  </span>
                </span>
                <span className="font-mono-num font-bold text-rose-400">₹0 Share</span>
              </div>
            )}

            {/* Roster Allocation Preview */}
            {selectedMembersList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {splitMode === 'minimum' ? 'Minimum Expected Collection Roster:' : 'Individual Member Allocation Roster:'}
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {selectedMembersList.map((m) => {
                    const isGroom = isWeddingPersonExempt && m.id === weddingPersonId;
                    const expectedDisplay = isGroom
                      ? '₹0 (Exempt)'
                      : splitMode === 'minimum'
                      ? `Min ${formatINR(parsedMinimumAmount)}`
                      : activeEvenTarget > 0
                      ? formatINR(perMemberEvenSplit)
                      : 'Equal Share';

                    return (
                      <div
                        key={m.id}
                        className={`px-2 py-1 rounded-lg border text-[11px] flex items-center justify-between gap-2 shadow-xs ${
                          isGroom
                            ? 'bg-rose-950/80 border-rose-700/80 text-rose-200 font-semibold'
                            : splitMode === 'minimum'
                            ? 'bg-[#091D1F] border-emerald-900/60 text-slate-200'
                            : 'bg-[#0B1323] border-slate-700/80 text-slate-200'
                        }`}
                      >
                        <span className="truncate max-w-[110px] font-medium">
                          {isGroom && '💍 '}
                          {m.name}
                        </span>
                        <span
                          className={`font-mono-num font-bold text-[10px] ${
                            isGroom
                              ? 'text-rose-400'
                              : splitMode === 'minimum'
                              ? 'text-emerald-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {expectedDisplay}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upfront Initial Expense (Optional) */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-blue-400" />
                  Optional Upfront Expense / Bill Entry (₹)
                </label>
                <span className="text-[10px] text-slate-400">Can also be added later</span>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder="0 (e.g. food advance, hall booking)"
                  className="w-full pl-8 pr-4 py-2 bg-[#0E172B] border border-slate-700 rounded-xl text-sm font-bold font-mono-num text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {parsedAmount > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Who paid this upfront?
                    </label>
                    <select
                      value={paidById}
                      onChange={(e) => setPaidById(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0B1323] border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
                    >
                      <option value="fund">🏦 Tm ISHAL Common Fund / Pool</option>
                      {selectedMembersList.map((m) => (
                        <option key={m.id} value={m.id}>
                          👤 {m.name} {m.role ? `(${m.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                          paymentMethod === 'cash'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-[#0B1323] text-slate-400 border-slate-700'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Cash</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank')}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border transition-all ${
                          paymentMethod === 'bank'
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[#0B1323] text-slate-400 border-slate-700'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Bank/UPI</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. Predefined & Custom Expense Categories */}
          <div className="bg-[#0A1325]/70 p-4 rounded-2xl border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-blue-400" />
                Expense Categories ({categories.length})
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Preset for {EVENT_TYPE_LABELS[type].label}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs bg-[#111A2E] border border-slate-800 text-slate-300 shadow-xs font-medium"
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => handleRemoveCategory(cat)}
                    className="text-slate-400 hover:text-rose-400 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add category field */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                placeholder="Add custom category..."
                className="flex-1 px-3.5 py-2 bg-[#111A2E] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.4px]" /> Add
              </button>
            </div>
          </div>

          {/* 7. Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Event Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Coordination team, special arrangements, fund allocation"
              className="w-full px-4 py-2.5 bg-[#111A2E] border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-[#15223C] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>

          {/* Delete Option if editing */}
          {eventToEdit && (
            <div className="pt-2 border-t border-slate-800">
              {showDeleteConfirm ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 space-y-2.5">
                  <p className="text-xs text-rose-300 font-bold">
                    Delete "{eventToEdit.name}" and ALL its recorded expenses?
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
                      Yes, Delete Event
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
                  Delete Event
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
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
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-2xl shadow-md shadow-blue-600/30 transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              {parsedAmount > 0 && <Check className="w-4 h-4 stroke-[3px]" />}
              {eventToEdit
                ? parsedAmount > 0
                  ? 'Save & Add Expense'
                  : 'Save Changes'
                : parsedAmount > 0
                ? `Create Event (${formatINR(parsedAmount)})`
                : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
