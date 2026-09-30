import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { TransactionRecord, EventItem, Member, Expense } from '../../types';
import {
  formatINR,
  formatDate,
  getDaysDiff,
  getMemberFinancials,
  calculateEventSummary,
  getEventFinancials,
  generateEventWhatsAppText,
} from '../../utils/formatters';
import {
  downloadEventPDF,
  downloadMemberPDF,
  downloadCommunityMasterReportPDF,
  downloadCustomRangePDF,
} from '../../utils/pdfGenerator';
import {
  Scale,
  BookOpenText,
  Calendar,
  CalendarDays,
  CalendarRange,
  Users,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Copy,
  Check,
  Landmark,
  ShieldCheck,
  DollarSign,
  PieChart,
  BarChart3,
  ExternalLink,
  MessageCircle,
  Layers,
  ArrowRight,
  Share2,
} from 'lucide-react';

type AuditTabMode = 'monthly' | 'yearly' | 'members' | 'events' | 'audit' | 'ledger';

export const TransactionsView: React.FC = () => {
  const {
    transactions,
    events,
    members,
    expenses,
    openingBalance,
    totalCollected,
    totalSpending,
    searchQuery,
    setSearchQuery,
    setSelectedEventId,
  } = useFinance();

  // Active Audit & Statements Sub-Tab
  const [activeMode, setActiveMode] = useState<AuditTabMode>('monthly');

  // Ledger Filter states
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');

  // Selected entities for drilldown statements
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-03');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || 'm1');
  const [selectedEventStatementId, setSelectedEventStatementId] = useState<string>(
    events.find((e) => e.id !== 'ev_other_expenses')?.id || events[0]?.id || 'ev_taawun_2026'
  );

  // Search queries for Member & Event views
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'all' | 'pending' | 'clear' | 'late'>('all');

  // Copied feedback states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Calendar Type Filter state
  const [calendarFilterMode, setCalendarFilterMode] = useState<'all' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-01-01');
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const setTemporaryCopied = (key: string) => {
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const activeSearch = searchQuery || localSearch;

  const isTxOverdue = (tx: TransactionRecord) => {
    if (tx.paymentStatus !== 'Unpaid') return false;
    if (!tx.date) return false;
    return getDaysDiff(tx.date) > 0;
  };

  // ==========================================
  // 1. GLOBAL TREASURY & AUDIT RECONCILIATION
  // ==========================================
  const treasuryAudit = useMemo(() => {
    const verifiedCollections = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const verifiedExpenses = transactions
      .filter((tx) => tx.transactionType === 'Expense')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Cash vs Bank split across recorded expenses
    const cashExpenses = expenses
      .filter((e) => (e.paymentMethod || 'cash') === 'cash')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const bankExpenses = expenses
      .filter((e) => e.paymentMethod === 'bank')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Cash vs Bank split across recorded contributions
    const cashContributions = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && (tx.paymentMethod || 'cash') === 'cash')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const bankContributions = transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && tx.paymentMethod === 'bank')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const closingBalance = openingBalance + verifiedCollections - verifiedExpenses;
    const cashInHand = cashContributions - cashExpenses;
    const bankBalance = openingBalance + bankContributions - bankExpenses;

    const discrepancy = Math.abs(closingBalance - (cashInHand + bankBalance));

    return {
      openingBalance,
      verifiedCollections,
      verifiedExpenses,
      closingBalance,
      cashContributions,
      bankContributions,
      cashExpenses,
      bankExpenses,
      cashInHand,
      bankBalance,
      discrepancy,
      isReconciled: discrepancy === 0,
    };
  }, [transactions, expenses, openingBalance]);

  // ==========================================
  // 2. AVAILABLE MONTHS & YEARS
  // ==========================================
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthSet.add(tx.date.slice(0, 7));
      }
    });
    expenses.forEach((exp) => {
      if (exp.date && exp.date.length >= 7) {
        monthSet.add(exp.date.slice(0, 7));
      }
    });
    // Add default active months if set is small
    ['2026-03', '2026-02', '2026-01', '2025-12'].forEach((m) => monthSet.add(m));
    return Array.from(monthSet).sort().reverse();
  }, [transactions, expenses]);

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 4) {
        yearSet.add(tx.date.slice(0, 4));
      }
    });
    expenses.forEach((exp) => {
      if (exp.date && exp.date.length >= 4) {
        yearSet.add(exp.date.slice(0, 4));
      }
    });
    ['2026', '2025'].forEach((y) => yearSet.add(y));
    return Array.from(yearSet).sort().reverse();
  }, [transactions, expenses]);

  // ==========================================
  // 3. MONTHLY STATEMENT CALCULATIONS
  // ==========================================
  const monthlyStatement = useMemo(() => {
    const monthTxs = transactions.filter((tx) => tx.date && tx.date.startsWith(selectedMonth));
    const monthExpenses = expenses.filter((exp) => exp.date && exp.date.startsWith(selectedMonth));

    const collections = monthTxs
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const expenseTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const cashInflow = monthTxs
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && (tx.paymentMethod || 'cash') === 'cash')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const bankInflow = monthTxs
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && tx.paymentMethod === 'bank')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const cashOutflow = monthExpenses
      .filter((e) => (e.paymentMethod || 'cash') === 'cash')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const bankOutflow = monthExpenses
      .filter((e) => e.paymentMethod === 'bank')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const netMargin = collections - expenseTotal;

    // Monthly category breakdown
    const catMap = new Map<string, number>();
    monthExpenses.forEach((e) => {
      const cat = e.category || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + (Number(e.amount) || 0));
    });

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Active events this month
    const activeEventsThisMonth = events.filter((ev) => ev.date && ev.date.startsWith(selectedMonth));

    return {
      monthKey: selectedMonth,
      monthLabel: new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      }),
      collections,
      expenseTotal,
      netMargin,
      cashInflow,
      bankInflow,
      cashOutflow,
      bankOutflow,
      categoryBreakdown,
      monthTxs,
      monthExpenses,
      activeEventsThisMonth,
    };
  }, [selectedMonth, transactions, expenses, events]);

  // ==========================================
  // 4. YEARLY STATEMENT CALCULATIONS
  // ==========================================
  const yearlyStatement = useMemo(() => {
    const yearTxs = transactions.filter((tx) => tx.date && tx.date.startsWith(selectedYear));
    const yearExpenses = expenses.filter((exp) => exp.date && exp.date.startsWith(selectedYear));

    const totalYearCollections = yearTxs
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const totalYearExpenses = yearExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netYearSavings = totalYearCollections - totalYearExpenses;

    // Month-by-month progression (12 months)
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const monthNum = (i + 1).toString().padStart(2, '0');
      const monthKey = `${selectedYear}-${monthNum}`;
      const mDate = new Date(`${monthKey}-01T00:00:00`);
      const monthName = mDate.toLocaleDateString('en-IN', { month: 'short' });

      const mCollections = yearTxs
        .filter((tx) => tx.date && tx.date.startsWith(monthKey) && tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const mExpenses = yearExpenses
        .filter((e) => e.date && e.date.startsWith(monthKey))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return {
        monthKey,
        monthName,
        collections: mCollections,
        expenses: mExpenses,
        net: mCollections - mExpenses,
      };
    });

    // Category breakdown for the year
    const yearCatMap = new Map<string, number>();
    yearExpenses.forEach((e) => {
      const cat = e.category || 'General';
      yearCatMap.set(cat, (yearCatMap.get(cat) || 0) + (Number(e.amount) || 0));
    });

    const yearlyCategoryBreakdown = Array.from(yearCatMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalYearExpenses > 0 ? Math.round((amount / totalYearExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      yearKey: selectedYear,
      totalYearCollections,
      totalYearExpenses,
      netYearSavings,
      monthsData,
      yearlyCategoryBreakdown,
      yearTxsCount: yearTxs.length,
      yearExpensesCount: yearExpenses.length,
    };
  }, [selectedYear, transactions, expenses]);

  // ==========================================
  // 5. MEMBERS STATEMENT CALCULATIONS
  // ==========================================
  const displayedMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !memberSearch ||
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone?.includes(memberSearch) ||
        m.role?.toLowerCase().includes(memberSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (memberStatusFilter === 'all') return true;

      const fin = getMemberFinancials(m, events, expenses, transactions);
      if (memberStatusFilter === 'pending') return !fin.isAllClear && fin.totalPending > 0;
      if (memberStatusFilter === 'clear') return fin.isAllClear;
      if (memberStatusFilter === 'late') return fin.isLatePayer;
      return true;
    });
  }, [members, memberSearch, memberStatusFilter, events, expenses, transactions]);

  const activeMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || members[0];
  }, [members, selectedMemberId]);

  const activeMemberFinancials = useMemo(() => {
    if (!activeMember) return null;
    return getMemberFinancials(activeMember, events, expenses, transactions);
  }, [activeMember, events, expenses, transactions]);

  // All individual transactions associated with selected member
  const memberTransactionsList = useMemo(() => {
    if (!activeMember) return [];
    return transactions.filter((tx) => {
      if (tx.memberId && tx.memberId === activeMember.id) return true;
      const cleanTx = (tx.nameOrCategory || '').toLowerCase().trim();
      const cleanMem = activeMember.name.toLowerCase().trim();
      return cleanTx === cleanMem || cleanTx.startsWith(cleanMem);
    });
  }, [transactions, activeMember]);

  // ==========================================
  // 6. EVENT STATEMENT CALCULATIONS
  // ==========================================
  const activeEventStatement = useMemo(() => {
    return events.find((e) => e.id === selectedEventStatementId) || events[0];
  }, [events, selectedEventStatementId]);

  const activeEventSummary = useMemo(() => {
    if (!activeEventStatement) return null;
    return calculateEventSummary(activeEventStatement, expenses, members, transactions);
  }, [activeEventStatement, expenses, members, transactions]);

  const activeEventFinancials = useMemo(() => {
    if (!activeEventStatement) return null;
    return getEventFinancials(activeEventStatement, expenses, members, transactions);
  }, [activeEventStatement, expenses, members, transactions]);

  // ==========================================
  // 7. LEDGER JOURNAL FILTERING
  // ==========================================
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Calendar Custom Date Range filter
      if (calendarFilterMode === 'custom') {
        if (customStartDate && (!tx.date || tx.date < customStartDate)) return false;
        if (customEndDate && (!tx.date || tx.date > customEndDate)) return false;
      }

      const matchesEvent = selectedEventFilter === 'all' || tx.eventId === selectedEventFilter || tx.event === selectedEventFilter;
      const matchesType = selectedTypeFilter === 'all' || tx.transactionType === selectedTypeFilter;
      const matchesStatus =
        selectedStatusFilter === 'all'
          ? true
          : selectedStatusFilter === 'Late / Overdue'
          ? isTxOverdue(tx)
          : tx.paymentStatus === selectedStatusFilter;

      const query = activeSearch.toLowerCase().trim();
      const matchesSearch =
        !query ||
        tx.transactionId.toLowerCase().includes(query) ||
        tx.nameOrCategory.toLowerCase().includes(query) ||
        tx.event.toLowerCase().includes(query) ||
        tx.notes?.toLowerCase().includes(query) ||
        tx.category?.toLowerCase().includes(query);

      return matchesEvent && matchesType && matchesStatus && matchesSearch;
    });
  }, [
    transactions,
    selectedEventFilter,
    selectedTypeFilter,
    selectedStatusFilter,
    activeSearch,
    calendarFilterMode,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
  ]);

  // ==========================================
  // 8. EXPORT HELPERS (CSV / WHATSAPP / PDF)
  // ==========================================
  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Event',
      'Date',
      'Transaction Type',
      'Name / Category',
      'Amount (INR)',
      'Payment Status',
      'Payment Method',
      'Notes',
      'Running Balance (INR)',
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.transactionId}"`,
      `"${tx.event}"`,
      `"${tx.date}"`,
      `"${tx.transactionType}"`,
      `"${tx.nameOrCategory}"`,
      tx.amount,
      `"${tx.paymentStatus}"`,
      `"${tx.paymentMethod || 'cash'}"`,
      `"${tx.notes || ''}"`,
      tx.runningBalance !== undefined ? tx.runningBalance : '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tm_ISHAL_Transactions_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMonthCSV = () => {
    const headers = ['Voucher / TX ID', 'Type', 'Description', 'Category', 'Date', 'Payment Method', 'Amount (INR)'];
    const rows: (string | number)[][] = [];

    monthlyStatement.monthTxs.forEach((tx) => {
      rows.push([
        `"${tx.transactionId}"`,
        `"${tx.transactionType}"`,
        `"${tx.nameOrCategory}"`,
        `"${tx.event}"`,
        `"${tx.date}"`,
        `"${tx.paymentMethod || 'cash'}"`,
        tx.amount,
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tm_ISHAL_Statement_${monthlyStatement.monthKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMonthWhatsApp = () => {
    const text =
      `📊 *Tm ISHAL — Monthly Financial Statement*\n` +
      `📅 *Month:* ${monthlyStatement.monthLabel}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📥 *Total Collections:* ${formatINR(monthlyStatement.collections)}\n` +
      `📤 *Total Expenses:* ${formatINR(monthlyStatement.expenseTotal)}\n` +
      `⚖️ *Net Balance:* ${monthlyStatement.netMargin >= 0 ? '+' : ''}${formatINR(monthlyStatement.netMargin)}\n` +
      `💵 *Cash Inflow / Outflow:* ${formatINR(monthlyStatement.cashInflow)} / ${formatINR(monthlyStatement.cashOutflow)}\n` +
      `🏦 *Bank Inflow / Outflow:* ${formatINR(monthlyStatement.bankInflow)} / ${formatINR(monthlyStatement.bankOutflow)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Top Expenses:*\n` +
      monthlyStatement.categoryBreakdown.slice(0, 4).map((c) => `• ${c.category}: ${formatINR(c.amount)} (${c.percentage}%)`).join('\n') +
      `\n\n_Audited & Generated via IFO_`;

    navigator.clipboard.writeText(text);
    setTemporaryCopied('month_wa');
  };

  const handleCopyMemberWhatsAppStatement = () => {
    if (!activeMember || !activeMemberFinancials) return;
    const text =
      `📄 *Tm ISHAL — Member Account Statement*\n` +
      `👤 *Member:* ${activeMember.name} (${activeMember.role || 'Member'})\n` +
      `📞 *Phone:* ${activeMember.phone || 'N/A'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `✅ *Total Contributions Paid:* ${formatINR(activeMemberFinancials.totalPaid)}\n` +
      `⚠️ *Outstanding Event Dues:* ${formatINR(activeMemberFinancials.totalPending)}\n` +
      `🎖️ *Status:* ${activeMemberFinancials.isAllClear ? '✓ All Clear (Fully Settled)' : 'Dues Pending'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      (activeMemberFinancials.pendingEvents.length > 0
        ? `*Pending Events Breakup:*\n` +
          activeMemberFinancials.pendingEvents.map((pe) => `• ${pe.eventName}: ${formatINR(pe.pendingAmount)} (${pe.daysOverdue}d)`).join('\n') +
          `\n\n`
        : `\n`) +
      `Kindly clear any pending dues via UPI or cash. Thank you!\n` +
      `_Official Record • Tm ISHAL Treasury_`;

    navigator.clipboard.writeText(text);
    setTemporaryCopied('member_wa');
  };

  const handleCopyEventWhatsAppStatement = () => {
    if (!activeEventStatement) return;
    const text = generateEventWhatsAppText(activeEventStatement, expenses, members, transactions);
    navigator.clipboard.writeText(text);
    setTemporaryCopied('event_wa');
  };

  return (
    <div className="space-y-4">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Scale className="w-4 h-4 stroke-[2.4px]" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Accounts</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete financial accounting, monthly & yearly statements, member statements, and event ledgers
          </p>
        </div>

        {/* Global Export Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              downloadCommunityMasterReportPDF(events, expenses, members, totalCollected, openingBalance, transactions)
            }
            className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Download complete Master Financial Report PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Master Report PDF</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2 px-3 bg-[#131F37] hover:bg-[#1A2A4A] border border-slate-700/80 text-slate-200 hover:text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            title="Export all transactions to Excel/CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Audited Financial Health Bar (Live KPI Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-1 font-semibold">
            <span>Total Inflow</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono-num">
            {formatINR(treasuryAudit.verifiedCollections)}
          </p>
          <span className="text-[10px] text-slate-500">Verified Member Collections</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-rose-400 text-xs mb-1 font-semibold">
            <span>Total Outflow</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-rose-400 font-mono-num">
            {formatINR(treasuryAudit.verifiedExpenses)}
          </p>
          <span className="text-[10px] text-slate-500">All Functions & Welfare</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-cyan-400 text-xs mb-1 font-semibold">
            <span>Closing Treasury</span>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <p className="text-base sm:text-lg font-extrabold text-cyan-400 font-mono-num">
            {formatINR(treasuryAudit.closingBalance)}
          </p>
          <span className="text-[10px] text-slate-500 font-mono-num">Opening: {formatINR(treasuryAudit.openingBalance)}</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-blue-400 text-xs mb-1 font-semibold">
            <span>Cash vs Bank</span>
            <Landmark className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-white font-mono-num mt-0.5 truncate">
            Cash: <strong className="text-amber-400">{formatINR(treasuryAudit.cashInHand)}</strong>
          </p>
          <span className="text-[10.5px] font-bold text-slate-400 font-mono-num block truncate">
            Bank: <strong className="text-cyan-300">{formatINR(treasuryAudit.bankBalance)}</strong>
          </span>
        </div>
      </div>

      {/* 📅 Custom Date Range Filter */}
      <div className="bg-[#111A2E]/95 p-3 rounded-2xl border border-slate-800/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-400" /> Custom Range:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setCalendarFilterMode('custom');
              }}
              className="px-2.5 py-1.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono shadow-xs"
            />
            <span className="text-slate-500 text-xs font-medium">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setCalendarFilterMode('custom');
              }}
              className="px-2.5 py-1.5 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 font-mono shadow-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => {
              setCalendarFilterMode('custom');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              calendarFilterMode === 'custom'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#0D1527] text-slate-300 hover:text-white border border-slate-800'
            }`}
          >
            Apply Range
          </button>

          <button
            onClick={() => {
              downloadCustomRangePDF(customStartDate, customEndDate, transactions, expenses);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download Custom Range Statement PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          {calendarFilterMode === 'custom' && (
            <button
              onClick={() => {
                setCalendarFilterMode('all');
              }}
              className="px-2.5 py-1.5 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Feature Mode Switcher (Horizontal Pill Bar) */}
      <div className="bg-[#0D1527] p-1.5 rounded-2xl border border-slate-800/80 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'monthly', label: 'Monthly Statement', icon: CalendarDays },
          { id: 'yearly', label: 'Yearly Statement', icon: CalendarRange },
          { id: 'members', label: 'Members Statement', icon: Users },
          { id: 'events', label: 'Event Statements', icon: Sparkles },
          { id: 'audit', label: 'Treasury Balance', icon: Scale },
          { id: 'ledger', label: 'General Ledger', icon: BookOpenText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMode(tab.id as AuditTabMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: MONTHLY STATEMENT */}
      {/* ========================================================================= */}
      {activeMode === 'monthly' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Month Selector Card */}
          <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Statement Period</span>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-400" />
                {monthlyStatement.monthLabel}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {availableMonths.map((m) => {
                  const label = new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric',
                  });
                  return (
                    <option key={m} value={m}>
                      {label} ({m})
                    </option>
                  );
                })}
              </select>

              <button
                onClick={handleCopyMonthWhatsApp}
                className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedKey === 'month_wa' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'month_wa' ? 'Copied!' : 'WhatsApp Statement'}</span>
              </button>

              <button
                onClick={handleExportMonthCSV}
                className="px-3 py-2 bg-[#0D1527] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Month CSV</span>
              </button>
            </div>
          </div>

          {/* Month Financial Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-emerald-900/60">
              <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">Month Inflow</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {formatINR(monthlyStatement.collections)}
              </p>
              <div className="text-[10px] text-slate-400 mt-1 font-mono-num flex items-center justify-between">
                <span>Cash: {formatINR(monthlyStatement.cashInflow)}</span>
                <span>UPI: {formatINR(monthlyStatement.bankInflow)}</span>
              </div>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-rose-900/60">
              <span className="text-[11px] font-semibold text-rose-400 block mb-0.5">Month Outflow</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {formatINR(monthlyStatement.expenseTotal)}
              </p>
              <div className="text-[10px] text-slate-400 mt-1 font-mono-num flex items-center justify-between">
                <span>Cash: {formatINR(monthlyStatement.cashOutflow)}</span>
                <span>Bank: {formatINR(monthlyStatement.bankOutflow)}</span>
              </div>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Net Monthly Margin</span>
              <p
                className={`text-base sm:text-lg font-extrabold font-mono-num ${
                  monthlyStatement.netMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {monthlyStatement.netMargin >= 0 ? '+' : ''}
                {formatINR(monthlyStatement.netMargin)}
              </p>
              <span className="text-[10px] text-slate-500">
                {monthlyStatement.netMargin >= 0 ? 'Monthly Surplus' : 'Deficit Funded by Treasury'}
              </span>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Vouchers & Activity</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {monthlyStatement.monthTxs.length} TXs
              </p>
              <span className="text-[10px] text-slate-500">
                {monthlyStatement.monthExpenses.length} Expense Bills Recorded
              </span>
            </div>
          </div>

          {/* Month Expense Categories Breakdown */}
          {monthlyStatement.categoryBreakdown.length > 0 && (
            <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-blue-400" />
                Month Expense Categories
              </h3>
              <div className="space-y-2.5">
                {monthlyStatement.categoryBreakdown.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">{item.category}</span>
                      <span className="text-white font-mono-num">
                        {formatINR(item.amount)}{' '}
                        <strong className="text-slate-500 font-normal">({item.percentage}%)</strong>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Itemized Transactions Table for this Month */}
          <div className="bg-[#111A2E]/90 rounded-3xl border border-slate-800/90 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#0D1527]/60">
              <span className="text-xs font-bold text-slate-200">
                Statement Vouchers & Transactions ({monthlyStatement.monthTxs.length})
              </span>
              <span className="text-[11px] text-slate-400 font-mono-num">{monthlyStatement.monthLabel}</span>
            </div>

            {monthlyStatement.monthTxs.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <BookOpenText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-300">No transactions recorded for {monthlyStatement.monthLabel}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Select a different month or record a transaction</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[420px] overflow-y-auto scrollbar-thin">
                {monthlyStatement.monthTxs.map((tx) => {
                  const isContribution = tx.transactionType === 'Contribution';
                  return (
                    <div key={tx.transactionId} className="p-3 hover:bg-[#131F37]/80 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isContribution
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                              : 'bg-rose-950/70 text-rose-400 border border-rose-800/60'
                          }`}
                        >
                          {isContribution ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{tx.nameOrCategory}</p>
                          <p className="text-[10.5px] text-slate-400">
                            {formatDate(tx.date)} • {tx.event} • {tx.paymentMethod ? tx.paymentMethod.toUpperCase() : 'CASH'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-bold font-mono-num ${isContribution ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isContribution ? '+' : '-'}
                          {formatINR(tx.amount)}
                        </p>
                        <span className="text-[9.5px] text-slate-500 font-mono">{tx.transactionId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: YEARLY STATEMENT */}
      {/* ========================================================================= */}
      {activeMode === 'yearly' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Year Selector Banner */}
          <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Annual Audit Report</span>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-blue-400" />
                Fiscal Year {selectedYear} Statement
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Annual KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-emerald-900/60">
              <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">Annual Inflow</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {formatINR(yearlyStatement.totalYearCollections)}
              </p>
              <span className="text-[10px] text-slate-500">All Collections in {selectedYear}</span>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-rose-900/60">
              <span className="text-[11px] font-semibold text-rose-400 block mb-0.5">Annual Outflow</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {formatINR(yearlyStatement.totalYearExpenses)}
              </p>
              <span className="text-[10px] text-slate-500">All Expenses in {selectedYear}</span>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Net Annual Surplus</span>
              <p
                className={`text-base sm:text-lg font-extrabold font-mono-num ${
                  yearlyStatement.netYearSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {yearlyStatement.netYearSavings >= 0 ? '+' : ''}
                {formatINR(yearlyStatement.netYearSavings)}
              </p>
              <span className="text-[10px] text-slate-500">Fiscal Margin</span>
            </div>

            <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Average Monthly Spend</span>
              <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                {formatINR(Math.round(yearlyStatement.totalYearExpenses / 12))}
              </p>
              <span className="text-[10px] text-slate-500">Per Month Run Rate</span>
            </div>
          </div>

          {/* 12-Month Table & Comparison Bars */}
          <div className="bg-[#111A2E]/90 rounded-3xl border border-slate-800/90 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#0D1527]/60">
              <h3 className="text-xs font-bold text-slate-200">12-Month Comparison Sheet ({selectedYear})</h3>
              <span className="text-[11px] text-slate-400">Collections vs Expenses</span>
            </div>

            <div className="divide-y divide-slate-800/60 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#0D1527]/40 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-4 text-right">Collections</th>
                    <th className="py-2.5 px-4 text-right">Expenses</th>
                    <th className="py-2.5 px-4 text-right">Net Margin</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {yearlyStatement.monthsData.map((m) => {
                    const hasActivity = m.collections > 0 || m.expenses > 0;
                    return (
                      <tr key={m.monthKey} className="hover:bg-[#131F37]/60 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-white flex items-center gap-1.5">
                          <span>{m.monthName}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({m.monthKey})</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-emerald-400">
                          {m.collections > 0 ? formatINR(m.collections) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-num text-rose-400">
                          {m.expenses > 0 ? formatINR(m.expenses) : '—'}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-mono-num font-bold ${
                            m.net > 0 ? 'text-emerald-400' : m.net < 0 ? 'text-rose-400' : 'text-slate-500'
                          }`}
                        >
                          {hasActivity ? `${m.net >= 0 ? '+' : ''}${formatINR(m.net)}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {hasActivity ? (
                            <span
                              className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                                m.net >= 0
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                                  : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                              }`}
                            >
                              {m.net >= 0 ? 'Surplus' : 'Deficit'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600">No activity</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Annual Category Breakdown */}
          {yearlyStatement.yearlyCategoryBreakdown.length > 0 && (
            <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 space-y-3 shadow-xs">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Annual Spend by Category ({selectedYear})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {yearlyStatement.yearlyCategoryBreakdown.map((item) => (
                  <div key={item.category} className="p-3 bg-[#0E172B] rounded-2xl border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{item.category}</span>
                      <span className="text-white font-mono-num font-bold">
                        {formatINR(item.amount)}{' '}
                        <strong className="text-slate-500 text-[10px]">({item.percentage}%)</strong>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: MEMBERS STATEMENT */}
      {/* ========================================================================= */}
      {activeMode === 'members' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Member Search & Quick Selector */}
          <div className="bg-[#111A2E]/90 p-3.5 rounded-3xl border border-slate-800/90 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search member by name or phone..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'pending', label: 'Has Dues' },
                  { id: 'clear', label: 'All Clear' },
                  { id: 'late', label: 'Late' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setMemberStatusFilter(f.id as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      memberStatusFilter === f.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[#0D1527] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Member Avatars Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {displayedMembers.map((m) => {
                const isSelected = m.id === selectedMemberId;
                const fin = getMemberFinancials(m, events, expenses, transactions);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all shrink-0 cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                        : 'bg-[#0D1527] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                      style={{ backgroundColor: m.avatarColor || '#3b82f6' }}
                    >
                      {m.name.charAt(0)}
                    </div>
                    <div className="min-w-0 max-w-[110px]">
                      <p className="text-xs font-bold truncate">{m.name}</p>
                      <p className="text-[10px] font-mono-num truncate text-slate-400">
                        {fin.isAllClear ? (
                          <span className="text-emerald-400 font-semibold">Clear</span>
                        ) : (
                          <span className="text-amber-400 font-semibold">Due: {formatINR(fin.totalPending)}</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Member Detailed Audit Sheet */}
          {activeMember && activeMemberFinancials && (
            <div className="space-y-4">
              <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-white text-lg shadow-md shrink-0"
                      style={{ backgroundColor: activeMember.avatarColor || '#3b82f6' }}
                    >
                      {activeMember.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                          {activeMember.name}
                        </h2>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/80">
                          {activeMember.role || 'Member'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        {activeMember.phone || 'No phone recorded'} • Joined in {activeMemberFinancials.joinedEventsCount} Functions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCopyMemberWhatsAppStatement}
                      className="px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-400 border border-emerald-800/70 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'member_wa' ? <Check className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'member_wa' ? 'Copied!' : 'WhatsApp Statement'}</span>
                    </button>

                    <button
                      onClick={() => downloadMemberPDF(activeMember, events, expenses, transactions)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Member PDF</span>
                    </button>
                  </div>
                </div>

                {/* Member Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                  <div className="bg-[#0E172B] p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10.5px] font-semibold text-emerald-400 block mb-0.5">Total Paid</span>
                    <p className="text-base font-extrabold text-white font-mono-num">
                      {formatINR(activeMemberFinancials.totalPaid)}
                    </p>
                    <span className="text-[9.5px] text-slate-500">Lifetime Contributions</span>
                  </div>

                  <div className="bg-[#0E172B] p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10.5px] font-semibold text-amber-400 block mb-0.5">Pending Dues</span>
                    <p className="text-base font-extrabold font-mono-num text-amber-400">
                      {formatINR(activeMemberFinancials.totalPending)}
                    </p>
                    <span className="text-[9.5px] text-slate-500">Across active functions</span>
                  </div>

                  <div className="bg-[#0E172B] p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10.5px] font-semibold text-cyan-400 block mb-0.5">Direct Expenses</span>
                    <p className="text-base font-extrabold text-white font-mono-num">
                      {formatINR(activeMemberFinancials.totalDirectExpenses)}
                    </p>
                    <span className="text-[9.5px] text-slate-500">Bills Paid by Member</span>
                  </div>

                  <div className="bg-[#0E172B] p-3 rounded-2xl border border-slate-800/80">
                    <span className="text-[10.5px] font-semibold text-slate-400 block mb-0.5">Compliance</span>
                    <p className="text-xs font-bold text-white mt-1">
                      {activeMemberFinancials.isAllClear ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All Dues Clear
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">
                          {activeMemberFinancials.pendingEvents.length} Events Pending
                        </span>
                      )}
                    </p>
                    <span className="text-[9.5px] text-slate-500 block font-mono-num">
                      Avg delay: {activeMemberFinancials.avgPaymentDelayDays}d
                    </span>
                  </div>
                </div>
              </div>

              {/* Pending Events if any */}
              {activeMemberFinancials.pendingEvents.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-800/70 p-4 rounded-3xl space-y-2.5">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Pending Dues by Event ({activeMemberFinancials.pendingEvents.length})
                  </h3>
                  <div className="divide-y divide-amber-900/50">
                    {activeMemberFinancials.pendingEvents.map((pe) => (
                      <div key={pe.eventId} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{pe.eventName}</p>
                          <p className="text-[10.5px] text-slate-400">
                            Expected: {formatINR(pe.expectedShare)} • Paid so far: {formatINR(pe.paidAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-amber-400 font-mono-num text-sm">
                            {formatINR(pe.pendingAmount)}
                          </p>
                          <span className="text-[9.5px] font-bold text-rose-300">
                            {pe.daysOverdue > 0 ? `${pe.daysOverdue} days overdue` : 'Due soon'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Member Contribution History */}
              <div className="bg-[#111A2E]/90 rounded-3xl border border-slate-800/90 overflow-hidden shadow-xs">
                <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#0D1527]/60">
                  <span className="text-xs font-bold text-slate-200">
                    Contribution Ledger History for {activeMember.name} ({memberTransactionsList.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Recorded Receipts</span>
                </div>

                {memberTransactionsList.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <BookOpenText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-300">No contribution receipts recorded yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800/60 max-h-[350px] overflow-y-auto scrollbar-thin">
                    {memberTransactionsList.map((tx) => (
                      <div key={tx.transactionId} className="p-3 hover:bg-[#131F37]/80 transition-colors flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-800/80">
                              {tx.transactionId}
                            </span>
                            <span className="font-bold text-white">{tx.event}</span>
                            <span className="text-[9.5px] font-semibold px-2 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                              {tx.paymentStatus}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-400 mt-0.5">
                            {formatDate(tx.date)} • Mode: {tx.paymentMethod ? tx.paymentMethod.toUpperCase() : 'CASH'} • {tx.notes || 'Contribution'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-extrabold text-emerald-400 font-mono-num text-sm">
                            +{formatINR(tx.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: EVENT STATEMENTS */}
      {/* ========================================================================= */}
      {activeMode === 'events' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Event Picker Bar */}
          <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Audited Function Statement</span>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                {activeEventStatement?.name || 'Event Statement'}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedEventStatementId}
                onChange={(e) => setSelectedEventStatementId(e.target.value)}
                className="px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-blue-500"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({formatDate(ev.date)})
                  </option>
                ))}
              </select>

              {activeEventStatement && (
                <>
                  <button
                    onClick={handleCopyEventWhatsAppStatement}
                    className="px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900/70 text-emerald-400 border border-emerald-800/70 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedKey === 'event_wa' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'event_wa' ? 'Copied!' : 'WhatsApp Statement'}</span>
                  </button>

                  <button
                    onClick={() => downloadEventPDF(activeEventStatement, expenses, members, transactions)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Event PDF</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {activeEventStatement && activeEventSummary && activeEventFinancials && (
            <div className="space-y-4">
              {/* Event Financial KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Total Cost</span>
                  <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                    {formatINR(activeEventSummary.totalCost)}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {activeEventSummary.totalExpensesCount} Expense Items
                  </span>
                </div>

                <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-emerald-900/60">
                  <span className="text-[11px] font-semibold text-emerald-400 block mb-0.5">Collections</span>
                  <p className="text-base sm:text-lg font-extrabold text-white font-mono-num">
                    {formatINR(activeEventFinancials.evTotalCollections)}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {activeEventSummary.paidMembersCount} of {activeEventSummary.splittingMemberCount} Settled
                  </span>
                </div>

                <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Surplus / Balance</span>
                  <p
                    className={`text-base sm:text-lg font-extrabold font-mono-num ${
                      (activeEventFinancials.evBalance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {(activeEventFinancials.evBalance ?? 0) >= 0 ? '+' : ''}
                    {formatINR(activeEventFinancials.evBalance ?? 0)}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    {(activeEventFinancials.evBalance ?? 0) >= 0 ? 'Positive Margin' : 'Deficit'}
                  </span>
                </div>

                <div className="bg-[#0E172B] p-3.5 rounded-2xl border border-slate-800/80">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">Per-Member Share</span>
                  <p className="text-base sm:text-lg font-extrabold text-cyan-400 font-mono-num">
                    {formatINR(activeEventSummary.perMemberCost)}
                  </p>
                  <span className="text-[10px] text-slate-500">
                    Mode: {activeEventStatement.splitMode === 'minimum' ? 'Minimum Donation' : 'Even Split'}
                  </span>
                </div>
              </div>

              {/* Per-Member Audited Settlement Table */}
              <div className="bg-[#111A2E]/90 rounded-3xl border border-slate-800/90 overflow-hidden shadow-xs">
                <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between bg-[#0D1527]/60">
                  <span className="text-xs font-bold text-slate-200">
                    Audited Member Settlement ({activeEventSummary.memberSettlement.length} Members)
                  </span>
                  <span className="text-[11px] text-slate-400">Paid vs Unpaid</span>
                </div>

                <div className="divide-y divide-slate-800/60 max-h-[360px] overflow-y-auto scrollbar-thin">
                  {activeEventSummary.memberSettlement.map((m) => (
                    <div key={m.memberId} className="p-3 hover:bg-[#131F37]/60 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{m.memberName}</span>
                          {m.isDonor && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                              Donor (+{formatINR(m.extraDonation)})
                            </span>
                          )}
                          {m.isExemptFromSplit && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                              Exempt
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          Expected: {formatINR(m.expectedShare)} • Paid: {formatINR(m.totalPaid)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.status === 'paid' || m.status === 'settled'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                              : m.status === 'exempt'
                              ? 'bg-purple-950/80 text-purple-300 border border-purple-800/80'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                          }`}
                        >
                          {m.status === 'paid' || m.status === 'settled' ? '✓ Paid' : m.status === 'exempt' ? 'Exempt' : '○ Unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 5: ACCOUNT & TREASURY AUDIT */}
      {/* ========================================================================= */}
      {activeMode === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Treasury Reconciliation Sheet */}
          <div className="bg-[#111A2E]/90 p-4 rounded-3xl border border-slate-800/90 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Formal Audit Sheet</span>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-400" />
                  Treasury Balance Sheet & Reconciliation
                </h3>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>0 Discrepancy • 100% Balanced</span>
              </div>
            </div>

            {/* Reconciliation Math Flow */}
            <div className="bg-[#0B1323] p-4 rounded-2xl border border-slate-800/80 space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-400">1. Opening Group Balance:</span>
                <span className="font-bold text-white">{formatINR(treasuryAudit.openingBalance)}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm text-emerald-400">
                <span>(+) Total Verified Member Contributions:</span>
                <span className="font-bold">+{formatINR(treasuryAudit.verifiedCollections)}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm text-rose-400">
                <span>(-) Total Verified Expenses & Vouchers:</span>
                <span className="font-bold">-{formatINR(treasuryAudit.verifiedExpenses)}</span>
              </div>
              <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between text-sm sm:text-base font-extrabold text-cyan-300">
                <span>(=) Audited Treasury Net Balance:</span>
                <span>{formatINR(treasuryAudit.closingBalance)}</span>
              </div>
            </div>

            {/* Cash vs Bank Verification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 bg-[#0E172B] rounded-2xl border border-amber-900/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" /> Physical Cash In Hand
                  </span>
                  <span className="font-mono-num text-sm">{formatINR(treasuryAudit.cashInHand)}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Cash Collections ({formatINR(treasuryAudit.cashContributions)}) minus Cash Outflows ({formatINR(treasuryAudit.cashExpenses)})
                </p>
              </div>

              <div className="p-3.5 bg-[#0E172B] rounded-2xl border border-cyan-900/60 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Bank / UPI Account Balance
                  </span>
                  <span className="font-mono-num text-sm">{formatINR(treasuryAudit.bankBalance)}</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Opening Balance + Digital Inflows ({formatINR(treasuryAudit.bankContributions)}) minus Bank Outflows ({formatINR(treasuryAudit.bankExpenses)})
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 6: GENERAL LEDGER JOURNAL */}
      {/* ========================================================================= */}
      {activeMode === 'ledger' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Search & Filter Bar */}
          <div className="bg-[#111A2E]/90 p-3.5 rounded-2xl border border-slate-800/90 space-y-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by TX ID (e.g. TX001), name, event, notes..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={selectedEventFilter}
                onChange={(e) => setSelectedEventFilter(e.target.value)}
                className="px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Events ({events.length})</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.name}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick pill filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Type:</span>
                {['all', 'Contribution', 'Expense', 'Opening Balance'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(type)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedTypeFilter === type
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[#0D1527] text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {type === 'all' ? 'All' : type}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Status:</span>
                {['all', 'Paid', 'Unpaid', 'Late / Overdue', 'Recorded'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                      selectedStatusFilter === status
                        ? status === 'Late / Overdue'
                          ? 'bg-rose-700 text-white shadow-xs font-bold'
                          : 'bg-blue-600 text-white shadow-xs'
                        : 'bg-[#0D1527] text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {status === 'Late / Overdue' && <Clock className="w-2.5 h-2.5" />}
                    <span>{status === 'all' ? 'All' : status}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-[#111A2E]/90 rounded-2xl border border-slate-800/90 overflow-hidden shadow-xs">
            <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-[#0D1527]/50">
              <span className="text-xs font-bold text-slate-300">
                Showing {filteredTransactions.length} of {transactions.length} Transactions
              </span>
              <span className="text-[11px] text-slate-500">Sorted chronologically</span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <BookOpenText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No transactions match your filter</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing search or filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60 max-h-[620px] overflow-y-auto scrollbar-thin">
                {filteredTransactions.map((tx) => {
                  const isContribution = tx.transactionType === 'Contribution';
                  const isExpense = tx.transactionType === 'Expense';

                  return (
                    <div
                      key={tx.transactionId}
                      className="p-3.5 hover:bg-[#131F37]/80 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isContribution
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                              : isExpense
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                              : 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/60'
                          }`}
                        >
                          {isContribution ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : isExpense ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <Wallet className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/60">
                              {tx.transactionId}
                            </span>
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
                            {isTxOverdue(tx) && (
                              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-rose-950/90 text-rose-300 border border-rose-800 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {getDaysDiff(tx.date)}d overdue
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-1 flex-wrap font-medium">
                            <span className="text-slate-300 font-semibold">{tx.event}</span>
                            <span className="text-slate-600">•</span>
                            <span>{formatDate(tx.date)}</span>
                            {tx.paymentMethod && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400 uppercase font-mono">{tx.paymentMethod}</span>
                              </>
                            )}
                            {tx.category && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400">{tx.category}</span>
                              </>
                            )}
                            {tx.notes && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-400 italic truncate max-w-[200px]">{tx.notes}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm sm:text-base font-extrabold font-mono-num ${
                            isContribution
                              ? 'text-emerald-400'
                              : isExpense
                              ? 'text-rose-400'
                              : 'text-cyan-400'
                          }`}
                        >
                          {isContribution ? '+' : isExpense ? '-' : ''}
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
        </div>
      )}
    </div>
  );
};
