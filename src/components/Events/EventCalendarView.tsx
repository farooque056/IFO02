import React, { useState, useMemo } from 'react';
import { EventItem, Expense, Member, TransactionRecord } from '../../types';
import { EVENT_TYPE_LABELS } from '../../data/initialData';
import { calculateEventSummary, formatDate, formatINR, getEventFinancials } from '../../utils/formatters';
import { downloadEventPDF } from '../../utils/pdfGenerator';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Users,
  Receipt,
  Sparkles,
  ChevronDown,
  Download,
} from 'lucide-react';

interface EventCalendarViewProps {
  events: EventItem[];
  expenses: Expense[];
  members: Member[];
  transactions?: TransactionRecord[];
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: (defaultDate?: string) => void;
  requireAuth: (action: () => void) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getEventTypeColor = (type: string) => {
  switch (type) {
    case 'wedding':
      return { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', dot: 'bg-rose-500' };
    case 'iftar':
      return { bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-500' };
    case 'picnic':
      return { bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', dot: 'bg-amber-500' };
    case 'eid':
      return { bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40', dot: 'bg-teal-500' };
    case 'sports':
      return { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', dot: 'bg-blue-500' };
    case 'meeting':
      return { bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', dot: 'bg-indigo-500' };
    case 'party':
      return { bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-500' };
    default:
      return { bg: 'bg-slate-500/20 text-slate-300 border-slate-500/40', dot: 'bg-slate-400' };
  }
};

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  expenses,
  members,
  transactions = [],
  onSelectEvent,
  onCreateEvent,
  requireAuth,
}) => {
  // Find initial month based on latest event or current date
  const initialDate = useMemo(() => {
    if (events.length > 0) {
      // Find event closest to current or latest
      const firstEventDate = new Date(events[0].date);
      if (!isNaN(firstEventDate.getTime())) {
        return firstEventDate;
      }
    }
    return new Date();
  }, [events]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${y}-${m}-${d}`);
  };

  // Map events by date YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    events.forEach((ev) => {
      // Normalize date string (e.g. "2026-03-24")
      const d = ev.date.split('T')[0];
      if (!map[d]) {
        map[d] = [];
      }
      map[d].push(ev);
    });
    return map;
  }, [events]);

  // Calendar Grid Calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: EventItem[];
    }> = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Padding previous month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 12 : currentMonth;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: eventsByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: eventsByDate[dateStr] || [],
      });
    }

    // Padding next month days to fill 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = currentMonth === 11 ? 1 : currentMonth + 2;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        events: eventsByDate[dateStr] || [],
      });
    }

    return days;
  }, [currentYear, currentMonth, eventsByDate]);

  // Events in the active month
  const monthEvents = useMemo(() => {
    return events.filter((ev) => {
      const evDate = new Date(ev.date);
      return (
        evDate.getFullYear() === currentYear &&
        evDate.getMonth() === currentMonth
      );
    });
  }, [events, currentYear, currentMonth]);

  const monthFinancials = useMemo(() => {
    let disbursed = 0;
    let collections = 0;
    monthEvents.forEach((ev) => {
      const fin = getEventFinancials(ev, expenses, members, transactions);
      disbursed += fin.summary.totalCost;
      collections += fin.evTotalCollections;
    });
    return {
      totalDisbursed: disbursed,
      totalCollections: collections,
      totalBalance: collections > 0 ? collections - disbursed : 0,
    };
  }, [monthEvents, expenses, members, transactions]);

  // Selected date events
  const selectedDateEvents = selectedDateStr ? (eventsByDate[selectedDateStr] || []) : [];

  return (
    <div className="space-y-4">
      {/* Calendar Header & Month Navigation */}
      <div className="bg-[#111A2E]/95 border border-slate-800/90 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <p className="text-xs text-slate-400">
                {monthEvents.length} events scheduled • Disbursed: <span className="text-white font-bold font-mono-num">{formatINR(monthFinancials.totalDisbursed)}</span>
                {monthFinancials.totalCollections > 0 && (
                  <>
                    {' '}• Collected: <span className="text-emerald-400 font-bold font-mono-num">{formatINR(monthFinancials.totalCollections)}</span>
                    {' '}• Balance: <span className="text-amber-300 font-bold font-mono-num">{formatINR(monthFinancials.totalBalance)}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 bg-[#0B1323] hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700/80 transition-all"
            >
              Today
            </button>
            <div className="flex items-center bg-[#0B1323] border border-slate-700/80 rounded-xl p-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
          {DAYS_OF_WEEK.map((day, idx) => (
            <div
              key={day}
              className={idx === 0 || idx === 6 ? 'text-blue-400 font-extrabold' : ''}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-2">
          {calendarDays.map((cell, idx) => {
            const isSelected = selectedDateStr === cell.dateStr;
            const hasEvents = cell.events.length > 0;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDateStr(cell.dateStr)}
                className={`min-h-[64px] sm:min-h-[82px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  !cell.isCurrentMonth
                    ? 'opacity-30 bg-[#0B1323]/40 border-slate-900/40 text-slate-600'
                    : isSelected
                    ? 'bg-blue-950/70 border-blue-500 shadow-md shadow-blue-500/10'
                    : hasEvents
                    ? 'bg-[#16233E]/80 hover:bg-[#1A2C4E] border-blue-900/50 text-white'
                    : 'bg-[#0B1323]/80 hover:bg-[#131F37] border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono-num font-bold px-1.5 py-0.5 rounded-lg ${
                      cell.isToday
                        ? 'bg-blue-600 text-white font-extrabold ring-2 ring-blue-400/40'
                        : isSelected
                        ? 'text-blue-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasEvents && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>

                {/* Day Cell Event Tags */}
                <div className="mt-1 space-y-1 overflow-hidden">
                  {cell.events.slice(0, 2).map((ev) => {
                    const typeColor = getEventTypeColor(ev.type);
                    return (
                      <div
                        key={ev.id}
                        className={`text-[9.5px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-md truncate border ${typeColor.bg}`}
                        title={ev.name}
                      >
                        {ev.name}
                      </div>
                    );
                  })}
                  {cell.events.length > 2 && (
                    <span className="text-[9px] font-bold text-blue-400 block text-right">
                      +{cell.events.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day or Monthly Events Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            {selectedDateStr ? (
              <span>Events on {formatDate(selectedDateStr)}</span>
            ) : (
              <span>Events in {MONTH_NAMES[currentMonth]} {currentYear}</span>
            )}
          </h3>

          {selectedDateStr && (
            <button
              onClick={() => setSelectedDateStr(null)}
              className="text-xs text-blue-400 hover:underline font-semibold"
            >
              Show all month
            </button>
          )}
        </div>

        {/* Selected Date List or Month Events */}
        {selectedDateStr ? (
          selectedDateEvents.length === 0 ? (
            <div className="p-6 text-center bg-[#111A2E]/90 border border-slate-800/90 rounded-2xl shadow-xs space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                No events scheduled on {formatDate(selectedDateStr)}.
              </p>
              <button
                onClick={() => requireAuth(() => onCreateEvent(selectedDateStr))}
                className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule Event for this Date
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateEvents.map((ev) => {
                const { summary, evTotalCollections, evBalance, primaryLabel } = getEventFinancials(
                  ev,
                  expenses,
                  members,
                  transactions
                );
                const typeInfo = EVENT_TYPE_LABELS[ev.type] || { label: ev.type, color: 'slate' };
                return (
                  <div
                    key={ev.id}
                    onClick={() => onSelectEvent(ev.id)}
                    className="bg-[#111A2E]/90 hover:bg-[#15223C] border border-blue-900/40 hover:border-blue-700/80 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-md group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/60">
                          {typeInfo.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono-num font-medium">
                          {formatDate(ev.date)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                          ev.status === 'completed'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                            : ev.status === 'hold'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            : ev.status === 'planning'
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60'
                            : 'bg-blue-950/80 text-blue-300 border-blue-800/60'
                        }`}>
                          {ev.status === 'hold' ? 'On Hold' : ev.status === 'completed' ? 'Closed' : ev.status}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                        {ev.name}
                      </h4>
                      {ev.location && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {ev.location}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="bg-[#0B1323] p-3 rounded-xl border border-slate-800 flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">
                            {primaryLabel}
                          </span>
                          <span className="text-sm sm:text-base font-extrabold font-mono-num text-white">
                            {formatINR(summary.totalCost)}
                          </span>
                        </div>

                        {evTotalCollections > 0 ? (
                          <>
                            <div className="text-right pl-3 border-l border-slate-800">
                              <span className="text-[9.5px] uppercase font-bold text-emerald-400 block tracking-wider">
                                Collected
                              </span>
                              <span className="text-xs sm:text-sm font-black font-mono-num text-emerald-400">
                                {formatINR(evTotalCollections)}
                              </span>
                            </div>
                            <div className="text-right pl-3 border-l border-slate-800">
                              <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">
                                {(evBalance ?? 0) === 0 ? 'Status' : 'Remaining Balance'}
                              </span>
                              <span className={`text-xs sm:text-sm font-black font-mono-num ${(evBalance ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                                {(evBalance ?? 0) === 0 ? 'Settled (₹0)' : formatINR(evBalance ?? 0)}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-right pl-3 border-l border-slate-800">
                            <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">
                              Per Member
                            </span>
                            <span className="text-xs sm:text-sm font-bold font-mono-num text-blue-300">
                              {formatINR(summary.perMemberCost)}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadEventPDF(ev, expenses, members);
                        }}
                        title="Download Event PDF"
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors border border-slate-800 bg-[#0B1323]"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : monthEvents.length === 0 ? (
          <div className="p-6 text-center bg-[#111A2E]/90 border border-slate-800/90 rounded-2xl shadow-xs space-y-2">
            <p className="text-xs font-semibold text-slate-400">
              No events recorded for {MONTH_NAMES[currentMonth]} {currentYear}.
            </p>
            <button
              onClick={() => requireAuth(() => onCreateEvent())}
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Plan an Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthEvents.map((ev) => {
              const { summary, evTotalCollections, evBalance, primaryLabel } = getEventFinancials(
                ev,
                expenses,
                members,
                transactions
              );
              const typeInfo = EVENT_TYPE_LABELS[ev.type] || { label: ev.type, color: 'slate' };
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelectEvent(ev.id)}
                  className="bg-[#111A2E]/90 hover:bg-[#15223C] border border-slate-800/80 hover:border-blue-700/60 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-xs group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-[#0B1323] text-slate-300 border border-slate-800">
                          {typeInfo.label}
                        </span>
                        <span className={`text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                          ev.status === 'completed'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                            : ev.status === 'hold'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            : ev.status === 'planning'
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60'
                            : 'bg-blue-950/70 text-blue-300 border-blue-900/40'
                        }`}>
                          {ev.status === 'hold' ? 'On Hold' : ev.status === 'completed' ? 'Closed' : ev.status}
                        </span>
                      </div>
                      <span className="text-xs text-blue-400 font-mono-num font-semibold">
                        {formatDate(ev.date)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-2">
                      {ev.name}
                    </h4>

                    {ev.location && (
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {ev.location}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="bg-[#0B1323]/90 p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs gap-2">
                      <div>
                        <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                          {primaryLabel}
                        </span>
                        <span className="font-extrabold font-mono-num text-white">
                          {formatINR(summary.totalCost)}
                        </span>
                      </div>

                      {evTotalCollections > 0 ? (
                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-emerald-400 block">
                              Collected
                            </span>
                            <span className="font-extrabold font-mono-num text-emerald-400">
                              {formatINR(evTotalCollections)}
                            </span>
                          </div>
                          <div className="pl-2 border-l border-slate-800">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">
                              {(evBalance ?? 0) === 0 ? 'Status' : 'Balance'}
                            </span>
                            <span className={`font-extrabold font-mono-num ${(evBalance ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                              {(evBalance ?? 0) === 0 ? 'Settled (₹0)' : formatINR(evBalance ?? 0)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                            Per Member
                          </span>
                          <span className="font-bold font-mono-num text-blue-300">
                            {formatINR(summary.perMemberCost)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                      <span className="font-mono-num">{ev.memberIds.length} members</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadEventPDF(ev, expenses, members);
                        }}
                        title="Download Event PDF"
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
