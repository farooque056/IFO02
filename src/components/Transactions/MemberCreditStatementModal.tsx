import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Member, TransactionRecord } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import { downloadMemberCreditStatementPDF } from '../../utils/pdfGenerator';
import {
  X,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Share2,
  Download,
  Check,
  Edit2,
  Trash2,
  AlertTriangle,
  Plus,
  FileText,
  Search,
  Building2,
  Wallet,
} from 'lucide-react';

interface MemberCreditStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMemberId?: string;
  onOpenCreditModal: (mode: 'give_credit' | 'repayment', memberId?: string, txToEdit?: TransactionRecord) => void;
}

export const MemberCreditStatementModal: React.FC<MemberCreditStatementModalProps> = ({
  isOpen,
  onClose,
  initialMemberId,
  onOpenCreditModal,
}) => {
  const {
    members,
    transactions,
    deleteTransaction,
    requireAuth,
  } = useFinance();

  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || (members[0]?.id || '')
  );
  const [copied, setCopied] = useState(false);
  const [txToDelete, setTxToDelete] = useState<TransactionRecord | null>(null);

  // Sync selectedMemberId when modal opens with initialMemberId
  React.useEffect(() => {
    if (isOpen && initialMemberId) {
      setSelectedMemberId(initialMemberId);
    } else if (isOpen && !selectedMemberId && members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [isOpen, initialMemberId, members]);

  // All credit transactions
  const allCreditTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        (tx.transactionType === 'Member Credit' || tx.transactionType === 'Credit Repayment') &&
        tx.paymentStatus !== 'Unpaid'
    );
  }, [transactions]);

  // Selected member object
  const currentMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || members[0] || null;
  }, [members, selectedMemberId]);

  // Member's credit transactions sorted chronologically
  const memberTransactions = useMemo(() => {
    if (!currentMember) return [];
    return allCreditTransactions
      .filter((tx) => tx.memberId === currentMember.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allCreditTransactions, currentMember]);

  // Compute Running Balance and totals
  const { creditRows, totalGiven, totalRepaid, netOutstanding } = useMemo(() => {
    let given = 0;
    let repaid = 0;
    let balance = 0;

    const rows = memberTransactions.map((tx) => {
      const isGiven = tx.transactionType === 'Member Credit';
      if (isGiven) {
        given += tx.amount;
        balance += tx.amount;
      } else {
        repaid += tx.amount;
        balance = Math.max(0, balance - tx.amount);
      }
      return {
        tx,
        isGiven,
        runningDue: balance,
      };
    });

    return {
      creditRows: rows,
      totalGiven: given,
      totalRepaid: repaid,
      netOutstanding: Math.max(0, given - repaid),
    };
  }, [memberTransactions]);

  if (!isOpen) return null;

  const handleShareWhatsApp = () => {
    if (!currentMember) return;
    const lines = [
      `*Tm ISHAL • Member Credit & Advance Statement*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Member:* ${currentMember.name}`,
      `📞 *Phone:* ${currentMember.phone || 'N/A'}`,
      `📅 *Date:* ${new Date().toLocaleDateString('en-GB')}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*CREDIT STATEMENT SUMMARY:*`,
      `• Total Credit Disbursed: *${formatINR(totalGiven)}*`,
      `• Total Repaid to Fund: *${formatINR(totalRepaid)}*`,
      `• Current Outstanding Balance: *${formatINR(netOutstanding)}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `*DETAILED TRANSACTION JOURNAL:*`,
    ];

    if (creditRows.length === 0) {
      lines.push(`(No credit entries recorded yet)`);
    } else {
      creditRows.forEach((item, idx) => {
        const sign = item.isGiven ? '🔻 GIVEN' : '🟢 REPAID';
        lines.push(
          `${idx + 1}. ${formatDate(item.tx.date)} | ${sign}: ${formatINR(item.tx.amount)} [${(item.tx.paymentMethod || 'bank').toUpperCase()}]`
        );
        lines.push(`   Balance Due: ${formatINR(item.runningDue)}`);
        if (item.tx.notes) {
          lines.push(`   Note: ${item.tx.notes}`);
        }
      });
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(
      netOutstanding > 0
        ? `⚠️ *Current Net Due to Tm ISHAL Fund:* ${formatINR(netOutstanding)}`
        : `✅ *All Dues Cleared! Nil Balance.*`
    );
    lines.push(`_Tm ISHAL Treasury Organizer (IFO)_`);

    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Also offer direct WhatsApp open if phone exists
    if (currentMember.phone) {
      const cleanPhone = currentMember.phone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  const handleDownloadPDF = () => {
    if (!currentMember) return;
    downloadMemberCreditStatementPDF(currentMember, memberTransactions, {
      totalGiven,
      totalRepaid,
      outstanding: netOutstanding,
    });
  };

  const confirmDelete = () => {
    if (!txToDelete) return;
    requireAuth(() => {
      deleteTransaction(txToDelete.transactionId);
      setTxToDelete(null);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1527] border border-slate-800/90 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-white max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 bg-[#0F182C] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-800/60 text-amber-400 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Coins className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white truncate">Member Credit Statement</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                  Audit Ledger
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">
                Disbursed advances from treasury balance and repayments journal
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Switcher & Quick Actions */}
        <div className="p-4 bg-[#111A2E] border-b border-slate-800/80 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Member Dropdown */}
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Select Member Account:
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#090F1D] border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
              >
                {members.map((m) => {
                  const mAll = allCreditTransactions.filter((tx) => tx.memberId === m.id);
                  let mG = 0;
                  let mR = 0;
                  mAll.forEach((t) => {
                    if (t.transactionType === 'Member Credit') mG += t.amount;
                    else mR += t.amount;
                  });
                  const mOut = Math.max(0, mG - mR);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.role ? `(${m.role})` : ''} — {mOut > 0 ? `Due: ${formatINR(mOut)}` : 'Cleared'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Action Buttons: PDF, WhatsApp, Add Credit */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="py-2 px-3 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download Official PDF Statement"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.2px]" />
                <span>PDF Statement</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy or Send via WhatsApp"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 stroke-[2.2px]" />}
                <span>{copied ? 'Copied' : 'Share WhatsApp'}</span>
              </button>
            </div>
          </div>

          {/* Member Card Summary */}
          {currentMember && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="p-3 bg-[#0B1323] rounded-2xl border border-amber-900/40">
                <span className="text-[10px] font-bold text-amber-400 block uppercase">Total Given</span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono-num">
                  {formatINR(totalGiven)}
                </span>
                <span className="text-[9.5px] text-slate-500 block">Outflow from balance</span>
              </div>

              <div className="p-3 bg-[#0B1323] rounded-2xl border border-emerald-900/40">
                <span className="text-[10px] font-bold text-emerald-400 block uppercase">Total Repaid</span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono-num">
                  {formatINR(totalRepaid)}
                </span>
                <span className="text-[9.5px] text-slate-500 block">Returned to balance</span>
              </div>

              <div className="p-3 bg-[#0B1323] rounded-2xl border border-slate-800">
                <span className="text-[10px] font-bold text-rose-400 block uppercase">Current Due</span>
                <span
                  className={`text-sm sm:text-base font-extrabold font-mono-num ${
                    netOutstanding > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {formatINR(netOutstanding)}
                </span>
                <span className="text-[9.5px] text-slate-500 block">
                  {netOutstanding > 0 ? 'Pending return' : '100% Cleared'}
                </span>
              </div>

              <div className="p-3 bg-[#0B1323] rounded-2xl border border-slate-800 flex flex-col justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenCreditModal('give_credit', currentMember.id)}
                  className="w-full py-1 px-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Give Credit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCreditModal('repayment', currentMember.id)}
                  className="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-colors"
                >
                  <ArrowDownLeft className="w-3 h-3" />
                  <span>+ Record Repay</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Statement Table Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#0D1527]">
          <div className="flex items-center justify-between text-xs text-slate-300 font-bold px-1">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Statement Entries ({creditRows.length})
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Click Edit or Delete to modify any entry
            </span>
          </div>

          {creditRows.length === 0 ? (
            <div className="p-8 text-center bg-[#111A2E] rounded-2xl border border-slate-800 text-slate-400 space-y-2">
              <Coins className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-slate-300">
                No credit transactions found for {currentMember?.name}
              </p>
              <p className="text-xs text-slate-500">
                Use the "+ Give Credit" button above to record an advance from group balance
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {creditRows.map(({ tx, isGiven, runningDue }, idx) => (
                <div
                  key={tx.transactionId}
                  className="p-3.5 bg-[#111A2E] hover:bg-[#15233E] border border-slate-800/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        isGiven
                          ? 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                          : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                      }`}
                    >
                      {isGiven ? (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.4px]" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 stroke-[2.4px]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-800/60">
                          {tx.transactionId}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isGiven
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {isGiven ? 'Credit Disbursed' : 'Repayment Received'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(tx.date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                        <span className="uppercase font-mono text-slate-300 flex items-center gap-1">
                          {tx.paymentMethod === 'cash' ? <Wallet className="w-3 h-3 text-amber-400" /> : <Building2 className="w-3 h-3 text-cyan-400" />}
                          {tx.paymentMethod || 'bank'}
                        </span>
                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-300 truncate max-w-[280px]">
                              {tx.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-left sm:text-right">
                      <p
                        className={`text-sm sm:text-base font-extrabold font-mono-num ${
                          isGiven ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {isGiven ? '-' : '+'}
                        {formatINR(tx.amount)}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono-num block">
                        Due Bal: <strong className="text-slate-200">{formatINR(runningDue)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenCreditModal(isGiven ? 'give_credit' : 'repayment', currentMember?.id, tx)}
                        className="p-2 bg-[#1A2846] hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-700/50 hover:border-blue-500 rounded-xl transition-all cursor-pointer"
                        title="Edit this entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setTxToDelete(tx)}
                        className="p-2 bg-[#1A2846] hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-700/50 hover:border-rose-500 rounded-xl transition-all cursor-pointer"
                        title="Delete this entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete Confirmation Popup */}
        {txToDelete && (
          <div className="p-4 bg-rose-950/90 border-t border-rose-800 animate-in fade-in duration-150">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white">
                  Delete Credit Entry ({txToDelete.transactionId})?
                </h4>
                <p className="text-[11px] text-rose-200 mt-0.5">
                  Are you sure you want to permanently delete this {txToDelete.transactionType} entry of{' '}
                  <strong className="text-white">{formatINR(txToDelete.amount)}</strong>? Group treasury balance and member credit records will recalculate immediately.
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    type="button"
                    onClick={() => setTxToDelete(null)}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    Yes, Delete Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-[#0F182C] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>IFO Treasury • Member Credit Statement</span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
          >
            Close Statement
          </button>
        </div>
      </div>
    </div>
  );
};
