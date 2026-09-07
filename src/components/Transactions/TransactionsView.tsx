import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { TransactionRecord, TransactionType, TransactionStatus } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';
import {
  BookOpenText,
  Search,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Wallet,
  Sparkles,
} from 'lucide-react';

export const TransactionsView: React.FC = () => {
  const { transactions, events, searchQuery, setSearchQuery } = useFinance();

  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');

  const activeSearch = searchQuery || localSearch;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesEvent = selectedEventFilter === 'all' || tx.eventId === selectedEventFilter || tx.event === selectedEventFilter;
      const matchesType = selectedTypeFilter === 'all' || tx.transactionType === selectedTypeFilter;
      const matchesStatus = selectedStatusFilter === 'all' || tx.paymentStatus === selectedStatusFilter;
      
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
  }, [transactions, selectedEventFilter, selectedTypeFilter, selectedStatusFilter, activeSearch]);

  // Aggregate stats from transactions
  const stats = useMemo(() => {
    let totalContributions = 0;
    let totalExpenses = 0;
    let totalUnpaid = 0;

    transactions.forEach((tx) => {
      if (tx.transactionType === 'Contribution') {
        if (tx.paymentStatus === 'Paid') {
          totalContributions += tx.amount;
        } else if (tx.paymentStatus === 'Unpaid') {
          totalUnpaid += tx.amount;
        }
      } else if (tx.transactionType === 'Expense') {
        totalExpenses += tx.amount;
      }
    });

    return {
      totalCount: transactions.length,
      totalContributions,
      totalExpenses,
      totalUnpaid,
      netTotal: totalContributions - totalExpenses,
    };
  }, [transactions]);

  // CSV Export function
  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Event',
      'Date',
      'Transaction Type',
      'Name / Category',
      'Amount (INR)',
      'Payment Status',
      'Notes',
      'Running Balance (INR)'
    ];

    const rows = filteredTransactions.map((tx) => [
      `"${tx.transactionId}"`,
      `"${tx.event}"`,
      `"${tx.date}"`,
      `"${tx.transactionType}"`,
      `"${tx.nameOrCategory}"`,
      tx.amount,
      `"${tx.paymentStatus}"`,
      `"${tx.notes || ''}"`,
      tx.runningBalance !== undefined ? tx.runningBalance : ''
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

  return (
    <div className="space-y-4">
      {/* Header with Title & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BookOpenText className="w-5 h-5 text-blue-400" />
            Transactions Ledger
          </h1>
          <p className="text-xs text-slate-400">
            Complete audited record of contributions, expenses & running balances (83 items)
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="py-2.5 px-3.5 bg-[#131F37] hover:bg-[#1A2A4A] border border-slate-700/80 text-blue-300 hover:text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
        >
          <Download className="w-4 h-4 text-blue-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Records</span>
            <BookOpenText className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-base font-extrabold text-white font-mono-num">{transactions.length}</p>
          <span className="text-[10px] text-slate-500">Across 5 events</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
            <span>Contributions</span>
            <ArrowDownLeft className="w-3.5 h-3.5" />
          </div>
          <p className="text-base font-extrabold text-emerald-400 font-mono-num">{formatINR(stats.totalContributions)}</p>
          <span className="text-[10px] text-slate-500">Total member collections</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-rose-400 text-xs mb-1">
            <span>Expenses</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
          <p className="text-base font-extrabold text-rose-400 font-mono-num">{formatINR(stats.totalExpenses)}</p>
          <span className="text-[10px] text-slate-500">Event & welfare costs</span>
        </div>

        <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 shadow-xs">
          <div className="flex items-center justify-between text-cyan-400 text-xs mb-1">
            <span>Taawun Balance</span>
            <Wallet className="w-3.5 h-3.5" />
          </div>
          <p className="text-base font-extrabold text-cyan-400 font-mono-num">₹7,196</p>
          <span className="text-[10px] text-slate-500">TX083 running balance</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#111A2E]/90 p-3 rounded-2xl border border-slate-800/90 space-y-2.5 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by TX ID (e.g. TX001), name, event, notes..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Event Filter dropdown */}
          <select
            value={selectedEventFilter}
            onChange={(e) => setSelectedEventFilter(e.target.value)}
            className="px-3 py-2 bg-[#0D1527] border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Events (5)</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.name}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        {/* Quick pill filters for Type & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-[11px] font-semibold text-slate-400 mr-1">Type:</span>
            {['all', 'Contribution', 'Expense', 'Opening Balance'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
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
            {['all', 'Paid', 'Unpaid', 'Recorded'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatusFilter(status)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  selectedStatusFilter === status
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#0D1527] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List / Ledger Table */}
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
              const isOpeningBalance = tx.transactionType === 'Opening Balance';

              return (
                <div
                  key={tx.transactionId}
                  className="p-3.5 hover:bg-[#131F37]/80 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* TX Badge Icon */}
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
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-1 flex-wrap font-medium">
                        <span className="text-slate-300 font-semibold">{tx.event}</span>
                        <span className="text-slate-600">•</span>
                        <span>{formatDate(tx.date)}</span>
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

                  {/* Amount & Running Balance */}
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
  );
};
