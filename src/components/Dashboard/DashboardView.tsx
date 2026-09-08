import React, { useMemo, useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { calculateEventSummary, formatDate, formatINR, getEventFinancials } from '../../utils/formatters';
import { downloadCommunityMasterReportPDF } from '../../utils/pdfGenerator';
import { EVENT_TYPE_LABELS } from '../../data/initialData';
import { RecordMemberPaymentModal } from '../Events/RecordMemberPaymentModal';
import { PendingMembersModal } from './PendingMembersModal';
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Download,
  CalendarDays,
  Plus,
  CheckCircle2,
  PauseCircle,
  ArrowRight,
  Check,
  Undo2,
  Search,
  Send,
  SlidersHorizontal,
  UserCheck,
  CreditCard,
  CheckCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Expense } from '../../types';

interface DashboardViewProps {
  onSelectEvent: (eventId: string) => void;
  onOpenQuickCreate: () => void;
  onAddExpense: () => void;
  onCreateEvent: () => void;
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

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectEvent,
  onOpenQuickCreate,
  onAddExpense,
  onCreateEvent,
  onEditExpense,
}) => {
  const {
    events,
    expenses,
    members,
    transactions,
    totalCollected,
    totalSpending,
    setActiveTab,
    requireAuth,
    updateEvent,
    markMemberPaid,
  } = useFinance();

  const [showEventBreakdown, setShowEventBreakdown] = useState<boolean>(false);

  // Active event member payment recording state
  const [selectedPaymentEventId, setSelectedPaymentEventId] = useState<string | null>(null);
  const [paymentMemberFilter, setPaymentMemberFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'paid' | 'unpaid' } | null>(null);

  // Custom detailed payment modal state
  const [isCustomPaymentModalOpen, setIsCustomPaymentModalOpen] = useState(false);
  const [customPaymentMemberId, setCustomPaymentMemberId] = useState<string | undefined>(undefined);
  const [customPaymentDefaultAmount, setCustomPaymentDefaultAmount] = useState<number | undefined>(undefined);

  // All pending members list modal state
  const [isPendingMembersModalOpen, setIsPendingMembersModalOpen] = useState(false);

  // Real-time aggregate financials across all events
  const allEventsTotals = useMemo(() => {
    let disbursed = 0;
    let collections = 0;
    events.forEach((ev) => {
      const fin = getEventFinancials(ev, expenses, members, transactions);
      disbursed += fin.summary.totalCost;
      collections += fin.evTotalCollections;
    });
    return {
      disbursed,
      collections,
      balance: collections - disbursed,
    };
  }, [events, expenses, members, transactions]);

  // Financial calculations - guaranteed matching all events total balance
  const balanceAmount = allEventsTotals.balance;
  const displayTotalCollected = Math.max(totalCollected, allEventsTotals.collections);


  // Aggregate unpaid members across all community events
  const allUnpaidMembers = useMemo(() => {
    const list: {
      eventId: string;
      eventName: string;
      eventDate?: string;
      eventType?: string;
      memberId: string;
      memberName: string;
      phone?: string;
      role?: string;
      amountOwed: number;
    }[] = [];
    events.forEach((ev) => {
      if (
        ev.id === 'ev_other_expenses' ||
        ev.name.trim().toLowerCase() === 'other expenses' ||
        ev.name.toLowerCase().includes('other expense')
      ) {
        return;
      }
      const summary = calculateEventSummary(ev, expenses, members, transactions);
      summary.unpaidMembers.forEach((u) => {
        const memObj = members.find((m) => m.id === u.memberId);
        list.push({
          eventId: ev.id,
          eventName: ev.name,
          eventDate: ev.date,
          eventType: ev.type,
          memberId: u.memberId,
          memberName: u.memberName,
          phone: u.phone || memObj?.phone,
          role: memObj?.role,
          amountOwed: u.amountOwed,
        });
      });
    });
    return list;
  }, [events, expenses, members, transactions]);

  const uniqueUnpaidMembersCount = useMemo(() => {
    return new Set(allUnpaidMembers.map((u) => u.memberId)).size;
  }, [allUnpaidMembers]);

  const totalUnpaidAcrossEvents = useMemo(() => {
    return allUnpaidMembers.reduce((sum, item) => sum + item.amountOwed, 0);
  }, [allUnpaidMembers]);

  // Community Functions (excluding the internal non-event 'other expenses' fund ledger)
  const communityEvents = useMemo(() => {
    return events.filter(
      (ev) => ev.id !== 'ev_other_expenses' && ev.name.trim().toLowerCase() !== 'other expenses'
    );
  }, [events]);

  // Active Functions (events with status 'active', sorted latest date first - strictly excludes 'other expenses' from active functions card grid)
  const activeFunctions = useMemo(() => {
    return communityEvents
      .filter((ev) => ev.status === 'active')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [communityEvents]);

  // Events eligible for Record Member Payment (active events first, then recent community events)
  const activeEventsList = useMemo(() => {
    return [...communityEvents].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [communityEvents]);

  // Current event selected for recording member payment
  const currentPaymentEvent = useMemo(() => {
    if (selectedPaymentEventId) {
      const found = events.find((e) => e.id === selectedPaymentEventId);
      if (found) return found;
    }
    return activeEventsList[0] || events[0] || null;
  }, [events, selectedPaymentEventId, activeEventsList]);

  // Financial and member settlement summary for the selected active event
  const currentPaymentSummary = useMemo(() => {
    if (!currentPaymentEvent) return null;
    return calculateEventSummary(currentPaymentEvent, expenses, members, transactions);
  }, [currentPaymentEvent, expenses, members, transactions]);

  // Single-click instant toggle handler
  const handleSingleClickPayment = (memberId: string, currentlyPaid: boolean, amountOwed: number) => {
    if (!currentPaymentEvent) return;
    const willBePaid = !currentlyPaid;
    markMemberPaid(currentPaymentEvent.id, memberId, willBePaid);

    const memberObj = members.find((m) => m.id === memberId);
    const memberName = memberObj ? memberObj.name : 'Member';
    const amountText = amountOwed > 0 ? formatINR(amountOwed) : formatINR(currentPaymentSummary?.perMemberCost || 0);

    setFeedbackMessage({
      text: willBePaid
        ? `✓ ${memberName} marked as Paid (${amountText})`
        : `○ ${memberName} marked as Unpaid`,
      type: willBePaid ? 'paid' : 'unpaid',
    });

    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2600);
  };

  // Batch action: mark all unpaid members as paid in one click
  const handleMarkAllUnpaid = () => {
    if (!currentPaymentEvent || !currentPaymentSummary) return;
    const unpaidList = currentPaymentSummary.unpaidMembers;
    if (unpaidList.length === 0) return;

    unpaidList.forEach((u) => {
      markMemberPaid(currentPaymentEvent.id, u.memberId, true);
    });

    setFeedbackMessage({
      text: `✓ Marked all ${unpaidList.length} members as Paid`,
      type: 'paid',
    });

    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2600);
  };

  // Filtered and searched list of enrolled members for this event (exempt members like wedding bride/groom excluded)
  const displayedPaymentMembers = useMemo(() => {
    if (!currentPaymentSummary) return [];
    let list = currentPaymentSummary.memberSettlement.filter((m) => !m.isExemptFromSplit);

    if (paymentMemberFilter === 'unpaid') {
      list = list.filter((m) => m.status === 'unpaid');
    } else if (paymentMemberFilter === 'paid') {
      list = list.filter((m) => m.status === 'paid' || m.status === 'settled');
    }

    if (memberSearchQuery.trim()) {
      const q = memberSearchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.memberName.toLowerCase().includes(q) ||
          (m.phone && m.phone.includes(q))
      );
    }

    return list;
  }, [currentPaymentSummary, paymentMemberFilter, memberSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Hero Financial Total Card with Balance Amount, Total Collected, Total Expense, Cash vs Bank */}
      <div className="bg-gradient-to-br from-[#0B1323] via-[#0F1A30] to-[#0A111F] text-white rounded-3xl p-5 sm:p-7 shadow-2xl shadow-black/50 border border-slate-800/90 relative overflow-hidden">
        {/* Subtle decorative multi-color atmospheric glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-24 -mt-24" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mb-20" />
        
        <div className="relative z-10">
          {/* Top Status Header & Headline */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-600/25 shrink-0 border border-blue-400/20">
                <Wallet className="w-5 h-5 stroke-[2.2px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                    Financial Overview
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  Income, Expenditure & Balance Statement
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => downloadCommunityMasterReportPDF(events, expenses, members, displayTotalCollected, 0, transactions)}
                className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
                title="Download Master Statement PDF"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.4px]" />
                <span>PDF Statement</span>
              </button>
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/70">
                LIVE
              </span>
            </div>
          </div>

          {/* Hero Main Metric on TOP: Balance Amount */}
          <div className="mt-5 p-5 sm:p-6 bg-gradient-to-br from-[#0F1A30] to-[#0A1222] border border-blue-900/40 rounded-2xl relative overflow-hidden shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${balanceAmount >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                    Total Balance
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${balanceAmount >= 0 ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/80' : 'text-rose-400 bg-rose-950/80 border-rose-800/80'}`}>
                    {balanceAmount >= 0 ? '● Surplus' : '▲ Deficit'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-full">
                    Matches All Events
                  </span>
                </div>
                <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold font-mono-num tracking-tight leading-none ${balanceAmount >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {formatINR(balanceAmount)}
                </h2>
              </div>

              <p className="text-xs text-slate-400 font-medium sm:text-right">
                Net remaining balance across all {communityEvents.length} functions{' '}
                <span className="text-slate-300 font-semibold">({formatINR(allEventsTotals.collections)} − {formatINR(allEventsTotals.disbursed)})</span>
              </p>
            </div>

            {/* Event Balances Ledger matching all events - Collapsible, hidden by default */}
            <div className="mt-3.5 pt-3 border-t border-slate-800/70 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowEventBreakdown(!showEventBreakdown)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#080E1B] hover:bg-[#121B30] border border-slate-800 hover:border-blue-900/60 transition-all text-slate-300 font-semibold cursor-pointer group shadow-xs active:scale-98"
                  title={showEventBreakdown ? "Hide event breakdown" : "Show all event breakdown"}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:scale-125 transition-transform" />
                  <span>All Events Breakdown ({communityEvents.length})</span>
                  <span className="text-[10px] text-blue-400 font-bold bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded-md ml-1 inline-flex items-center gap-1">
                    {showEventBreakdown ? (
                      <>
                        <span>Hide</span>
                        <ChevronUp className="w-3 h-3 text-blue-300" />
                      </>
                    ) : (
                      <>
                        <span>Show</span>
                        <ChevronDown className="w-3 h-3 text-blue-300" />
                      </>
                    )}
                  </span>
                </button>

                {!showEventBreakdown ? (
                  <span className="text-[10.5px] text-slate-500 font-medium">
                    Hidden by default • Click to view breakdown
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEventBreakdown(false)}
                    className="text-[10.5px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Close breakdown
                  </button>
                )}
              </div>

              {showEventBreakdown && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 transition-all">
                  {events.map((ev) => {
                    const fin = getEventFinancials(ev, expenses, members, transactions);
                    const bal = fin.evBalance ?? 0;
                    return (
                      <button
                        key={ev.id}
                        onClick={() => onSelectEvent(ev.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080E1B] hover:bg-[#121B30] border border-slate-800 hover:border-blue-900/60 transition-colors text-slate-300 font-mono-num text-[10.5px] cursor-pointer"
                        title={`View ${ev.name} details`}
                      >
                        <span className="text-slate-400 truncate max-w-[120px]">{ev.name}:</span>
                        <strong className={bal > 0 ? 'text-emerald-400' : bal < 0 ? 'text-rose-400' : 'text-slate-300'}>
                          {formatINR(bal)}
                        </strong>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Secondary 2 Pillars Beneath: Total Collected / Revenue & Total Expense */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5">
            {/* 1. Total Collected Amount or Revenue */}
            <div className="bg-[#101B30]/90 hover:bg-[#13223D] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4.5 backdrop-blur-xs transition-all shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                  Total Collected / Revenue
                </span>
                <div className="w-7 h-7 rounded-xl bg-emerald-950/90 border border-emerald-800/70 text-emerald-400 flex items-center justify-center">
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.4px]" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono-num tracking-tight">
                {formatINR(displayTotalCollected)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-medium">
                <span>Member collections</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">Inflow</span>
              </div>
            </div>

            {/* 2. Total Expense */}
            <div className="bg-[#101B30]/90 hover:bg-[#13223D] border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4.5 backdrop-blur-xs transition-all shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-bold text-rose-400 tracking-wider">
                  Total Expense
                </span>
                <div className="w-7 h-7 rounded-xl bg-rose-950/90 border border-rose-800/70 text-rose-400 flex items-center justify-center">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono-num tracking-tight">
                {formatINR(totalSpending)}
              </p>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 font-medium">
                <span>{expenses.length} bills in {communityEvents.length} events</span>
                <span className="text-[10px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/40">Outflow</span>
              </div>
            </div>
          </div>



          {/* Unpaid Alert Banner if any member owes pending share */}
          {allUnpaidMembers.length > 0 && (
            <div
              id="pending-members-alert-card"
              role="button"
              tabIndex={0}
              onClick={() => setIsPendingMembersModalOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsPendingMembersModalOpen(true);
                }
              }}
              className="mt-3.5 p-3.5 sm:p-4 bg-gradient-to-r from-amber-950/75 via-amber-950/50 to-[#121828] hover:from-amber-950/95 hover:via-amber-900/60 hover:to-[#171F34] border-2 border-amber-600/70 hover:border-amber-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all duration-200 shadow-lg shadow-amber-950/30 hover:shadow-amber-900/40 group active:scale-[0.995] select-none ring-1 ring-amber-500/25 hover:ring-amber-400/50"
              title="Click to see all pending members list and dues breakdown"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-500/80 text-amber-400 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  <AlertCircle className="w-4.5 h-4.5 stroke-[2.4px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs sm:text-sm font-bold text-amber-200 group-hover:text-amber-100 transition-colors">
                      <strong className="text-amber-300 font-extrabold">{uniqueUnpaidMembersCount} Members with Pending Dues</strong>{' '}
                      <span className="text-amber-400/80 font-medium text-xs">({allUnpaidMembers.length} event records)</span>
                    </p>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-900/80 text-amber-300 border border-amber-600/80 shrink-0 font-mono-num">
                      Total: {formatINR(totalUnpaidAcrossEvents)}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 mt-0.5 font-medium flex items-center gap-1">
                    <span>Click to see all pending members list, event breakdowns & WhatsApp reminders</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-xs font-extrabold flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-700/30 group-hover:bg-amber-500 transition-all font-sans">
                  <span>View Pending List ({uniqueUnpaidMembersCount})</span>
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5px] group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. Active Functions Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold shadow-xs">
              <CalendarDays className="w-4 h-4 stroke-[2.2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Active Functions
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold text-blue-300 bg-blue-950/90 border border-blue-800/70 px-2.5 py-0.5 rounded-full font-mono-num">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {activeFunctions.length} Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => requireAuth(() => onCreateEvent())}
              className="hidden sm:inline-flex items-center gap-1 py-1.5 px-3 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Function</span>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group px-2 py-1 rounded-lg hover:bg-[#111A2E]"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {activeFunctions.length === 0 ? (
          <div className="p-6 text-center bg-[#111A2E]/90 border border-slate-800/80 rounded-2xl shadow-xs space-y-3">
            <CalendarDays className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <p className="text-sm font-bold text-white">No functions are currently active</p>
              <p className="text-xs text-slate-400 mt-1 font-medium max-w-md mx-auto">
                All community events are either completed or in planning. You can start a new function or reopen a past one from the Events tab.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => requireAuth(() => onCreateEvent())}
                className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Create Function
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className="py-2 px-4 bg-[#0B1323] hover:bg-[#16233E] text-slate-300 border border-slate-800 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
              >
                View All Events ({communityEvents.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeFunctions.map((ev) => {
              const summary = calculateEventSummary(ev, expenses, members, transactions);
              const financials = getEventFinancials(ev, expenses, members, transactions);
              const typeInfo = EVENT_TYPE_LABELS[ev.type] || { label: ev.type, color: 'slate' };
              const badgeClass = getBadgeClasses(ev.type);

              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev.id)}
                  className="bg-[#111A2E]/90 hover:bg-[#15223C] border border-slate-800/80 hover:border-blue-700/60 rounded-2xl p-4.5 transition-all duration-200 cursor-pointer group shadow-xs flex flex-col justify-between gap-3 active:scale-[0.995]"
                >
                  <div>
                    {/* Top Row: Type & Date & Admin Quick Buttons */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${badgeClass}`}>
                          {typeInfo.label}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/70 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          ACTIVE
                        </span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => requireAuth(() => updateEvent(ev.id, { status: 'completed' }))}
                          className="px-2 py-0.5 rounded-lg bg-[#0A1325] hover:bg-emerald-950/80 text-emerald-400 border border-slate-800 hover:border-emerald-800/70 text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="Admin: Close Function"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Close</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => requireAuth(() => updateEvent(ev.id, { status: 'hold' }))}
                          className="px-2 py-0.5 rounded-lg bg-[#0A1325] hover:bg-amber-950/80 text-amber-400 border border-slate-800 hover:border-amber-800/70 text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                          title="Admin: Put on Hold"
                        >
                          <PauseCircle className="w-3 h-3" />
                          <span>Hold</span>
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-white mt-2 group-hover:text-blue-400 transition-colors line-clamp-1">
                      {ev.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium font-mono-num mt-0.5">
                      {formatDate(ev.date)} {ev.location && `• ${ev.location}`}
                    </p>

                    {/* Details row: members & bills & unpaid dues */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-2.5 font-medium">
                      <span className="bg-[#0B1323] text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md text-[10.5px]">
                        {summary.memberCount} members
                      </span>
                      <span className="bg-[#0B1323] text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md text-[10.5px]">
                        {summary.totalExpensesCount} bills
                      </span>
                      {summary.unpaidMembersCount > 0 && (
                        <span className="bg-rose-950/60 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-md text-[10.5px] font-bold">
                          {summary.unpaidMembersCount} unpaid ({formatINR(summary.totalUnpaidAmount)})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Footer */}
                  <div className="pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                        Total Spent
                      </span>
                      <span className="text-base font-extrabold font-mono-num text-white leading-tight">
                        {formatINR(summary.totalCost)}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono-num font-medium">
                        {formatINR(summary.perMemberCost)} / pax
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                          Collected
                        </span>
                        <span className="text-sm font-extrabold font-mono-num text-emerald-400 leading-tight block">
                          {formatINR(financials.evTotalCollections)}
                        </span>
                        <span
                          className={`text-[10px] font-mono-num font-semibold block ${
                            financials.evBalance !== null && financials.evBalance > 0
                              ? 'text-emerald-400'
                              : financials.evBalance !== null && financials.evBalance < 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {financials.evBalance !== null && financials.evBalance !== 0
                            ? financials.evBalance > 0
                              ? `Bal: +${formatINR(financials.evBalance)}`
                              : `Bal: ${formatINR(financials.evBalance)}`
                            : 'Settled'}
                        </span>
                      </div>
                      <div className="w-7 h-7 rounded-xl bg-slate-800/60 group-hover:bg-blue-950/80 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors shrink-0 ml-1">
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Active Event Record Member Payment Section */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 flex items-center justify-center font-bold shadow-xs">
              <UserCheck className="w-4 h-4 stroke-[2.2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Record Member Payment
                </h2>
                {currentPaymentSummary && (
                  <>
                    <span className="text-[10.5px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 rounded-full font-mono-num">
                      {currentPaymentSummary.paidMembersCount}/{currentPaymentSummary.splittingMemberCount} Paid
                    </span>
                    {currentPaymentSummary.unpaidMembersCount > 0 ? (
                      <span className="text-[10.5px] font-semibold text-rose-400 bg-rose-950/80 border border-rose-800/70 px-2 py-0.5 rounded-full font-mono-num">
                        {currentPaymentSummary.unpaidMembersCount} Pending ({formatINR(currentPaymentSummary.totalUnpaidAmount)})
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" />
                        <span>All Settled</span>
                      </span>
                    )}
                    {currentPaymentSummary.weddingPersonName && (
                      <span className="text-[10.5px] font-semibold text-rose-300 bg-rose-950/80 border border-rose-800/70 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span>💍</span>
                        <span>{currentPaymentSummary.weddingPersonName} Exempt</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Event Selector if multiple community events */}
            {activeEventsList.length > 1 && (
              <div className="relative">
                <select
                  aria-label="Select event for member payment"
                  value={currentPaymentEvent?.id || ''}
                  onChange={(e) => setSelectedPaymentEventId(e.target.value)}
                  className="bg-[#111A2E]/90 border border-slate-800/90 text-xs font-bold text-slate-200 rounded-xl px-2.5 py-1.5 pr-7 appearance-none cursor-pointer focus:outline-none focus:border-emerald-500 hover:bg-[#15223C]"
                >
                  {activeEventsList.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-[#0F172A] text-white">
                      {ev.name} ({ev.status === 'active' ? 'Active' : 'Event'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-[#111A2E]/90 p-0.5 rounded-xl border border-slate-800/80">
              <button
                type="button"
                onClick={() => setPaymentMemberFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
                  paymentMemberFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({currentPaymentSummary?.splittingMemberCount ?? currentPaymentSummary?.memberCount ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setPaymentMemberFilter('unpaid')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
                  paymentMemberFilter === 'unpaid'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unpaid ({currentPaymentSummary?.unpaidMembersCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setPaymentMemberFilter('paid')}
                className={`px-2 py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer ${
                  paymentMemberFilter === 'paid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Paid ({currentPaymentSummary?.paidMembersCount || 0})
              </button>
            </div>

            {currentPaymentEvent && (
              <button
                onClick={() => onSelectEvent(currentPaymentEvent.id)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group px-2 py-1 rounded-lg hover:bg-[#111A2E] cursor-pointer"
                title="View full event settlement and expenses"
              >
                <span>Ledger</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Payment Recording Card Container */}
        <div className="bg-[#111A2E]/90 rounded-2xl border border-slate-800/90 overflow-hidden shadow-xs">
          {/* Active Event Header Ribbon */}
          {currentPaymentEvent && (
            <div className="p-3.5 bg-[#0D1527] border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-950/70 border border-blue-800/60 text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                  <CreditCard className="w-4 h-4 stroke-[2.2px]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {currentPaymentEvent.name}
                    </span>
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                        currentPaymentEvent.status === 'active'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {currentPaymentEvent.status}
                    </span>
                    {currentPaymentSummary?.weddingPersonName && (
                      <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider bg-rose-950/80 text-rose-300 border border-rose-800/60">
                        💍 {currentPaymentSummary.weddingPersonName} Exempt
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                    <span className="font-mono-num">{formatDate(currentPaymentEvent.date)}</span>
                    {currentPaymentEvent.location && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="truncate max-w-[180px]">{currentPaymentEvent.location}</span>
                      </>
                    )}
                    <span className="text-slate-600">•</span>
                    <span className="text-emerald-400 font-semibold font-mono-num">
                      {currentPaymentSummary?.splitMode === 'minimum' ? 'Floor: ' : ''}
                      {formatINR(currentPaymentSummary?.perMemberCost || 0)} / {currentPaymentSummary?.weddingPersonName ? 'paying member' : 'member'}
                    </span>
                    {currentPaymentSummary?.totalDonations && currentPaymentSummary.totalDonations > 0 ? (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-amber-300 font-medium font-mono-num">
                          +{formatINR(currentPaymentSummary.totalDonations)} Extra Donations
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Actions: Search bar & Batch Pay */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search member..."
                    className="w-full bg-[#141F36] border border-slate-700/70 text-xs text-white placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {currentPaymentSummary && currentPaymentSummary.unpaidMembersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllUnpaid}
                    className="py-1.5 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-800/80 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                    title="Mark all pending members as paid"
                  >
                    <CheckCheck className="w-3.5 h-3.5 stroke-[2.4px]" />
                    <span className="hidden sm:inline">Mark All Paid</span>
                    <span className="sm:hidden">All Paid</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Feedback Toast Notification */}
          {feedbackMessage && (
            <div
              className={`px-4 py-2 text-xs font-bold flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-1 ${
                feedbackMessage.type === 'paid'
                  ? 'bg-emerald-950/90 border-b border-emerald-800/80 text-emerald-300'
                  : 'bg-amber-950/90 border-b border-amber-800/80 text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{feedbackMessage.text}</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal">Single-click synced</span>
            </div>
          )}

          {/* Member Payments List */}
          {!currentPaymentEvent ? (
            <div className="p-8 text-center text-slate-400">
              <UserCheck className="w-9 h-9 mx-auto text-slate-600 mb-1.5" />
              <p className="text-sm font-semibold text-slate-300">No active events found</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Create an event or mark an existing event as active to record member payments.
              </p>
            </div>
          ) : displayedPaymentMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <UserCheck className="w-9 h-9 mx-auto text-slate-600 mb-1.5" />
              <p className="text-sm font-semibold text-slate-300">
                {memberSearchQuery ? 'No matching members found' : 'No members found for this filter'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {memberSearchQuery ? 'Try another search term or clear the filter.' : 'Switch filter to view all enrolled members.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60 max-h-[460px] overflow-y-auto">
              {displayedPaymentMembers.map((m) => {
                const isExempt = m.isExemptFromSplit;
                const isPaid = m.status === 'paid' || m.status === 'settled';
                const hasDonatedExtra = m.isDonor || m.extraDonation > 0;
                const owedAmount = isPaid || isExempt ? 0 : Math.max(0, m.expectedShare - m.totalPaid);

                return (
                  <div
                    key={m.memberId}
                    className={`p-3 sm:p-3.5 hover:bg-[#15223C]/70 transition-colors flex items-center justify-between gap-3 ${
                      isExempt ? 'bg-rose-950/20 border-l-2 border-rose-500' : ''
                    }`}
                  >
                    {/* Member Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs uppercase border ${
                          isExempt
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/80'
                            : hasDonatedExtra
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                            : isPaid
                            ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/70'
                            : 'bg-amber-950/70 text-amber-400 border-amber-800/70'
                        }`}
                      >
                        {isExempt ? '💍' : hasDonatedExtra ? '✨' : m.memberName.slice(0, 2)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]">
                            {m.memberName}
                          </span>
                          <span
                            className={`text-[9.5px] font-semibold px-2 py-0.2 rounded-full border ${
                              isExempt
                                ? 'bg-rose-950/80 text-rose-300 border-rose-800/80 font-bold'
                                : hasDonatedExtra
                                ? 'bg-amber-950/70 text-amber-300 border-amber-700/70 font-bold'
                                : isPaid
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            }`}
                          >
                            {isExempt
                              ? '💍 Wedding Member • Exempt'
                              : hasDonatedExtra
                              ? `✨ Paid • Donated ${formatINR(m.totalPaid)} (+${formatINR(m.extraDonation)} Extra)`
                              : isPaid
                              ? 'Paid'
                              : `Owes ${formatINR(owedAmount)}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap font-medium">
                          {m.role && <span className="capitalize text-slate-400">{m.role}</span>}
                          {m.phone && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono-num text-slate-400">{m.phone}</span>
                            </>
                          )}
                          <span className="text-slate-600">•</span>
                          <span className="font-mono-num text-slate-400">
                            Share:{' '}
                            <strong className={isExempt ? 'text-rose-300' : 'text-slate-200'}>
                              {isExempt ? '₹0 (Exempt)' : formatINR(m.expectedShare)}
                            </strong>
                          </span>
                          {m.totalPaid > 0 && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono-num text-emerald-400">
                                Contributed: {formatINR(m.totalPaid)}
                              </span>
                              {m.extraDonation > 0 && (
                                <span className="font-mono-num text-amber-300 font-semibold">
                                  (+{formatINR(m.extraDonation)} Extra Donation)
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Single-click Mark Paid + Custom Entry */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isExempt ? (
                        <span className="text-[11px] font-bold text-rose-300 bg-rose-950/60 border border-rose-800/70 px-2.5 py-1 rounded-xl">
                          Zero Split (₹0)
                        </span>
                      ) : isPaid ? (
                        <button
                          type="button"
                          onClick={() => handleSingleClickPayment(m.memberId, true, owedAmount)}
                          className="h-8.5 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-emerald-950/80 hover:bg-rose-950/80 border border-emerald-800/80 hover:border-rose-800/80 text-emerald-300 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all group cursor-pointer select-none"
                          title="Click to toggle / mark unpaid"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3px] text-emerald-400 group-hover:hidden" />
                          <Undo2 className="w-3.5 h-3.5 stroke-[2.4px] text-rose-400 hidden group-hover:inline" />
                          <span className="group-hover:hidden">Paid</span>
                          <span className="hidden group-hover:inline">Mark Unpaid</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSingleClickPayment(m.memberId, false, owedAmount)}
                          className="h-8.5 sm:h-9 px-3 sm:px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/30 transition-all cursor-pointer select-none"
                          title="Click to mark as paid immediately"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.6px]" />
                          <span>Mark Paid</span>
                        </button>
                      )}

                      {/* Custom Payment / Receipt Details */}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomPaymentMemberId(m.memberId);
                          const mOwed = isPaid || isExempt ? 0 : owedAmount;
                          setCustomPaymentDefaultAmount(mOwed > 0 ? mOwed : undefined);
                          setIsCustomPaymentModalOpen(true);
                        }}
                        className="w-8.5 sm:w-9 h-8.5 sm:h-9 rounded-xl bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title={isExempt ? "Record gift or personal contribution" : hasDonatedExtra ? "View or record additional contribution" : isPaid ? "View or record extra contribution" : "Enter custom amount / payment method"}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer banner */}
          {currentPaymentEvent && currentPaymentSummary && (
            <div className="p-2.5 bg-[#0D1527]/70 border-t border-slate-800/80 flex items-center justify-between px-4 text-[11px] flex-wrap gap-2">
              <span className="text-slate-400">
                Enrolled: <strong className="text-white font-mono-num">{currentPaymentSummary.memberCount}</strong> members • Cost: <strong className="text-white font-mono-num">{formatINR(currentPaymentSummary.totalCost)}</strong>
              </span>
              <button
                type="button"
                onClick={() => onSelectEvent(currentPaymentEvent.id)}
                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Event Breakdown ({currentPaymentSummary.totalExpensesCount} expenses)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Custom Payment Detail Modal */}
      {currentPaymentEvent && isCustomPaymentModalOpen && (
        <RecordMemberPaymentModal
          isOpen={isCustomPaymentModalOpen}
          onClose={() => {
            setIsCustomPaymentModalOpen(false);
            setCustomPaymentMemberId(undefined);
            setCustomPaymentDefaultAmount(undefined);
          }}
          event={currentPaymentEvent}
          preSelectedMemberId={customPaymentMemberId}
          defaultAmount={customPaymentDefaultAmount}
        />
      )}

      {/* All Pending Members List Modal */}
      {isPendingMembersModalOpen && (
        <PendingMembersModal
          isOpen={isPendingMembersModalOpen}
          onClose={() => setIsPendingMembersModalOpen(false)}
          unpaidItems={allUnpaidMembers}
          events={events}
          members={members}
          onSelectEvent={onSelectEvent}
          onMarkPaid={markMemberPaid}
        />
      )}
    </div>
  );
};

