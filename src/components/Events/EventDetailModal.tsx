import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { EventItem, Expense } from '../../types';
import { EVENT_TYPE_LABELS } from '../../data/initialData';
import {
  calculateEventSummary,
  formatDate,
  formatINR,
  generateEventWhatsAppText,
  downloadEventCSV,
} from '../../utils/formatters';
import { downloadEventPDF } from '../../utils/pdfGenerator';
import { RecordMemberPaymentModal } from './RecordMemberPaymentModal';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Receipt,
  BookOpenText,
  Plus,
  Share2,
  FileSpreadsheet,
  FileText,
  Download,
  Edit,
  Trash2,
  CheckCircle2,
  PauseCircle,
  RotateCcw,
  Play,
  Tag,
  PieChart,
  Copy,
  Check,
  Building2,
  UserCheck,
  AlertCircle,
  Clock,
  Printer,
  Banknote,
  Send,
  CreditCard,
  DollarSign,
  Search,
  Gift,
  HeartHandshake,
  Coins,
  Split,
} from 'lucide-react';

interface EventDetailModalProps {
  eventId: string;
  onClose: () => void;
  onEditEvent: (event: EventItem) => void;
  onAddExpense: (eventId: string) => void;
  onEditExpense: (expense: Expense) => void;
}

