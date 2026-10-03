import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Member, EventItem, CreditNote } from '../../types';
import { calculateEventSummary, formatINR, formatDate, getMemberFinancials, isMemberExemptFromEvent } from '../../utils/formatters';
import { downloadMemberPDF, downloadCreditNoteVoucherPDF } from '../../utils/pdfGenerator';
import { IssueCreditNoteModal } from '../CreditNotes/IssueCreditNoteModal';
import { RecordCreditRepaymentModal } from '../CreditNotes/RecordCreditRepaymentModal';
import {
  X,
  Phone,
  MessageCircle,
  FileText,
  Calendar,
  CreditCard,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  Edit,
  Trash2,
  Share2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Shield,
  ArrowUpRight,
  Plus,
  Download,
} from 'lucide-react';

interface MemberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onEditMember: (member: Member) => void;
  onSelectEvent: (eventId: string) => void;
}

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({
  isOpen,
  onClose,
  member,
  onEditMember,
  onSelectEvent,
}) => {
  const { members, events, expenses, transactions, creditNotes, requireAuth, deleteMember } = useFinance();
  const [activeTab, setActiveTab] = useState<'events' | 'expenses' | 'credit' | 'whatsapp'>('events');
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isIssueCreditModalOpen, setIsIssueCreditModalOpen] = useState(false);
  const [selectedCreditNoteForRepayment, setSelectedCreditNoteForRepayment] = useState<CreditNote | null>(null);

  if (!isOpen || !member) return null;

  // Member credit notes calculations
  const memberCreditNotes = useMemo(
    () => (creditNotes || []).filter((c) => c.memberId === member.id),
    [creditNotes, member.id]
  );
  const memberActiveCredits = useMemo(
    () => memberCreditNotes.filter((c) => c.status !== 'settled'),
    [memberCreditNotes]
  );
  const memberTotalCreditDisbursed = useMemo(
    () => memberCreditNotes.reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [memberCreditNotes]
  );
  const memberTotalCreditRepaid = useMemo(
    () => memberCreditNotes.reduce((sum, c) => sum + (Number(c.repaidAmount) || 0), 0),
    [memberCreditNotes]
  );
  const memberTotalCreditOwed = useMemo(
    () => memberActiveCredits.reduce((sum, c) => sum + (Number(c.remainingAmount) || 0), 0),
    [memberActiveCredits]
  );


  // Compute aggregated stats using event donations and per-event pending calculations
  const financials = getMemberFinancials(member, events, expenses, transactions);
  const { joinedEvents, joinedEventsCount, totalPaid, totalPending, pendingEvents, isAllClear, memberExpenses } = financials;

  // Clean phone number for WhatsApp
  const rawPhone = (member.phone || '').replace(/[^0-9]/g, '');
  const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

  // Pre-composed WhatsApp statement message
  const generateWhatsAppMessage = () => {
    let msg = `Hi ${member.name},\n\n`;
    msg += `*Tm ISHAL — Member Financial Summary*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 *Member:* ${member.name} (${member.role || 'Member'})\n`;
    msg += `📅 *Events Joined:* ${joinedEventsCount}\n`;
    msg += `💰 *Total Donated / Paid:* ${formatINR(totalPaid)}\n`;
    if (joinedEventsCount > 0) {
      msg += `⏱️ *Avg Payment Delay:* ${financials.avgPaymentDelayDays} days (${financials.timelinessBadge.label})\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    if (isAllClear) {
      msg += `✅ *STATUS:* All Event Contributions Cleared (Settled)\n`;
    } else {
      msg += `⚠️ *STATUS:* Total Pending Due of *${formatINR(totalPending)}*\n`;
      msg += `\n*Pending Events Breakdown:*\n`;
      pendingEvents.forEach((p, idx) => {
        const overdueText = p.daysOverdue > 0 ? ` (${p.daysOverdue}d overdue)` : '';
        msg += `${idx + 1}. *${p.eventName}*${overdueText}\n`;
        msg += `   • Share: ${formatINR(p.perMemberCost)} | Donated: ${formatINR(p.donatedAmount)} | *Pending: ${formatINR(p.pendingAmount)}*\n`;
      });
    }

    if (joinedEvents.length > 0) {
      msg += `\n*Event History:*\n`;
      joinedEvents.forEach((ev, idx) => {
        const isExempt = isMemberExemptFromEvent(ev, member.id, members);
        const pe = pendingEvents.find((p) => p.eventId === ev.id);
        const evDonated = financials.eventDonations
          .filter((d) => d.eventId === ev.id)
          .reduce((sum, d) => sum + d.amount, 0);
        if (isExempt) {
          msg += `${idx + 1}. *${ev.name}*: 💍 Exempt (Groom / Celebrant • ₹0 Share)\n`;
        } else {
          msg += `${idx + 1}. *${ev.name}*: ${pe ? `⚠️ Pending ${formatINR(pe.pendingAmount)}` : `✅ Settled (${formatINR(evDonated)})`}\n`;
        }
      });
    }

    msg += `\n_Generated via Tm ISHAL (Ishal Finance Organizer)_`;
    return msg;
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleDownloadPDF = () => {
    downloadMemberPDF(member, events, expenses, members, transactions);
  };

  const handleDelete = () => {
    requireAuth(() => {
      const res = deleteMember(member.id);
      if (!res.success) {
        setDeleteError(res.message || 'Cannot delete member.');
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0 bg-[#0F182C]">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-extrabold text-white shadow-md shrink-0 ring-2 ring-[#0D1527]"
              style={{ backgroundColor: member.avatarColor || '#2563EB' }}
            >
              {member.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white truncate">
                  {member.name}
                </h2>
                {member.role && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 shrink-0">
                    {member.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                {member.phone ? (
                  <a href={`tel:${member.phone}`} className="hover:text-blue-400 font-mono-num flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {member.phone}
                  </a>
                ) : (
                  'Tm ISHAL Core Member'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onClose();
                onEditMember(member);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Edit Member Profile"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#0B1120]">
          {deleteError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold">
              {deleteError}
            </div>
          )}

          {/* Quick Action Buttons Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {member.phone && (
              <a
                href={`tel:${member.phone}`}
                className="py-2.5 px-3 bg-[#111A2E] hover:bg-[#15223C] border border-slate-800 hover:border-blue-700/60 rounded-2xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Phone className="w-3.5 h-3.5 text-blue-400" />
                <span>Call Phone</span>
              </a>
            )}

            <button
              onClick={handleOpenWhatsApp}
              className="py-2.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="py-2.5 px-3 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 text-blue-300 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Statement</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              className="py-2.5 px-3 bg-[#111A2E] hover:bg-[#15223C] border border-slate-800 rounded-2xl text-xs font-bold text-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
          </div>

          {/* 5 Financial Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-[#111A2E]/90 border border-slate-800 rounded-2xl p-3.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Joined Events
              </span>
              <span className="text-xl font-extrabold text-white font-mono-num mt-1 block">
                {joinedEventsCount}
              </span>
              <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
                of {events.length} total
              </span>
            </div>

            <div className="bg-[#111A2E]/90 border border-slate-800 rounded-2xl p-3.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total Paid
              </span>
              <span className="text-xl font-extrabold text-emerald-400 font-mono-num mt-1 block">
                {formatINR(totalPaid)}
              </span>
              <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
                event donations
              </span>
            </div>

            <div className="bg-[#111A2E]/90 border border-slate-800 rounded-2xl p-3.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Pending Dues
              </span>
              <span className={`text-xl font-extrabold font-mono-num mt-1 block ${totalPending > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatINR(totalPending)}
              </span>
              <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
                {pendingEvents.length} events pending
              </span>
            </div>

            <div className="bg-[#111A2E]/90 border border-slate-800 rounded-2xl p-3.5 text-center shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Avg Settlement Delay
              </span>
              <span className={`text-xl font-extrabold font-mono-num mt-1 block ${financials.avgPaymentDelayDays > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {joinedEventsCount > 0 ? `${financials.avgPaymentDelayDays}d` : '—'}
              </span>
              <span className="text-[10.5px] text-slate-400 block font-bold mt-0.5">
                {financials.timelinessBadge.label}
              </span>
            </div>

            <div
              className={`border rounded-2xl p-3.5 text-center shadow-xs col-span-2 sm:col-span-1 ${
                isAllClear
                  ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
              }`}
            >
              <span className="text-[10px] uppercase font-bold block tracking-wider opacity-80">
                Payment Status
              </span>
              <span className="text-xl font-extrabold font-mono-num mt-1 block">
                {isAllClear ? 'Settled' : 'Action Due'}
              </span>
              <span className="text-[10.5px] font-bold block mt-0.5">
                {isAllClear ? 'All cleared' : `${pendingEvents.length} event pending`}
              </span>
            </div>
          </div>

          {/* Pending Events Breakdown Banner if any */}
          {pendingEvents.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Events with Pending Amounts ({pendingEvents.length})
                </span>
                <span className="text-xs font-extrabold text-amber-200 font-mono-num">
                  Total Due: {formatINR(totalPending)}
                </span>
              </div>
              <div className="space-y-2">
                {pendingEvents.map((pe) => (
                  <div
                    key={pe.eventId}
                    onClick={() => {
                      onClose();
                      onSelectEvent(pe.eventId);
                    }}
                    className="p-3 bg-[#0B1323] hover:bg-amber-950/60 border border-amber-700/40 hover:border-amber-500 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                          {pe.eventName}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.2 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/50">
                          {pe.eventType}
                        </span>
                        {pe.daysOverdue > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {pe.daysOverdue}d overdue
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Share: <strong className="text-slate-200 font-mono-num">{formatINR(pe.perMemberCost)}</strong> • Donated: <strong className="text-emerald-400 font-mono-num">{formatINR(pe.donatedAmount)}</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-amber-300 font-mono-num block">
                        Pending: {formatINR(pe.pendingAmount)}
                      </span>
                      <span className="text-[10px] text-slate-400 group-hover:text-amber-300 flex items-center justify-end gap-0.5 transition-colors mt-0.5 font-medium">
                        Open Event <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Member Credit Note Advance Banner if any */}
          {memberTotalCreditOwed > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shadow-amber-950/20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-950 border border-amber-500/80 text-amber-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-amber-200">
                      Active Credit Note from Balance:
                    </span>
                    <span className="text-xs font-extrabold text-amber-300 font-mono-num">
                      {formatINR(memberTotalCreditOwed)}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/80 text-amber-300 border border-amber-700">
                      {memberActiveCredits.length} advance(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Disbursed directly from Tm ISHAL Group Balance. Member can repay in partial or full installments.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('credit')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>View Advances & Repay</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('events')}
              className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Participated Events ({joinedEventsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Direct Expenses Paid ({memberExpenses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('credit')}
              className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'credit'
                  ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Credit Notes ({memberCreditNotes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'whatsapp'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp Statement</span>
            </button>
          </div>

          {/* TAB 1: JOINED EVENTS */}
          {activeTab === 'events' && (
            <div className="space-y-3">
              {joinedEvents.length === 0 ? (
                <div className="p-8 text-center bg-[#111A2E] border border-slate-800 rounded-2xl space-y-2">
                  <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-white">No joined events yet</p>
                  <p className="text-xs text-slate-400">
                    Include {member.name} when creating or editing Tm ISHAL events.
                  </p>
                </div>
              ) : (
                joinedEvents.map((event) => {
                  const evSummary = calculateEventSummary(event, expenses, members);
                  const isExempt = isMemberExemptFromEvent(event, member.id, members);
                  const pe = pendingEvents.find((p) => p.eventId === event.id);
                  const donatedForThisEvent = financials.eventDonations
                    .filter((d) => d.eventId === event.id)
                    .reduce((sum, d) => sum + d.amount, 0);
                  const isPending = !isExempt && !!pe && pe.pendingAmount > 0;

                  return (
                    <div
                      key={event.id}
                      onClick={() => {
                        onClose();
                        onSelectEvent(event.id);
                      }}
                      className="bg-[#111A2E] hover:bg-[#15223C] border border-slate-800 hover:border-blue-700/60 rounded-2xl p-4 transition-all duration-200 cursor-pointer group shadow-xs flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400 font-mono-num font-medium">
                            {formatDate(event.date)}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/60">
                            {event.type}
                          </span>
                          {isExempt && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/70">
                              💍 Exempt from collection
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1 group-hover:text-blue-400 transition-colors truncate">
                          {event.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5 font-medium">
                          <span>Event Total: <strong className="text-white font-mono-num">{formatINR(evSummary.totalCost)}</strong></span>
                          <span>•</span>
                          <span>Share: <strong className={`font-mono-num ${isExempt ? 'text-rose-300 font-bold' : 'text-blue-400'}`}>{isExempt ? '₹0 (Exempt)' : formatINR(evSummary.perMemberCost)}</strong></span>
                          <span>•</span>
                          <span>Donated (Paid): <strong className="text-emerald-400 font-mono-num">{formatINR(donatedForThisEvent)}</strong></span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border block text-center font-mono-num ${
                            isExempt
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                              : isPending
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {isExempt
                            ? '💍 Exempt (₹0)'
                            : isPending
                            ? `Pending ${formatINR(pe.pendingAmount)}`
                            : `Settled`}
                        </span>
                        {isPending && pe.daysOverdue > 0 && (
                          <span className="text-[10px] font-bold text-rose-400 block font-mono-num mt-0.5">
                            {pe.daysOverdue}d overdue
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 block mt-1 font-medium group-hover:text-blue-400 transition-colors">
                          View Event Ledger →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: DIRECT EXPENSES PAID */}
          {activeTab === 'expenses' && (
            <div className="space-y-3">
              {memberExpenses.length === 0 ? (
                <div className="p-8 text-center bg-[#111A2E] border border-slate-800 rounded-2xl space-y-2">
                  <CreditCard className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-white">No direct out-of-pocket expenses</p>
                  <p className="text-xs text-slate-400">
                    No expense bills have been recorded as paid directly by {member.name}.
                  </p>
                </div>
              ) : (
                memberExpenses.map((exp) => {
                  const parentEvent = events.find((e) => e.id === exp.eventId);
                  return (
                    <div
                      key={exp.id}
                      className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono-num font-medium">
                            {formatDate(exp.date)}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 uppercase">
                            {exp.category || 'General'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 uppercase">
                            {exp.paymentMethod || 'cash'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1 truncate">
                          {exp.name}
                        </h4>
                        {parentEvent && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">
                            For: <span className="text-blue-400 font-semibold">{parentEvent.name}</span>
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-base font-extrabold font-mono-num text-emerald-400">
                          {formatINR(exp.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: CREDIT NOTES & WELFARE ADVANCES (FROM BALANCE) */}
          {activeTab === 'credit' && (
            <div className="space-y-4">
              {/* Header Overview Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 via-[#111A2E] to-indigo-950/50 border border-blue-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold shrink-0 mt-0.5">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Welfare Credit Facility</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-900/70 text-blue-300 border border-blue-700/60">
                        From Group Balance
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Members can get credit amounts directly from our Balance amount for emergency or welfare support. Repayments return directly into group funds.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsIssueCreditModalOpen(true)}
                  className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 stroke-[3px]" />
                  <span>Get Credit from Balance</span>
                </button>
              </div>

              {/* 3 Metric Cards for this Member */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#111A2E] p-3 rounded-2xl border border-slate-800">
                  <span className="text-[9.5px] uppercase font-bold text-slate-400 block tracking-wider">
                    Total Disbursed
                  </span>
                  <p className="text-sm sm:text-base font-extrabold text-white font-mono-num mt-0.5">
                    {formatINR(memberTotalCreditDisbursed)}
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium">{memberCreditNotes.length} vouchers</span>
                </div>

                <div className="bg-[#111A2E] p-3 rounded-2xl border border-slate-800">
                  <span className="text-[9.5px] uppercase font-bold text-emerald-400 block tracking-wider">
                    Repaid to Balance
                  </span>
                  <p className="text-sm sm:text-base font-extrabold text-emerald-400 font-mono-num mt-0.5">
                    {formatINR(memberTotalCreditRepaid)}
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium">Returned</span>
                </div>

                <div className="bg-[#111A2E] p-3 rounded-2xl border border-slate-800">
                  <span className="text-[9.5px] uppercase font-bold text-amber-400 block tracking-wider">
                    Outstanding Owed
                  </span>
                  <p className="text-sm sm:text-base font-extrabold text-amber-400 font-mono-num mt-0.5">
                    {formatINR(memberTotalCreditOwed)}
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium">{memberActiveCredits.length} active</span>
                </div>
              </div>

              {/* Credit Vouchers List */}
              <div className="space-y-3">
                {memberCreditNotes.length === 0 ? (
                  <div className="p-8 text-center bg-[#111A2E] border border-slate-800 rounded-2xl space-y-3">
                    <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-white">No credit notes issued for {member.name}</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        If needed, this member can receive an interest-free advance disbursed directly from our group Balance amount.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsIssueCreditModalOpen(true)}
                      className="mt-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Issue Credit Note from Balance</span>
                    </button>
                  </div>
                ) : (
                  memberCreditNotes.map((cn) => {
                    const isSettled = cn.status === 'settled';
                    const isPartial = cn.status === 'partially_repaid';
                    const progressPercent = cn.amount > 0 ? Math.min(100, Math.round((cn.repaidAmount / cn.amount) * 100)) : 0;

                    return (
                      <div
                        key={cn.id}
                        className="bg-[#111A2E] border border-slate-800/90 rounded-2xl p-4 shadow-xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/80">
                              {cn.voucherNo}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                isSettled
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                                  : isPartial
                                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                              }`}
                            >
                              {isSettled ? '✓ Fully Settled' : isPartial ? 'Partially Repaid' : 'Active (Unpaid)'}
                            </span>
                            <span className="text-xs text-slate-400 font-mono-num">
                              Issued: {formatDate(cn.date)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            {!isSettled && (
                              <button
                                onClick={() => setSelectedCreditNoteForRepayment(cn)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Repay into Balance</span>
                              </button>
                            )}

                            <button
                              onClick={() => downloadCreditNoteVoucherPDF(cn)}
                              className="p-1.5 bg-[#0D1527] hover:bg-[#15223C] border border-slate-700/80 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Download PDF Voucher"
                            >
                              <Download className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-white">{cn.purpose}</p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                            <span>Disbursed Mode: <strong className="text-slate-200 capitalize">{cn.paymentMethod}</strong></span>
                            {cn.dueDate && (
                              <span>Due: <strong className="text-slate-200">{formatDate(cn.dueDate)}</strong></span>
                            )}
                          </div>
                        </div>

                        {/* Financial Figures */}
                        <div className="grid grid-cols-3 gap-2 bg-[#0D1527] p-2.5 rounded-xl border border-slate-800/80 text-center font-mono-num">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Total Issued</span>
                            <span className="text-xs font-bold text-white">{formatINR(cn.amount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Repaid</span>
                            <span className="text-xs font-bold text-emerald-400">{formatINR(cn.repaidAmount)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Remaining</span>
                            <span className={`text-xs font-extrabold ${cn.remainingAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {formatINR(cn.remainingAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono-num">
                            <span>Repayment Progress</span>
                            <span>{progressPercent}% Settled</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isSettled ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-amber-500'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Repayments History */}
                        {cn.repayments && cn.repayments.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/70 text-xs">
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-1">
                              Repayment History ({cn.repayments.length} installments)
                            </span>
                            <div className="space-y-1">
                              {cn.repayments.map((rep) => (
                                <div key={rep.id} className="flex items-center justify-between text-[11px] text-slate-300 bg-[#0B1120] px-2.5 py-1 rounded-lg">
                                  <span className="font-mono-num text-slate-400">{formatDate(rep.date)} ({rep.paymentMethod})</span>
                                  <span className="font-bold text-emerald-400 font-mono-num">+{formatINR(rep.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: WHATSAPP STATEMENT PREVIEW */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="bg-[#111A2E] border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                {generateWhatsAppMessage()}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleOpenWhatsApp}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                </button>
                <button
                  onClick={handleCopyWhatsApp}
                  className="py-3 px-5 bg-[#111A2E] hover:bg-[#15223C] border border-slate-800 text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Delete Member Option Area */}
          <div className="pt-4 border-t border-slate-800/80">
            {showDeleteConfirm ? (
              <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-rose-200 font-bold">
                  Delete {member.name} from the Tm ISHAL roster?
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  This will remove them from the member list. (Members with active financial records in events cannot be deleted until reconciled).
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2.5 bg-[#0F182C] hover:bg-rose-950/30 text-rose-400 hover:text-rose-300 border border-slate-800/80 hover:border-rose-900/60 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Member from Roster</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Issue Credit Note Modal with this member preselected */}
      {isIssueCreditModalOpen && (
        <IssueCreditNoteModal
          isOpen={isIssueCreditModalOpen}
          onClose={() => setIsIssueCreditModalOpen(false)}
          preselectedMemberId={member.id}
        />
      )}

      {/* Record Credit Repayment Modal */}
      {selectedCreditNoteForRepayment && (
        <RecordCreditRepaymentModal
          isOpen={!!selectedCreditNoteForRepayment}
          onClose={() => setSelectedCreditNoteForRepayment(null)}
          creditNote={selectedCreditNoteForRepayment}
        />
      )}
    </div>
  );
};

