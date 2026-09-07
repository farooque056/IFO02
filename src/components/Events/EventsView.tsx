import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { EventItem, EventStatus, EventType } from '../../types';
import { EVENT_TYPE_LABELS } from '../../data/initialData';
import { calculateEventSummary, formatDate, formatINR, getEventFinancials } from '../../utils/formatters';
import { downloadEventPDF } from '../../utils/pdfGenerator';
import { OtherExpensesView } from './OtherExpensesView';
import { EventCalendarView } from './EventCalendarView';
import {
  CalendarDays,
  Plus,
  Users,
  Receipt,
  Search,
  ChevronRight,
  Filter,
  MapPin,
  Calendar,
  LayoutGrid,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  PauseCircle,
  RotateCcw,
  Play,
  Lock,
} from 'lucide-react';
import { Expense } from '../../types';

interface EventsViewProps {
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: (defaultDate?: string) => void;
  onAddExpense?: (eventId?: string) => void;
  onEditExpense?: (expense: Expense) => void;
}

type ViewType = 'cards' | 'other_expenses' | 'calendar';

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

export const EventsView: React.FC<EventsViewProps> = ({
  onSelectEvent,
  onCreateEvent,
  onAddExpense,
  onEditExpense,
}) => {
  const { events, expenses, members, transactions, searchQuery, requireAuth, deleteEvent, updateEvent } = useFinance();
  const [viewType, setViewType] = useState<ViewType>('cards');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hold' | 'completed' | 'planning'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);

  const handleDeleteConfirmed = () => {
    if (eventToDelete) {
      requireAuth(() => {
        deleteEvent(eventToDelete.id);
        setEventToDelete(null);
      });
    }
  };

  // Real community events (excluding the internal non-event 'other expenses' ledger)
  const communityEvents = useMemo(() => {
    return events.filter(
      (ev) => ev.id !== 'ev_other_expenses' && ev.name.trim().toLowerCase() !== 'other expenses'
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    const list = communityEvents.filter((ev) => {
      const matchesStatus = statusFilter === 'all' || ev.status === statusFilter;
      const matchesType = typeFilter === 'all' || ev.type === typeFilter;
      const matchesSearch =
        !searchQuery ||
        ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.type.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesType && matchesSearch;
    });

    // Chronological order ensures consistent alignment across Card, Milestone, and Calendar views
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [communityEvents, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-400" />
            Events & Functions
          </h1>
          <p className="text-xs text-slate-400">
            Dedicated accounting & journey records for each Tm ISHAL gathering
          </p>
        </div>

        <button
          onClick={() => requireAuth(() => onCreateEvent())}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.8px]" />
          <span>New Event</span>
        </button>
      </div>

      {/* 3-Way View Switcher (Cards | Milestone Roadmap | Calendar) */}
      <div className="bg-[#111A2E]/90 p-1.5 rounded-2xl border border-slate-800/90 flex items-center gap-1 shadow-xs">
        <button
          onClick={() => setViewType('cards')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewType === 'cards'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#16233E]'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Card View</span>
        </button>

        <button
          onClick={() => setViewType('other_expenses')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            viewType === 'other_expenses'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#16233E]'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Other Expenses (Petty Cash)</span>
        </button>

        <button
          onClick={() => setViewType('calendar')}
          className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            viewType === 'calendar'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#16233E]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar</span>
        </button>
      </div>

      {/* Filter Tabs (Visible for Card view only) */}
      {viewType === 'cards' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['all', 'active', 'hold', 'completed', 'planning'] as const).map((st) => {
            const count =
              st === 'all'
                ? communityEvents.length
                : communityEvents.filter((e) => e.status === st).length;
            const label =
              st === 'all'
                ? 'All'
                : st === 'active'
                ? 'Active / Open'
                : st === 'hold'
                ? 'On Hold'
                : st === 'completed'
                ? 'Closed'
                : 'Planning';

            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-blue-950/90 text-blue-300 border border-blue-700/80 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 bg-[#111A2E]/90 border border-slate-800/80 hover:bg-[#16233E]'
                }`}
              >
                <span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono-num ${
                  statusFilter === st ? 'bg-blue-900/60 text-blue-200' : 'bg-slate-800/80 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW 1: DEFAULT CARDS VIEW */}
      {viewType === 'cards' && (
        <>
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center bg-[#111A2E]/90 border border-slate-800/90 rounded-2xl shadow-xs space-y-3">
              <CalendarDays className="w-10 h-10 text-slate-500 mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">No events found</p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  {searchQuery ? 'Try changing your search query.' : 'Create your first event for Tm ISHAL!'}
                </p>
              </div>
              <button
                onClick={() => requireAuth(() => onCreateEvent())}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
              >
                <Plus className="w-4 h-4" /> Create Event
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => {
                const { summary, evTotalCollections, evBalance, primaryLabel } = getEventFinancials(
                  ev,
                  expenses,
                  members,
                  transactions
                );
                const typeInfo = EVENT_TYPE_LABELS[ev.type] || { label: ev.type, color: 'slate' };
                const badgeClass = getBadgeClasses(ev.type);

                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectEvent(ev.id)}
                    className="bg-[#111A2E]/90 hover:bg-[#15223C] border border-slate-800/80 hover:border-blue-700/60 rounded-2xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-xs group active:scale-[0.99]"
                  >
                    {/* Top Row: Type Badge, Status, Date */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${badgeClass}`}>
                        {typeInfo.label}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          ev.status === 'completed'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : ev.status === 'hold'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : ev.status === 'planning'
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                            : 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                        }`}>
                          {ev.status === 'hold' ? 'ON HOLD' : ev.status === 'completed' ? 'CLOSED' : ev.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num font-medium">
                          {formatDate(ev.date)}
                        </span>
                      </div>
                    </div>

                    {/* Event Title & Location */}
                    <div className="mb-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                          {ev.name}
                        </h3>
                        {summary.splitMode === 'minimum' ? (
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded-full shrink-0">
                            Min {formatINR(summary.perMemberCost)}/pax • Donations Open
                          </span>
                        ) : summary.targetSplitAmount ? (
                          <span className="text-[10px] font-bold text-blue-300 bg-blue-950/70 border border-blue-700/60 px-2 py-0.5 rounded-full shrink-0">
                            Target {formatINR(summary.targetSplitAmount)}
                          </span>
                        ) : null}
                      </div>
                      {ev.location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {ev.location}
                        </p>
                      )}
                    </div>

                    {/* Financial Summary Card Box */}
                    <div className="bg-[#0B1323]/80 rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          {primaryLabel}
                        </span>
                        <span className="text-lg font-extrabold font-mono-num text-white">
                          {formatINR(summary.totalCost)}
                        </span>
                      </div>

                      {evTotalCollections > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wide">
                              Collected
                            </span>
                            <span className="text-sm font-black font-mono-num text-emerald-400">
                              {formatINR(evTotalCollections)}
                            </span>
                          </div>
                          <div className="text-right pl-3 border-l border-slate-800/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                              {(evBalance ?? 0) === 0 ? 'Status' : 'Remaining Balance'}
                            </span>
                            <span className={`text-sm font-black font-mono-num ${(evBalance ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                              {(evBalance ?? 0) === 0 ? 'Settled (₹0)' : formatINR(evBalance ?? 0)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">
                            Per Member Share
                          </span>
                          <span className="text-sm font-bold font-mono-num text-slate-300">
                            {formatINR(summary.perMemberCost)}
                          </span>
                        </div>
                      )}

                      <div className="pl-2 border-l border-slate-800 flex items-center text-slate-400 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Footer stats & Quick PDF & Delete buttons */}
                    <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2.5 border-t border-slate-800/60 px-0.5">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          {summary.memberCount} members
                        </span>
                        <span className="flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5 text-slate-500" />
                          {summary.totalExpensesCount} bills
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {/* Admin quick status controls */}
                        <div className="flex items-center gap-0.5 bg-[#080E1C] p-0.5 rounded-xl border border-slate-800/90">
                          {ev.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requireAuth(() => updateEvent(ev.id, { status: 'completed' }));
                              }}
                              className="py-1 px-2 hover:bg-emerald-950/70 text-emerald-400 hover:text-emerald-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                              title="Admin: Close Event"
                            >
                              <CheckCircle2 className="w-3 h-3 stroke-[2.2px]" />
                              <span className="hidden sm:inline">Close</span>
                            </button>
                          )}

                          {ev.status !== 'active' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requireAuth(() => updateEvent(ev.id, { status: 'active' }));
                              }}
                              className="py-1 px-2 hover:bg-blue-950/70 text-blue-400 hover:text-blue-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                              title="Admin: Reopen / Open Event"
                            >
                              <RotateCcw className="w-3 h-3 stroke-[2.2px]" />
                              <span className="hidden sm:inline">Reopen</span>
                            </button>
                          )}

                          {ev.status !== 'hold' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requireAuth(() => updateEvent(ev.id, { status: 'hold' }));
                              }}
                              className="py-1 px-2 hover:bg-amber-950/70 text-amber-400 hover:text-amber-200 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all"
                              title="Admin: Put Event on Hold"
                            >
                              <PauseCircle className="w-3 h-3 stroke-[2.2px]" />
                              <span className="hidden sm:inline">Hold</span>
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadEventPDF(ev, expenses, members, transactions);
                          }}
                          className="py-1 px-2.5 bg-blue-950/70 hover:bg-blue-900/80 text-blue-300 hover:text-white border border-blue-800/60 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs"
                          title="Download Event PDF Statement"
                        >
                          <Download className="w-3 h-3 stroke-[2.4px]" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(ev);
                          }}
                          className="p-1.5 bg-rose-950/40 hover:bg-rose-900/70 text-rose-400 hover:text-rose-200 border border-rose-900/40 rounded-xl transition-all shadow-xs"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: OTHER EXPENSES (PETTY CASH BOOK) */}
      {viewType === 'other_expenses' && (
        <OtherExpensesView
          onAddExpense={onAddExpense}
          onEditExpense={onEditExpense}
        />
      )}

      {/* VIEW 3: CALENDAR VIEW */}
      {viewType === 'calendar' && (
        <EventCalendarView
          events={filteredEvents}
          expenses={expenses}
          members={members}
          transactions={transactions}
          onSelectEvent={onSelectEvent}
          onCreateEvent={onCreateEvent}
          requireAuth={requireAuth}
        />
      )}

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0F172A] border border-rose-800/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2px]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Event?</h3>
              <p className="text-xs text-slate-300 font-medium">
                Are you sure you want to permanently delete <span className="text-white font-bold">"{eventToDelete.name}"</span>?
              </p>
              <p className="text-[11px] text-rose-400/90 pt-1">
                All associated expenses and ledger entries for this event will also be removed. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
