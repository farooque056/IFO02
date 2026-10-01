import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { CreditNote, CreditNoteStatus } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { downloadCreditNoteVoucherPDF } from '../../utils/pdfGenerator';
import { IssueCreditNoteModal } from './IssueCreditNoteModal';
import { RecordCreditRepaymentModal } from './RecordCreditRepaymentModal';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  MessageCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  History,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';

export const CreditNotesSection: React.FC = () => {
  const {
    creditNotes,
    totalCreditDisbursed,
    totalCreditRepaid,
    totalCreditOutstanding,
    deleteCreditNote,
    requireAuth,
  } = useFinance();

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | CreditNoteStatus>('all');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false);
  const [selectedCreditNoteForRepayment, setSelectedCreditNoteForRepayment] = useState<CreditNote | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const setTemporaryCopied = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const filteredNotes = useMemo(() => {
    return creditNotes.filter((cn) => {
      const matchesStatus = statusFilter === 'all' || cn.status === statusFilter;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cn.voucherNo.toLowerCase().includes(q) ||
        cn.memberName.toLowerCase().includes(q) ||
        cn.purpose.toLowerCase().includes(q) ||
        cn.notes?.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [creditNotes, statusFilter, search]);

  const activeCreditCount = creditNotes.filter(
    (c) => c.status === 'active' || c.status === 'partially_repaid'
  ).length;

  const handleCopyWhatsAppReminder = (cn: CreditNote) => {
    const text =
      `📄 *Tm ISHAL — Credit Note Voucher*\n` +
      `🔖 *Voucher No:* ${cn.voucherNo}\n` +
      `👤 *Member:* ${cn.memberName}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Credit Amount:* ${formatINR(cn.amount)}\n` +
      `✅ *Already Repaid:* ${formatINR(cn.repaidAmount)}\n` +
      `⚠️ *Remaining Outstanding:* ${formatINR(cn.remainingAmount)}\n` +
      `📅 *Issued:* ${formatDate(cn.date)}\n` +
      (cn.dueDate ? `⏰ *Target Due Date:* ${formatDate(cn.dueDate)}\n` : '') +
      `📌 *Purpose:* ${cn.purpose}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (cn.remainingAmount > 0
        ? `Kindly repay via UPI or cash into Group Balance when convenient. Thank you!\n`
        : `*Note Status:* Fully Settled & Cleared into Treasury Balance. Thank you!\n`) +
      `_Tm ISHAL Treasury & Welfare Fund_`;

    navigator.clipboard.writeText(text);
    setTemporaryCopied(`wa_${cn.id}`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Welfare Facility Banner: Members can get credit from Balance */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950/70 via-[#111A2E] to-indigo-950/60 border border-blue-800/70 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600/25 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold shadow-xs shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">
                Tm ISHAL Welfare Credit System
              </h2>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-900/80 text-blue-300 border border-blue-700/80">
                Disbursed from Balance Amount
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              If needed, members can get a credit amount directly from our group Balance amount for emergency assistance or medical welfare. Repayments flow back into our Treasury Balance.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsIssueModalOpen(true)}
          className="py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3px]" />
          <span>Get Credit from Balance</span>
        </button>
      </div>

      {/* KPI Cards: Treasury Credit System Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-blue-400 text-xs mb-1 font-semibold">
            <span>Total Disbursed</span>
            <CreditCard className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
            {formatINR(totalCreditDisbursed)}
          </p>
          <span className="text-[10px] text-slate-500">{creditNotes.length} Total Vouchers</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-1 font-semibold">
            <span>Total Repaid</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono-num">
            {formatINR(totalCreditRepaid)}
          </p>
          <span className="text-[10px] text-slate-500">Returned to Balance</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-amber-400 text-xs mb-1 font-semibold">
            <span>Active Outstanding</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-amber-400 font-mono-num">
            {formatINR(totalCreditOutstanding)}
          </p>
          <span className="text-[10px] text-slate-500">{activeCreditCount} Active Advances</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-400 text-xs mb-1 font-semibold">
            <span>Welfare Facility</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3px]" />
            <span>Issue Credit Note</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#111A2E]/90 p-3.5 rounded-2xl border border-slate-800/90 space-y-2.5 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Voucher # (e.g. CN-2026-001), member name, or purpose..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active (Unpaid)' },
              { id: 'partially_repaid', label: 'Partial' },
              { id: 'settled', label: 'Settled' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#0D1527] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credit Notes List */}
      <div className="space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="bg-[#111A2E]/90 border border-slate-800/80 rounded-3xl p-8 text-center text-slate-400 space-y-2">
            <CreditCard className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-200">No Credit Notes match your criteria</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              If needed, members can get credit amounts disbursed directly from our group Balance amount.
            </p>
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Issue New Credit Note from Balance</span>
            </button>
          </div>
        ) : (
          filteredNotes.map((cn) => {
            const isSettled = cn.status === 'settled';
            const isPartial = cn.status === 'partially_repaid';
            const isExpanded = expandedNoteId === cn.id;
            const progressPercent =
              cn.amount > 0 ? Math.min(100, Math.round((cn.repaidAmount / cn.amount) * 100)) : 0;

            return (
              <div
                key={cn.id}
                className="bg-[#111A2E]/90 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 transition-all shadow-xs space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center font-extrabold text-blue-300 text-sm shrink-0">
                      {cn.memberName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/80">
                          {cn.voucherNo}
                        </span>
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">
                          {cn.memberName}
                        </h3>
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
                      </div>
                      <p className="text-xs text-slate-300 font-medium mt-1">{cn.purpose}</p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isSettled && (
                      <button
                        onClick={() => setSelectedCreditNoteForRepayment(cn)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Repay into Balance</span>
                      </button>
                    )}

                    <button
                      onClick={() => downloadCreditNoteVoucherPDF(cn)}
                      className="p-2 bg-[#0D1527] hover:bg-[#15223C] border border-slate-700/80 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                      title="Download PDF Voucher"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                    </button>

                    <button
                      onClick={() => handleCopyWhatsAppReminder(cn)}
                      className="p-2 bg-[#0D1527] hover:bg-[#15223C] border border-slate-700/80 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                      title="Copy WhatsApp reminder"
                    >
                      {copiedKey === `wa_${cn.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>

                    <button
                      onClick={() => requireAuth(() => deleteCreditNote(cn.id))}
                      className="p-2 bg-[#0D1527] hover:bg-rose-950/40 border border-slate-700/80 text-slate-400 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                      title="Delete voucher (Admin)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key Figures Table */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0D1527] p-3 rounded-xl border border-slate-800/80 font-mono-num text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Principal Disbursed</span>
                    <span className="text-sm font-bold text-white">{formatINR(cn.amount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Repaid to Balance</span>
                    <span className="text-sm font-bold text-emerald-400">{formatINR(cn.repaidAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Remaining Owed</span>
                    <span className={`text-sm font-extrabold ${cn.remainingAmount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {formatINR(cn.remainingAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">Due Date</span>
                    <span className="text-xs font-semibold text-slate-300">
                      {cn.dueDate ? formatDate(cn.dueDate) : 'On Demand'}
                    </span>
                  </div>
                </div>

                {/* Repayment Progress Bar */}
                <div>
                  <div className="flex justify-between text-[10.5px] text-slate-400 mb-1 font-mono-num">
                    <span>Repayment Progress</span>
                    <span>{progressPercent}% Settled</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isSettled ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-amber-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Toggle Repayment Ledger History */}
                {cn.repayments && cn.repayments.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => setExpandedNoteId(isExpanded ? null : cn.id)}
                      className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Hide' : 'View'} Repayment History ({cn.repayments.length} installments)</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-700/80">
                        {cn.repayments.map((rep, idx) => (
                          <div
                            key={rep.id}
                            className="bg-[#0D1527] p-2.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 text-[10px] font-bold flex items-center justify-center font-mono">
                                #{idx + 1}
                              </span>
                              <div>
                                <span className="text-white font-medium font-mono-num">{formatDate(rep.date)}</span>
                                <span className="text-slate-500 text-[11px] ml-1.5 capitalize">via {rep.paymentMethod}</span>
                                {rep.notes && <p className="text-[11px] text-slate-400 mt-0.5">{rep.notes}</p>}
                              </div>
                            </div>
                            <span className="font-extrabold text-emerald-400 font-mono-num">
                              +{formatINR(rep.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Issue Modal */}
      {isIssueModalOpen && (
        <IssueCreditNoteModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
        />
      )}

      {/* Repayment Modal */}
      {selectedCreditNoteForRepayment && (
        <RecordCreditRepaymentModal
          creditNote={selectedCreditNoteForRepayment}
          isOpen={!!selectedCreditNoteForRepayment}
          onClose={() => setSelectedCreditNoteForRepayment(null)}
        />
      )}
    </div>
  );
};
