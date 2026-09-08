import React, { useState, useMemo } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
  Copy,
  Check,
  Search,
  Filter,
  Calendar,
  ExternalLink,
  ChevronRight,
  Send,
  UserCheck,
} from 'lucide-react';
import { formatINR, formatDate } from '../../utils/formatters';
import { EventItem, Member } from '../../types';

export interface PendingItem {
  eventId: string;
  eventName: string;
  eventDate?: string;
  eventType?: string;
  memberId: string;
  memberName: string;
  phone?: string;
  role?: string;
  amountOwed: number;
}

interface PendingMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  unpaidItems: PendingItem[];
  events: EventItem[];
  members: Member[];
  onSelectEvent?: (eventId: string) => void;
  onMarkPaid: (eventId: string, memberId: string, paid: boolean) => void;
}

export const PendingMembersModal: React.FC<PendingMembersModalProps> = ({
  isOpen,
  onClose,
  unpaidItems,
  events,
  members,
  onSelectEvent,
  onMarkPaid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [actionSuccessText, setActionSuccessText] = useState<string | null>(null);

  // Group unpaid records by member
  const memberGroupedData = useMemo(() => {
    const map = new Map<
      string,
      {
        memberId: string;
        memberName: string;
        phone?: string;
        role?: string;
        totalPending: number;
        records: PendingItem[];
      }
    >();

    unpaidItems.forEach((item) => {
      if (!map.has(item.memberId)) {
        const memberObj = members.find((m) => m.id === item.memberId);
        map.set(item.memberId, {
          memberId: item.memberId,
          memberName: item.memberName || memberObj?.name || 'Member',
          phone: item.phone || memberObj?.phone,
          role: item.role || memberObj?.role,
          totalPending: 0,
          records: [],
        });
      }
      const entry = map.get(item.memberId)!;
      entry.totalPending += item.amountOwed;
      entry.records.push(item);
    });

    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [unpaidItems, members]);

  // Total summary calculations
  const totalPendingAmount = useMemo(() => {
    return unpaidItems.reduce((sum, item) => sum + item.amountOwed, 0);
  }, [unpaidItems]);

  const uniqueMembersCount = memberGroupedData.length;

  // Filtered members list based on search and event filter
  const filteredMemberGroups = useMemo(() => {
    return memberGroupedData
      .map((group) => {
        // Filter records inside member by selected event filter
        const filteredRecords = group.records.filter((rec) => {
          if (selectedEventFilter !== 'all' && rec.eventId !== selectedEventFilter) {
            return false;
          }
          return true;
        });

        const subtotal = filteredRecords.reduce((sum, r) => sum + r.amountOwed, 0);

        return {
          ...group,
          records: filteredRecords,
          subtotal,
        };
      })
      .filter((group) => {
        if (group.records.length === 0) return false;

        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase().trim();
          const nameMatch = group.memberName.toLowerCase().includes(term);
          const phoneMatch = (group.phone || '').toLowerCase().includes(term);
          const eventMatch = group.records.some((r) => r.eventName.toLowerCase().includes(term));
          return nameMatch || phoneMatch || eventMatch;
        }

        return true;
      });
  }, [memberGroupedData, searchTerm, selectedEventFilter]);

  // Generate WhatsApp text for a single member
  const handleSendSingleReminder = (
    member: { memberName: string; phone?: string; totalPending: number },
    records: PendingItem[]
  ) => {
    if (!member.phone) {
      alert(`No phone number available for ${member.memberName}.`);
      return;
    }

    const cleanPhone = member.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    let text = `Salam ${member.memberName},\n\n`;
    text += `Friendly reminder from our community team regarding pending event contributions:\n\n`;
    records.forEach((r, idx) => {
      text += `${idx + 1}. *${r.eventName}*: ${formatINR(r.amountOwed)}\n`;
    });
    text += `\n*Total Pending: ${formatINR(member.totalPending)}*\n\n`;
    text += `Please settle this with the treasurer at your convenience. Thank you!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encoded}`, '_blank');
  };

  // Copy full pending list for WhatsApp sharing
  const handleCopyFullPendingSummary = () => {
    if (memberGroupedData.length === 0) return;

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    let msg = `📋 *COMMUNITY PENDING DUES SUMMARY*\n`;
    msg += `📅 *Date:* ${dateStr}\n`;
    msg += `💰 *Total Outstanding:* ${formatINR(totalPendingAmount)} (${uniqueMembersCount} members)\n`;
    msg += `------------------------------------\n\n`;

    memberGroupedData.forEach((group, idx) => {
      msg += `${idx + 1}. *${group.memberName}* — ${formatINR(group.totalPending)}\n`;
      group.records.forEach((r) => {
        msg += `   • ${r.eventName}: ${formatINR(r.amountOwed)}\n`;
      });
      msg += `\n`;
    });

    msg += `------------------------------------\n`;
    msg += `Kindly transfer or hand over pending shares to the finance team. JazakAllah Khair!`;

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 3000);
    });
  };

  const handleQuickMarkPaid = (eventId: string, memberId: string, memberName: string, eventName: string) => {
    onMarkPaid(eventId, memberId, true);
    setActionSuccessText(`✓ Marked ${memberName} as Paid for "${eventName}"`);
    setTimeout(() => setActionSuccessText(null), 3000);
  };

  const handleMarkAllForMember = (group: { memberId: string; memberName: string; records: PendingItem[] }) => {
    group.records.forEach((r) => {
      onMarkPaid(r.eventId, group.memberId, true);
    });
    setActionSuccessText(`✓ Settle All: Marked ${group.memberName} as Paid for ${group.records.length} events!`);
    setTimeout(() => setActionSuccessText(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0B1323] border border-amber-800/60 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative text-white">
        {/* Top Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-950/80 via-[#101B30] to-[#0A111F] border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-950/90 border border-amber-600/60 text-amber-400 flex items-center justify-center font-bold shadow-lg shadow-amber-950/50 shrink-0">
              <AlertCircle className="w-6 h-6 stroke-[2.2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Pending Members List
                </h2>
                <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-700/80">
                  {uniqueMembersCount} Members
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800 font-mono-num">
                  {unpaidItems.length} Event Dues
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Total Pending Dues:{' '}
                <strong className="text-amber-400 font-mono-num text-sm">
                  {formatINR(totalPendingAmount)}
                </strong>{' '}
                across community functions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action toast feedback */}
        {actionSuccessText && (
          <div className="bg-emerald-950/90 border-b border-emerald-800/80 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-300 animate-in slide-in-from-top-1 duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessText}</span>
          </div>
        )}

        {/* Action toolbar & Filters */}
        <div className="p-3.5 sm:p-4 bg-[#0E1729] border-b border-slate-800/80 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search pending member or event..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#070D18] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Event Filter Select */}
            <div className="relative shrink-0">
              <select
                value={selectedEventFilter}
                onChange={(e) => setSelectedEventFilter(e.target.value)}
                className="pl-2.5 pr-7 py-2 bg-[#070D18] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500/70 cursor-pointer appearance-none font-medium max-w-[150px] sm:max-w-[190px] truncate"
              >
                <option value="all">All Events ({unpaidItems.length})</option>
                {events
                  .filter((ev) => unpaidItems.some((u) => u.eventId === ev.id))
                  .map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
              </select>
              <Filter className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* WhatsApp Copy Summary Button */}
          <button
            type="button"
            onClick={handleCopyFullPendingSummary}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
              copiedNotification
                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/30'
                : 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200'
            }`}
            title="Copy formatted WhatsApp summary to share in committee group"
          >
            {copiedNotification ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5px]" />
                <span>Copied WhatsApp List!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 stroke-[2.2px]" />
                <span>Copy WhatsApp List</span>
              </>
            )}
          </button>
        </div>

        {/* Pending Members List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 divide-y divide-slate-800/60">
          {filteredMemberGroups.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Pending Dues Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchTerm || selectedEventFilter !== 'all'
                  ? 'No pending records match your current search or filter criteria.'
                  : 'All community members are fully settled across all active events!'}
              </p>
            </div>
          ) : (
            filteredMemberGroups.map((group) => {
              const hasMultiple = group.records.length > 1;

              return (
                <div
                  key={group.memberId}
                  className="pt-3.5 first:pt-0 bg-[#0F172A]/50 border border-slate-800/90 rounded-2xl p-4 hover:border-slate-700/90 transition-all shadow-xs"
                >
                  {/* Member Summary Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/70">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {group.memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white tracking-tight">
                            {group.memberName}
                          </h4>
                          {group.role && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                              {group.role}
                            </span>
                          )}
                          {group.phone && (
                            <span className="text-xs text-slate-400 font-mono-num">
                              {group.phone}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Owing in{' '}
                          <strong className="text-slate-200">
                            {group.records.length} {group.records.length === 1 ? 'event' : 'events'}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <div className="text-right sm:mr-1">
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Due</span>
                        <span className="text-base font-extrabold text-amber-400 font-mono-num leading-tight">
                          {formatINR(group.subtotal)}
                        </span>
                      </div>

                      {/* WhatsApp Reminder Button */}
                      {group.phone && (
                        <button
                          type="button"
                          onClick={() => handleSendSingleReminder(group, group.records)}
                          className="py-1.5 px-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title={`Send WhatsApp reminder to ${group.memberName}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5 stroke-[2.2px]" />
                          <span>Remind</span>
                        </button>
                      )}

                      {/* Quick Settle All for Member (if multiple events) */}
                      {hasMultiple && (
                        <button
                          type="button"
                          onClick={() => handleMarkAllForMember(group)}
                          className="py-1.5 px-2.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-700/80 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Mark paid for all events this member owes"
                        >
                          <UserCheck className="w-3.5 h-3.5 stroke-[2.2px]" />
                          <span>Settle All</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Individual Event Dues Rows */}
                  <div className="mt-2.5 space-y-1.5">
                    {group.records.map((rec) => (
                      <div
                        key={rec.eventId}
                        className="p-2.5 bg-[#080E1A] border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-200 hover:text-blue-400 transition-colors truncate">
                              {rec.eventName}
                            </span>
                            {rec.eventType && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 capitalize font-medium">
                                {rec.eventType}
                              </span>
                            )}
                            {rec.eventDate && (
                              <span className="text-[10.5px] text-slate-500 font-mono-num flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(rec.eventDate)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-extrabold text-amber-300 font-mono-num text-xs">
                            {formatINR(rec.amountOwed)}
                          </span>

                          {/* Quick Mark as Paid Button */}
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickMarkPaid(rec.eventId, group.memberId, group.memberName, rec.eventName)
                            }
                            className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            title={`Mark ${group.memberName} as paid for ${rec.eventName}`}
                          >
                            <Check className="w-3 h-3 stroke-[2.8px]" />
                            <span>Mark Paid</span>
                          </button>

                          {/* View Event Button */}
                          {onSelectEvent && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectEvent(rec.eventId);
                                onClose();
                              }}
                              className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
                              title="Go to Event Ledger"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-[#0A101D] border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs text-slate-400 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              Showing <strong>{filteredMemberGroups.length}</strong> of{' '}
              <strong>{uniqueMembersCount}</strong> pending members
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