const getBadgeClasses = (type: string) => {
  switch (type) {
    case 'wedding':
      return 'bg-rose-950/60 text-rose-300 border-rose-800/60';
    case 'iftar':
      return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
    case 'picnic':
      return 'bg-amber-950/60 text-amber-300 border-amber-800/60';
    case 'eid':
      return 'bg-teal-950/60 text-teal-300 border-teal-800/60';
    case 'sports':
      return 'bg-blue-950/60 text-blue-300 border-blue-800/60';
    case 'meeting':
      return 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60';
    case 'party':
      return 'bg-purple-950/60 text-purple-300 border-purple-800/60';
    default:
      return 'bg-slate-800/80 text-slate-300 border-slate-700/80';
  }
};

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  eventId,
  onClose,
  onEditEvent,
  onAddExpense,
  onEditExpense,
}) => {
  const { events, expenses, members, transactions, deleteExpense, deleteEvent, updateEvent, requireAuth } = useFinance();

  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'transactions' | 'settlement' | 'categories' | 'members'>('expenses');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'all' | 'cash' | 'bank'>('all');
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [txSearch, setTxSearch] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  // Member Payment Recording State
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [paymentMemberId, setPaymentMemberId] = useState<string | undefined>(undefined);
  const [paymentDefaultAmount, setPaymentDefaultAmount] = useState<number | undefined>(undefined);

  const handleOpenRecordPayment = (memberId?: string, defaultAmount?: number) => {
    requireAuth(() => {
      setPaymentMemberId(memberId);
      setPaymentDefaultAmount(defaultAmount);
      setIsRecordPaymentOpen(true);
    });
  };

  const handleDeleteEvent = () => {
    requireAuth(() => {
      deleteEvent(eventId);
      setShowDeleteConfirmModal(false);
      onClose();
    });
  };

  const event = events.find((e) => e.id === eventId);
  const eventExpenses = useMemo(() => {
    return expenses.filter((e) => e.eventId === eventId);
  }, [expenses, eventId]);

  const eventTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.eventId === eventId || (event && tx.event.toLowerCase() === event.name.toLowerCase()));
  }, [transactions, eventId, event]);

  const eventContributions = useMemo(() => {
    return eventTransactions.filter(
      (tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid'
    );
  }, [eventTransactions]);

  const totalEventCollections = useMemo(() => {
    return eventContributions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [eventContributions]);

  const eventBalance = totalEventCollections > 0 ? (totalEventCollections - (eventExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))) : null;

  if (!event) return null;

  const summary = calculateEventSummary(event, expenses, members, transactions);
  const typeInfo = EVENT_TYPE_LABELS[event.type] || { label: event.type, color: 'slate' };
  const badgeClass = getBadgeClasses(event.type);

  // Filtered expenses
  const filteredExpenses = eventExpenses.filter((exp) => {
    const matchesCat = filterCategory === 'all' || exp.category === filterCategory;
    const matchesMethod =
      filterPaymentMethod === 'all' ||
      (filterPaymentMethod === 'cash' && (exp.paymentMethod || 'cash') === 'cash') ||
      (filterPaymentMethod === 'bank' && exp.paymentMethod === 'bank');
    const matchesSearch =
      !expenseSearch ||
      exp.name.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      exp.notes?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      exp.category.toLowerCase().includes(expenseSearch.toLowerCase());
    return matchesCat && matchesMethod && matchesSearch;
  });

  const handleCopyWhatsApp = () => {
    const text = generateEventWhatsAppText(event, expenses, members, transactions);
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleSendReminder = (memberName: string, amount: number) => {
    const text = `Salam ${memberName}, reminder for *${event.name}*: Your pending share is *${formatINR(amount)}*. Kindly transfer via UPI or cash to settle. Thank you!`;
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl mx-auto h-[94vh] sm:h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top App Bar */}
        <header className="bg-[#0D1527]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Back to events"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2px]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-[180px] sm:max-w-xs leading-tight">
                  {event.name}
                </h2>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
                  {typeInfo.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 font-medium">
                <span className="flex items-center gap-1 font-mono-num">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(event.date)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1 truncate max-w-[140px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {event.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => downloadEventPDF(event, expenses, members)}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
              title="Download Well-Designed PDF Financial Statement"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.4px]" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => requireAuth(() => onEditEvent(event))}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors"
              title="Edit event settings & members"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className={`p-2 rounded-xl border transition-all ${
                copiedWhatsApp
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700/80'
              }`}
              title="Copy WhatsApp Summary"
            >
              {copiedWhatsApp ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => downloadEventCSV(event, expenses, members)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors"
              title="Export CSV spreadsheet backup"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDeleteConfirmModal(true)}
              className="p-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/70 text-rose-400 hover:text-rose-200 border border-rose-800/60 transition-colors"
              title="Delete this event"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-12 bg-[#0B1120]">
          {/* Financial KPI Card - Modern Deep Navy Aesthetic */}
          <div className="bg-gradient-to-br from-[#0F1C36] via-[#111F3E] to-[#0A1325] border border-blue-900/40 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              {/* Primary Expense Metric & Status */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                    {totalEventCollections > 0 ? 'Event Financial Summary' : 'Total Event Expenditure'}
                  </span>
                  <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Expenses:</span>
                      <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-mono-num tracking-tight">
                        {formatINR(summary.totalCost)}
                      </h1>
                    </div>
                    {totalEventCollections > 0 && (
                      <div className="pl-3 border-l border-slate-700">
                        <span className="text-xs text-emerald-400 block font-medium">Collections ({eventContributions.length}):</span>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono-num tracking-tight">
                          {formatINR(totalEventCollections)}
                        </h1>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:items-end gap-1.5 self-start sm:self-auto">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
                    event.status === 'completed'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70'
                      : event.status === 'hold'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-800/70'
                      : event.status === 'planning'
                      ? 'bg-indigo-950/70 text-indigo-300 border-indigo-800/70'
                      : 'bg-blue-950/70 text-blue-300 border-blue-800/70'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {event.status === 'hold' ? 'ON HOLD' : event.status === 'completed' ? 'CLOSED' : event.status.toUpperCase()}
                  </span>

                  {eventBalance !== null && (
                    <div className="px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold font-mono-num flex items-center gap-1.5">
                      <span>Balance:</span>
                      <span className="text-amber-200 font-black">{formatINR(eventBalance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Split Mode & Policy Badge */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {summary.splitMode === 'minimum' ? (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600/60 text-xs text-emerald-200 flex items-center gap-2 shadow-xs">
                    <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Minimum Floor Split:</strong> {formatINR(summary.perMemberCost)} / person <span className="text-emerald-300 font-semibold">(Voluntary Donations Allowed)</span>
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-blue-950/80 border border-blue-600/60 text-xs text-blue-200 flex items-center gap-2 shadow-xs">
                    <Split className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      <strong>Even Split:</strong> {summary.targetSplitAmount ? `Target ${formatINR(summary.targetSplitAmount)}` : 'Dividing all bills equally'} ({formatINR(summary.perMemberCost)} / member)
                    </span>
                  </div>
                )}

                {summary.totalDonations > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-xs text-amber-200 flex items-center gap-1.5 shadow-xs">
                    <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Extra Voluntary Donations: <strong className="font-mono-num text-amber-300">+{formatINR(summary.totalDonations)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Wedding Person Exemption Banner */}
              {summary.weddingPersonName && (
                <div className="mt-3 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-950/80 to-pink-950/40 border border-rose-600/50 flex items-center justify-between gap-2 text-xs text-rose-200 shadow-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">💍</span>
                    <span className="truncate">
                      <strong>{summary.weddingPersonName}</strong> is our wedding team member and is <strong>exempt from split (₹0)</strong>.
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                    Zero Share
                  </span>
                </div>
              )}

              {/* Sub-metrics Grid (Per Member, Total Members, Bills Count) */}
              <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-blue-950/80">
                <div className="bg-[#0A1325]/80 backdrop-blur-sm p-3 rounded-2xl border border-blue-900/40">
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Per Member Share {summary.weddingPersonName ? `(${summary.splittingMemberCount} paying)` : ''}
                  </p>
                  <p className="text-sm sm:text-base font-extrabold text-white font-mono-num mt-0.5">
                    {formatINR(summary.perMemberCost)}
                  </p>
                </div>

                <div className="bg-[#0A1325]/80 backdrop-blur-sm p-3 rounded-2xl border border-blue-900/40">
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Enrolled</p>
                  <p className="text-sm sm:text-base font-extrabold text-blue-400 font-mono-num mt-0.5">
                    {summary.memberCount} <span className="text-[10px] text-slate-400 font-normal">pax</span>
                  </p>
                </div>

                <div className="bg-[#0A1325]/80 backdrop-blur-sm p-3 rounded-2xl border border-blue-900/40">
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider">Total Bills</p>
                  <p className="text-sm sm:text-base font-extrabold text-white font-mono-num mt-0.5">
                    {summary.totalExpensesCount} <span className="text-[10px] text-slate-400 font-normal">items</span>
                  </p>
                </div>
              </div>

              {/* Cash vs Bank Transfer Breakdown */}
              <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                <div className="bg-[#0A1325]/80 backdrop-blur-sm p-2.5 rounded-xl border border-blue-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <Banknote className="w-3.5 h-3.5" />
                    <span className="font-semibold text-[11px]">Cash Paid:</span>
                  </div>
                  <span className="font-mono-num font-bold text-xs text-emerald-300">
                    {formatINR(summary.cashTotal)}
                  </span>
                </div>

                <div className="bg-[#0A1325]/80 backdrop-blur-sm p-2.5 rounded-xl border border-blue-900/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-blue-400">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="font-semibold text-[11px]">Bank / UPI:</span>
                  </div>
                  <span className="font-mono-num font-bold text-xs text-blue-300">
                    {formatINR(summary.bankTotal)}
                  </span>
                </div>
              </div>

              {/* Unpaid Member Status Alert */}
              {summary.unpaidMembersCount > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800/70 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <p className="text-xs text-rose-200 truncate">
                      <strong>{summary.unpaidMembersCount} Members pending payment</strong> ({formatINR(summary.totalUnpaidAmount)} due)
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveSubTab('settlement')}
                    className="text-[11px] font-bold text-rose-300 hover:text-white bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-700/60 shrink-0 transition-colors"
                  >
                    View Due
                  </button>
                </div>
              )}

              {/* Statement Download & WhatsApp Actions */}
              <div className="mt-3.5 pt-3.5 border-t border-blue-950/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => downloadEventPDF(event, expenses, members, transactions)}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all active:scale-[0.99]"
                >
                  <FileText className="w-4 h-4 stroke-[2.2px]" />
                  <span>Download PDF Statement</span>
                </button>

                <button
                  onClick={handleCopyWhatsApp}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-800/70 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99]"
                >
                  {copiedWhatsApp ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Copy WhatsApp Statement</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Admin Event Lifecycle & Status Bar */}
          <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            event.status === 'completed'
              ? 'bg-gradient-to-r from-emerald-950/40 via-[#0B1424] to-[#0A1325] border-emerald-800/50'
              : event.status === 'hold'
              ? 'bg-gradient-to-r from-amber-950/40 via-[#0B1424] to-[#0A1325] border-amber-800/50'
              : 'bg-gradient-to-r from-blue-950/30 via-[#0B1424] to-[#0A1325] border-blue-900/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                event.status === 'completed'
                  ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800/70'
                  : event.status === 'hold'
                  ? 'bg-amber-950/90 text-amber-400 border-amber-800/70'
                  : 'bg-blue-950/90 text-blue-400 border-blue-800/70'
              }`}>
                {event.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : event.status === 'hold' ? (
                  <PauseCircle className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Admin Control:</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    event.status === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : event.status === 'hold'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-blue-950 text-blue-300 border-blue-700'
                  }`}>
                    {event.status === 'completed' ? 'Closed' : event.status === 'hold' ? 'On Hold' : 'Active / Open'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {event.status === 'completed'
                    ? 'Event is marked as closed. You can reopen it at any time.'
                    : event.status === 'hold'
                    ? 'Event is currently on hold. You can resume/reopen or close it.'
                    : 'Event is currently open. You can close it or place it on hold.'}
                </p>
              </div>
            </div>

            {/* Quick Lifecycle Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {event.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => requireAuth(() => updateEvent(event.id, { status: 'completed' }))}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-800/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                  title="Close Event"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Close Event</span>
                </button>
              )}

              {event.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => requireAuth(() => updateEvent(event.id, { status: 'active' }))}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-blue-600/30"
                  title="Reopen Event"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Event</span>
                </button>
              )}

              {event.status !== 'hold' && (
                <button
                  type="button"
                  onClick={() => requireAuth(() => updateEvent(event.id, { status: 'hold' }))}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/90 hover:bg-amber-900 text-amber-300 hover:text-white border border-amber-800/80 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
                  title="Put on Hold"
                >
                  <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hold</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex bg-[#111A2E]/90 p-1.5 rounded-2xl border border-slate-800/90 shadow-xs gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveSubTab('expenses')}
              className={`flex-1 min-w-[70px] py-2 px-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSubTab === 'expenses'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Expenses ({eventExpenses.length})
            </button>
            <button
              onClick={() => setActiveSubTab('transactions')}
              className={`flex-1 min-w-[75px] py-2 px-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSubTab === 'transactions'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ledger ({eventTransactions.length})
            </button>
            <button
              onClick={() => setActiveSubTab('settlement')}
              className={`flex-1 min-w-[80px] py-2 px-1 rounded-xl text-xs font-bold transition-all relative whitespace-nowrap ${
                activeSubTab === 'settlement'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Settlement
              {summary.unpaidMembersCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full">
                  {summary.unpaidMembersCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('categories')}
              className={`flex-1 min-w-[75px] py-2 px-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSubTab === 'categories'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Categories
            </button>
            <button
              onClick={() => setActiveSubTab('members')}
              className={`flex-1 min-w-[75px] py-2 px-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeSubTab === 'members'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Members ({summary.memberCount})
            </button>
          </div>

        {/* TAB 1: EXPENSES LIST */}
        {activeSubTab === 'expenses' && (
          <div className="space-y-3">
            {/* Action Bar & Filters inside Expenses Tab */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => requireAuth(() => onAddExpense(event.id))}
                  className="py-2.5 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[2.6px]" />
                  Add Expense
                </button>

                <button
                  onClick={() => handleOpenRecordPayment()}
                  className="py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                  title="Record member contribution or share payment"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.4px]" />
                  Record Payment
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Cash vs Bank Filter Toggle */}
                <div className="flex items-center bg-[#111A2E] p-0.5 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setFilterPaymentMethod('all')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      filterPaymentMethod === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterPaymentMethod('cash')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      filterPaymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-3 h-3" /> Cash
                  </button>
                  <button
                    onClick={() => setFilterPaymentMethod('bank')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      filterPaymentMethod === 'bank'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-3 h-3" /> Bank
                  </button>
                </div>

                {/* Category Filter dropdown */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#111A2E] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-medium"
                >
                  <option value="all">All Categories</option>
                  {event.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expenses List */}
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center bg-[#111A2E]/90 border border-slate-800 rounded-2xl shadow-xs">
                <Receipt className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">No expenses match filters</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Try adjusting category or payment method filter.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExpenses.map((exp) => {
                  const payer = exp.paidById === 'fund'
                    ? { name: 'Tm ISHAL Fund', isFund: true }
                    : {
                        name: members.find((m) => m.id === exp.paidById)?.name || 'Member',
                        isFund: false,
                      };
                  const isBank = exp.paymentMethod === 'bank';

                  return (
                    <div
                      key={exp.id}
                      className="bg-[#111A2E]/90 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors group shadow-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {exp.name}
                          </h4>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#0B1323] text-slate-300 border border-slate-800 shrink-0">
                            {exp.category}
                          </span>
                          {/* Payment Method Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 flex items-center gap-1 ${
                            isBank
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800/70'
                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
                          }`}>
                            {isBank ? '🏦 Bank / UPI' : '💵 Cash'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                          <span className="font-mono-num">{formatDate(exp.date)}</span>
                          <span>•</span>
                          <span className="truncate">
                            Paid by:{' '}
                            <strong className={payer.isFund ? 'text-blue-400' : 'text-slate-200'}>
                              {payer.name}
                            </strong>
                          </span>
                        </div>

                        {exp.notes && (
                          <p className="text-[11px] text-slate-400 italic mt-1 truncate">
                            {exp.notes}
                          </p>
                        )}
                      </div>

                      {/* Right Amount & Edit action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-base font-extrabold font-mono-num text-white">
                            {formatINR(exp.amount)}
                          </p>
                        </div>
                        <button
                          onClick={() => requireAuth(() => onEditExpense(exp))}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit expense"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: EVENT TRANSACTIONS LEDGER */}
        {activeSubTab === 'transactions' && (
          <div className="space-y-3">
            {/* Filter & Search for Event Ledger */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search TX ID, contributor, notes..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-[#111A2E] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-[#111A2E] p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none">
                {['all', 'Contribution', 'Expense', 'Opening Balance'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTxTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      txTypeFilter === t
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t === 'all' ? 'All Types' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Transactions count & list */}
            {eventTransactions.length === 0 ? (
              <div className="p-8 text-center bg-[#111A2E]/90 border border-slate-800 rounded-2xl shadow-xs">
                <BookOpenText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">No ledger transactions found for this event</p>
                <p className="text-xs text-slate-400 mt-0.5">Transactions added from contributions and expenses will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {eventTransactions
                  .filter((tx) => {
                    const matchesType = txTypeFilter === 'all' || tx.transactionType === txTypeFilter;
                    const q = txSearch.toLowerCase().trim();
                    const matchesQ =
                      !q ||
                      tx.transactionId.toLowerCase().includes(q) ||
                      tx.nameOrCategory.toLowerCase().includes(q) ||
                      tx.notes?.toLowerCase().includes(q) ||
                      tx.category?.toLowerCase().includes(q);
                    return matchesType && matchesQ;
                  })
                  .map((tx) => {
                    const isContr = tx.transactionType === 'Contribution';
                    const isExp = tx.transactionType === 'Expense';

                    return (
                      <div
                        key={tx.transactionId}
                        className="bg-[#111A2E]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded-lg border border-blue-800/70 shrink-0 mt-0.5">
                            {tx.transactionId}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white truncate">
                                {tx.nameOrCategory}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  tx.paymentStatus === 'Paid'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                    : tx.paymentStatus === 'Unpaid'
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                    : 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {tx.paymentStatus}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
                                {tx.transactionType}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                              <span>{formatDate(tx.date)}</span>
                              {tx.category && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400">{tx.category}</span>
                                </>
                              )}
                              {tx.notes && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400 italic truncate max-w-[220px]">{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`text-sm sm:text-base font-extrabold font-mono-num ${
                              isContr
                                ? 'text-emerald-400'
                                : isExp
                                ? 'text-rose-400'
                                : 'text-cyan-400'
                            }`}
                          >
                            {isContr ? '+' : isExp ? '-' : ''}
                            {formatINR(tx.amount)}
                          </p>
                          {tx.runningBalance !== undefined && (
                            <p className="text-[11px] text-cyan-300/90 font-mono-num font-semibold mt-0.5">
                              Bal: {formatINR(tx.runningBalance)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SETTLEMENT / SPLIT & UNPAID MEMBERS */}
        {activeSubTab === 'settlement' && (
          <div className="space-y-4">
            {/* Top Settlement Action Bar */}
            <div className="flex items-center justify-between bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Member Dues & Settlements</h4>
                  <p className="text-[10px] text-slate-400">Record payments or send instant payment reminders</p>
                </div>
              </div>

              <button
                onClick={() => handleOpenRecordPayment()}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.8px]" />
                <span>Enter Payment</span>
              </button>
            </div>

            {/* Special Mutual Fund / Taawun Collections Breakdown */}
            {eventContributions.length > 0 && (
              <div className="bg-[#111A2E]/95 border border-emerald-900/50 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      Contributions & Collection Sheet ({eventContributions.length} entries)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Individual member collections and welfare disbursements
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num font-extrabold text-emerald-300 bg-emerald-950/90 px-3 py-1.5 rounded-xl border border-emerald-800/80">
                      Total: {formatINR(totalEventCollections)}
                    </span>
                  </div>
                </div>

                {/* 2-Column Grid of Collections matching physical sheet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eventContributions.map((tx, idx) => (
                    <div
                      key={tx.transactionId}
                      className="p-2.5 bg-[#0B1323]/90 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono text-slate-500 w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {tx.nameOrCategory}
                        </span>
                        <span className="text-[10px] font-mono text-blue-400 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-900/60">
                          {tx.transactionId}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold font-mono-num text-emerald-400 shrink-0">
                        +{formatINR(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Disbursements (e.g. Hadiya) */}
                {eventExpenses.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-rose-300 mb-2 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-rose-400" />
                      Disbursements / Expenses ({eventExpenses.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {eventExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          className="p-2.5 bg-rose-950/30 border border-rose-900/50 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-rose-200 block truncate">
                              {exp.name}
                            </span>
                            <span className="text-[10px] text-rose-400/80">
                              {exp.category} • {formatDate(exp.date)}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold font-mono-num text-rose-300 shrink-0">
                            -{formatINR(exp.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Balance Highlight matching the spreadsheet */}
                {eventBalance !== null && (
                  <div className="p-4 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl flex items-center justify-between shadow-md">
                    <div>
                      <span className="text-[11px] uppercase font-black tracking-wider text-amber-300 block">
                        Net Fund Surplus / Remaining Balance
                      </span>
                      <p className="text-xs text-amber-200/90 mt-0.5">
                        Total Collections ({formatINR(totalEventCollections)}) - Expenses ({formatINR(summary.totalCost)})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl sm:text-2xl font-black font-mono-num text-amber-300 bg-amber-950/90 px-3.5 py-1.5 rounded-xl border border-amber-400/50 inline-block">
                        {formatINR(eventBalance)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dedicated Unpaid Members Breakdown Section */}
            {summary.unpaidMembers.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    Unpaid Members Statement ({summary.unpaidMembers.length})
                  </h3>
                  <span className="text-xs font-mono-num font-extrabold text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-800/60">
                    Total Due: {formatINR(summary.totalUnpaidAmount)}
                  </span>
                </div>
                <p className="text-xs text-rose-200/80 mb-3">
                  The following members owe their share for this event. You can mark their payments as received or send a reminder:
                </p>

                <div className="space-y-2">
                  {summary.unpaidMembers.map((u) => (
                    <div
                      key={u.memberId}
                      className="p-3 bg-[#0B1323]/90 border border-rose-900/40 rounded-xl flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white">{u.memberName}</p>
                        <p className="text-[11px] text-slate-400">
                          Expected Share: <span className="font-mono-num text-slate-200 font-semibold">{formatINR(summary.perMemberCost)}</span>
                          {u.totalPaid > 0 && (
                            <> • Paid: <span className="font-mono-num text-emerald-400">{formatINR(u.totalPaid)}</span></>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-rose-400 block">Pending</span>
                          <span className="text-xs font-extrabold text-rose-400 font-mono-num">
                            {formatINR(u.amountOwed)}
                          </span>
                        </div>

                        {/* Direct Mark Paid Button */}
                        <button
                          onClick={() => handleOpenRecordPayment(u.memberId, u.amountOwed)}
                          className="py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 text-xs font-bold shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
                          title={`Mark payment for ${u.memberName}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.4px]" />
                          <span>Mark Paid</span>
                        </button>

                        <button
                          onClick={() => handleSendReminder(u.memberName, u.amountOwed)}
                          className="p-1.5 sm:px-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/80 text-emerald-300 flex items-center gap-1 text-[11px] font-bold transition-all"
                          title="Send WhatsApp payment reminder"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remind</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete Member Settlement Balance Sheet */}
            <div className="bg-[#111A2E]/90 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  All Members Settlement Statement
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                {summary.splitMode === 'minimum' ? (
                  <>
                    Split Mode: <strong className="text-emerald-300">Minimum Floor Amount</strong> ({formatINR(summary.perMemberCost)} / person). Members must pay at least this floor, and extra voluntary donations are celebrated.
                    {summary.weddingPersonName && <span className="text-rose-300"> ({summary.weddingPersonName} is exempt)</span>}
                  </>
                ) : summary.weddingPersonName ? (
                  <>
                    Total event cost ({formatINR(summary.totalCost)}) divided equally across {summary.splittingMemberCount} paying members (<strong className="text-rose-300">{summary.weddingPersonName} is exempt</strong>) = <strong className="text-white font-mono-num">{formatINR(summary.perMemberCost)} / member</strong>.
                  </>
                ) : (
                  <>
                    Total event cost ({formatINR(summary.totalCost)}) divided equally across {summary.memberCount} members = <strong className="text-white font-mono-num">{formatINR(summary.perMemberCost)} / member</strong>.
                  </>
                )}
              </p>

              {/* Settlement table */}
              <div className="space-y-2">
                {summary.memberSettlement.map((m) => {
                  const isExempt = m.isExemptFromSplit;
                  const isUnpaid = !isExempt && m.netBalance < 0;
                  const owedAmount = Math.abs(m.netBalance);
                  const isDonor = !isExempt && (m.isDonor || (m.extraDonation && m.extraDonation > 0));

                  return (
                    <div
                      key={m.memberId}
                      className={`p-3 rounded-xl flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap border ${
                        isExempt
                          ? 'bg-rose-950/30 border-rose-800/60'
                          : isDonor
                          ? 'bg-emerald-950/30 border-emerald-700/60'
                          : 'bg-[#0B1323]/80 border-slate-800/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-white">{m.memberName}</p>
                          {isExempt && (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-950/80 border border-rose-700/80 text-rose-300">
                              💍 Wedding Person • Exempt from split
                            </span>
                          )}
                          {isDonor && (
                            <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-950/90 border border-emerald-600 text-emerald-300 flex items-center gap-1">
                              <Gift className="w-2.5 h-2.5 text-emerald-400" /> Donated +{formatINR(m.extraDonation || 0)} Extra!
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Paid: <span className="font-mono-num text-slate-200 font-semibold">{formatINR(m.totalPaid)}</span> •{' '}
                          {summary.splitMode === 'minimum' ? 'Min Required: ' : 'Share: '}
                          <span className={`font-mono-num font-semibold ${isExempt ? 'text-rose-300' : 'text-slate-200'}`}>
                            {isExempt ? '₹0 (Exempt)' : formatINR(m.expectedShare)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          {isExempt ? (
                            <div className="px-2.5 py-1 bg-rose-950/60 border border-rose-800/70 rounded-xl text-right">
                              <span className="text-[10px] uppercase font-bold text-rose-300 block">Exempt</span>
                              <span className="text-xs font-extrabold text-rose-200 font-mono-num">
                                {m.totalPaid > 0 ? `+${formatINR(m.netBalance)}` : '₹0 Share'}
                              </span>
                            </div>
                          ) : isDonor ? (
                            <div className="px-2.5 py-1 bg-emerald-950/70 border border-emerald-600/70 rounded-xl text-right">
                              <span className="text-[10px] uppercase font-bold text-emerald-300 block flex items-center gap-1 justify-end">
                                <Gift className="w-3 h-3 text-emerald-400" /> Donated
                              </span>
                              <span className="text-xs font-extrabold text-emerald-300 font-mono-num">
                                +{formatINR(m.extraDonation || 0)}
                              </span>
                            </div>
                          ) : m.netBalance > 0 ? (
                            <div className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl text-right">
                              <span className="text-[10px] uppercase font-bold text-emerald-300 block">Receives</span>
                              <span className="text-xs font-extrabold text-emerald-400 font-mono-num">
                                +{formatINR(m.netBalance)}
                              </span>
                            </div>
                          ) : isUnpaid ? (
                            <div className="px-2.5 py-1 bg-rose-950/60 border border-rose-800/60 rounded-xl text-right">
                              <span className="text-[10px] uppercase font-bold text-rose-300 block">Unpaid / Owes</span>
                              <span className="text-xs font-extrabold text-rose-400 font-mono-num">
                                -{formatINR(owedAmount)}
                              </span>
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/60 rounded-xl text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">Settled</span>
                              <span className="text-xs font-bold text-slate-300 font-mono-num">₹0</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons per member */}
                        {isExempt ? (
                          <span className="text-[10px] font-semibold text-rose-300/80 px-2 py-1 rounded-lg bg-rose-950/40 border border-rose-900/50">
                            No dues
                          </span>
                        ) : isUnpaid ? (
                          <button
                            onClick={() => handleOpenRecordPayment(m.memberId, owedAmount)}
                            className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                            title={`Mark full or partial payment for ${m.memberName}`}
                          >
                            <Check className="w-3 h-3 stroke-[3px]" />
                            <span>Mark Paid</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenRecordPayment(m.memberId)}
                            className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                            title={`Add extra payment for ${m.memberName}`}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Payment</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {summary.fundPaidAmount > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-300">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Building2 className="w-4 h-4" /> Tm ISHAL Group Fund Covered:
                  </span>
                  <span className="font-bold font-mono-num text-sm text-blue-400">
                    {formatINR(summary.fundPaidAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORIES */}
        {activeSubTab === 'categories' && (
          <div className="space-y-4">
            <div className="bg-[#111A2E]/90 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-400" />
                Category Expense Distribution
              </h3>

              {summary.categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No expenses recorded in categories yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {summary.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">
                          {cat.category}{' '}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({cat.count} items)
                          </span>
                        </span>
                        <span className="font-mono-num font-extrabold text-blue-400">
                          {formatINR(cat.amount)}{' '}
                          <span className="text-slate-400 text-[10px] font-normal">
                            ({cat.percentage}%)
                          </span>
                        </span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-2 bg-[#0B1323] rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(2, cat.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MEMBERS LIST */}
        {activeSubTab === 'members' && (
          <div className="space-y-3">
            <div className="bg-[#111A2E]/90 border border-slate-800/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Enrolled Members ({event.memberIds.length})
                </h3>
                <button
                  onClick={() => requireAuth(() => onEditEvent(event))}
                  className="text-xs text-blue-400 hover:underline font-semibold"
                >
                  Manage Roster
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.memberIds.map((mId) => {
                  const m = members.find((x) => x.id === mId);
                  if (!m) return null;
                  const settlementInfo = summary.memberSettlement.find((s) => s.memberId === mId);
                  const isUnpaid = settlementInfo && settlementInfo.netBalance < 0;
                  const owedAmount = settlementInfo ? Math.abs(settlementInfo.netBalance) : 0;

                  return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-[#0B1323]/80 border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: m.avatarColor || '#2563EB' }}
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{m.name}</p>
                          {m.role && <p className="text-[10px] text-slate-400">{m.role}</p>}
                        </div>
                      </div>

                      {/* Member payment status indicator & action */}
                      {settlementInfo && (
                        <div className="shrink-0 flex items-center gap-1.5">
                          {settlementInfo.netBalance > 0 ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-md">
                              Paid Extra
                            </span>
                          ) : isUnpaid ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded-md">
                                Owes {formatINR(owedAmount)}
                              </span>
                              <button
                                onClick={() => handleOpenRecordPayment(m.id, owedAmount)}
                                className="p-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white"
                                title={`Mark Paid for ${m.name}`}
                              >
                                <Check className="w-3 h-3 stroke-[2.8px]" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                              Settled
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* Danger Zone: Delete Event */}
        <div className="mt-8 p-4 rounded-2xl bg-rose-950/20 border border-rose-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Delete This Event
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Permanently remove "{event.name}" along with its {eventExpenses.length} expense record(s).
            </p>
          </div>
          <button
            onClick={() => setShowDeleteConfirmModal(true)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Event</span>
          </button>
        </div>
      </div>
      </div>

      {/* Delete Event Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0F172A] border border-rose-800/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2px]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Event?</h3>
              <p className="text-xs text-slate-300 font-medium">
                Are you sure you want to permanently delete <span className="text-white font-bold">"{event.name}"</span>?
              </p>
              <p className="text-[11px] text-rose-400/90 pt-1">
                This will also delete all {eventExpenses.length} associated expense record(s) and ledger entries for this event. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Member Payment Modal */}
      {isRecordPaymentOpen && (
        <RecordMemberPaymentModal
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          event={event}
          preSelectedMemberId={paymentMemberId}
          defaultAmount={paymentDefaultAmount}
        />
      )}
    </div>
  );
};
