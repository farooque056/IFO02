import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Expense } from '../../types';
import { formatDate, formatINR } from '../../utils/formatters';
import { downloadPettyCashBookPDF } from '../../utils/pdfGenerator';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Filter,
  Trash2,
  Edit2,
  Wallet,
  Coffee,
  Wrench,
  Heart,
  FileText,
  Building,
  Car,
  Zap,
  Package,
  AlertCircle,
  HelpCircle,
  Banknote,
  Landmark,
  ArrowDownCircle,
  CheckCircle2,
} from 'lucide-react';

export const OTHER_EXPENSES_ID = 'ev_other_expenses';

export const PETTY_CASH_CATEGORIES = [
  'General & Maintenance',
  'Tea, Snacks & Refreshments',
  'Charity & Sadqa',
  'Office, Utilities & Rent',
  'Printing & Stationery',
  'Travel & Fuel',
  'Equipment & Supplies',
  'Emergency Assistance',
  'Miscellaneous',
];

interface OtherExpensesViewProps {
  onAddExpense?: (eventId?: string) => void;
  onEditExpense?: (expense: Expense) => void;
}

export const OtherExpensesView: React.FC<OtherExpensesViewProps> = ({
  onAddExpense,
  onEditExpense,
}) => {
  const {
    expenses,
    events,
    members,
    openingBalance,
    netTreasuryBalance,
    requireAuth,
    deleteExpense,
  } = useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<'all' | 'cash' | 'bank'>('all');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Filter expenses belonging to Other Expenses / Petty Cash Book
  const otherExpensesList = useMemo(() => {
    return expenses.filter(
      (exp) =>
        exp.eventId === OTHER_EXPENSES_ID ||
        events.find((e) => e.id === exp.eventId)?.name.trim().toLowerCase() === 'other expenses'
    );
  }, [expenses, events]);

  // Aggregate Totals for Petty Cash Book
  const totalPettyCashSpent = useMemo(() => {
    return otherExpensesList.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [otherExpensesList]);

  const cashPettyCashSpent = useMemo(() => {
    return otherExpensesList
      .filter((exp) => (exp.paymentMethod || 'cash') === 'cash')
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [otherExpensesList]);

  const bankPettyCashSpent = useMemo(() => {
    return otherExpensesList
      .filter((exp) => exp.paymentMethod === 'bank')
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [otherExpensesList]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {};
    otherExpensesList.forEach((exp) => {
      const cat = exp.category || 'Miscellaneous';
      if (!stats[cat]) {
        stats[cat] = { count: 0, total: 0 };
      }
      stats[cat].count += 1;
      stats[cat].total += Number(exp.amount) || 0;
    });
    return stats;
  }, [otherExpensesList]);

  // Filtered & Sorted List
  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result = otherExpensesList.filter((exp) => {
      const matchesCat = selectedCategory === 'all' || exp.category === selectedCategory;
      const matchesMethod = selectedMethod === 'all' || (exp.paymentMethod || 'cash') === selectedMethod;
      const matchesSearch =
        !query ||
        exp.name.toLowerCase().includes(query) ||
        (exp.notes && exp.notes.toLowerCase().includes(query)) ||
        (exp.receiptNo && exp.receiptNo.toLowerCase().includes(query)) ||
        (exp.category && exp.category.toLowerCase().includes(query));

      return matchesCat && matchesMethod && matchesSearch;
    });

    return result.sort((a, b) => {
      if (sortOrder === 'date_desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortOrder === 'date_asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortOrder === 'amount_desc') {
        return Number(b.amount) - Number(a.amount);
      }
      if (sortOrder === 'amount_asc') {
        return Number(a.amount) - Number(b.amount);
      }
      return 0;
    });
  }, [otherExpensesList, searchQuery, selectedCategory, selectedMethod, sortOrder]);

  const handleDeleteConfirmed = () => {
    if (expenseToDelete) {
      requireAuth(() => {
        deleteExpense(expenseToDelete.id);
        setExpenseToDelete(null);
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('tea') || cat.includes('snack') || cat.includes('refreshment') || cat.includes('food')) {
      return <Coffee className="w-4 h-4 text-amber-400" />;
    }
    if (cat.includes('maintenance') || cat.includes('repair') || cat.includes('general')) {
      return <Wrench className="w-4 h-4 text-blue-400" />;
    }
    if (cat.includes('charity') || cat.includes('sadqa') || cat.includes('donation')) {
      return <Heart className="w-4 h-4 text-rose-400" />;
    }
    if (cat.includes('print') || cat.includes('stationery')) {
      return <FileText className="w-4 h-4 text-indigo-400" />;
    }
    if (cat.includes('office') || cat.includes('rent') || cat.includes('utility')) {
      return <Building className="w-4 h-4 text-cyan-400" />;
    }
    if (cat.includes('travel') || cat.includes('fuel') || cat.includes('petrol')) {
      return <Car className="w-4 h-4 text-emerald-400" />;
    }
    if (cat.includes('equipment') || cat.includes('supplies')) {
      return <Package className="w-4 h-4 text-purple-400" />;
    }
    if (cat.includes('emergency')) {
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
    return <Receipt className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-4">
      {/* 1. Explanatory Header & Petty Cash Policy Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#131F37] via-[#0E172A] to-[#0A101D] border border-amber-500/30 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
              <Receipt className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Other Expenses (Petty Cash Book)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-700/60">
                  Zero Member Collection Needed
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                General community operating expenditures funded directly from the treasury balance.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
            <button
              onClick={() =>
                downloadPettyCashBookPDF(otherExpensesList, members, openingBalance, netTreasuryBalance)
              }
              className="flex-1 sm:flex-initial py-2 px-3 bg-[#16233E] hover:bg-[#1E3054] text-slate-200 border border-slate-700/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Download Petty Cash Book Statement PDF"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export PDF</span>
            </button>

            <button
              onClick={() => requireAuth(() => onAddExpense?.(OTHER_EXPENSES_ID))}
              className="flex-1 sm:flex-initial py-2 px-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.8px]" />
              <span>Record Other Expense</span>
            </button>
          </div>
        </div>

        {/* Operating Principle Callout Box */}
        <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200/95 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-0.5">💡</span>
          <div className="space-y-0.5">
            <p className="font-bold text-amber-200 text-xs">
              Direct Balance Disbursement Principle
            </p>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">
              Unlike specific functions (which calculate per-member splits and collect shares), <strong>Other Expenses has no collecting amount</strong>. Every recorded expenditure is directly deducted from the total community fund cash balance (Petty Cash Book).
            </p>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Overview (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Available Treasury Balance (Source) */}
        <div className="p-3.5 rounded-2xl bg-[#0E172A] border border-emerald-900/50 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
              Available Balance
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold">
              Matches Dashboard
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono-num text-emerald-400 tracking-tight">
            {formatINR(netTreasuryBalance)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Matches Dashboard Available Total Balance
          </p>
        </div>

        {/* Card 2: Total Petty Cash Spent */}
        <div className="p-3.5 rounded-2xl bg-[#0E172A] border border-rose-900/50 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" />
              Total Spent
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold">
              {otherExpensesList.length} Vouchers
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono-num text-rose-400 tracking-tight">
            {formatINR(totalPettyCashSpent)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Total non-event petty cash spent to date
          </p>
        </div>

        {/* Card 3: Cash Disbursements */}
        <div className="p-3.5 rounded-2xl bg-[#0E172A] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5 text-amber-400" />
              Cash Outflow
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono-num text-slate-200 tracking-tight">
            {formatINR(cashPettyCashSpent)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Physical hand-to-hand cash payments
          </p>
        </div>

        {/* Card 4: Bank / UPI Disbursements */}
        <div className="p-3.5 rounded-2xl bg-[#0E172A] border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-blue-400" />
              Bank / UPI Outflow
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono-num text-slate-200 tracking-tight">
            {formatINR(bankPettyCashSpent)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Digital online & UPI transfers
          </p>
        </div>
      </div>

      {/* 3. Category Breakdown Pills if expenses exist */}
      {Object.keys(categoryStats).length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#0E172A] border border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>Category Distribution</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono-num">
              {Object.keys(categoryStats).length} categories active
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {Object.entries(categoryStats).map(([cat, data]: [string, { count: number; total: number }]) => {
              const percent = totalPettyCashSpent > 0 ? Math.round((data.total / totalPettyCashSpent) * 100) : 0;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shrink-0 border transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-600/30 border-amber-500 text-amber-200 shadow-xs'
                      : 'bg-[#142038] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  {getCategoryIcon(cat)}
                  <span className="font-medium text-[11px]">{cat}</span>
                  <span className="text-[10px] font-bold font-mono-num px-1.5 py-0.5 rounded-md bg-slate-900/80 text-amber-300">
                    {formatINR(data.total)} ({percent}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Toolbar: Search, Filters & Sort */}
      <div className="bg-[#0E172A] p-3 rounded-2xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by description, receipt #, category, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#142038] border border-slate-800 focus:border-blue-500 focus:outline-hidden text-xs text-white pl-9 pr-3 py-2 rounded-xl placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Payment Method Filter */}
          <div className="flex items-center gap-1 bg-[#142038] p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setSelectedMethod('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedMethod === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setSelectedMethod('cash')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedMethod === 'cash'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => setSelectedMethod('bank')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                selectedMethod === 'bank'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bank / UPI
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="bg-[#142038] border border-slate-800 text-xs text-slate-300 px-2.5 py-2 rounded-xl focus:outline-hidden shrink-0 cursor-pointer"
          >
            <option value="date_desc">Latest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-[#142038] text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Categories ({otherExpensesList.length})
          </button>
          {PETTY_CASH_CATEGORIES.map((cat) => {
            const count = otherExpensesList.filter((e) => e.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-[#142038] text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{cat}</span>
                {count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-amber-300 font-mono-num font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Vouchers Ledger List */}
      {filteredList.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0E172A] border border-slate-800/80 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <Receipt className="w-7 h-7 stroke-[1.8px]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {otherExpensesList.length === 0
                ? 'No Other Expenses Recorded Yet'
                : 'No Matching Expenses Found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {otherExpensesList.length === 0
                ? 'Use the Petty Cash Book to record routine snacks, office stationery, emergency maintenance, or general supplies directly from the community balance.'
                : 'Try adjusting your search query or category filters to find the voucher.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => requireAuth(() => onAddExpense?.(OTHER_EXPENSES_ID))}
              className="py-2.5 px-5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl inline-flex items-center gap-2 shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.8px]" />
              <span>Record First Petty Cash Voucher</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
            <span>
              Showing {filteredList.length} of {otherExpensesList.length} petty cash voucher{otherExpensesList.length === 1 ? '' : 's'}
            </span>
            <span>
              Subtotal: <strong className="text-rose-400 font-mono-num font-bold">{formatINR(filteredList.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</strong>
            </span>
          </div>

          {filteredList.map((exp, idx) => {
            const paidByMember = members.find((m) => m.id === exp.paidById);
            const paidByName = exp.paidById === 'fund' ? 'Tm ISHAL Group Fund' : paidByMember ? paidByMember.name : 'Authorized Member';
            const isCash = (exp.paymentMethod || 'cash') === 'cash';

            return (
              <div
                key={exp.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#0E172A] hover:bg-[#121D35] border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Left Side: Icon & Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#142038] border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getCategoryIcon(exp.category || 'Miscellaneous')}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white truncate">
                        {exp.name}
                      </h4>
                      {exp.receiptNo && (
                        <span className="text-[10px] font-mono-num font-bold px-1.5 py-0.2 rounded bg-slate-800/90 text-blue-300 border border-slate-700">
                          #{exp.receiptNo}
                        </span>
                      )}
                      <span className="text-[10px] px-2 py-0.2 rounded-full font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50">
                        {exp.category || 'General'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>{formatDate(exp.date)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {isCash ? (
                          <span className="text-amber-300 font-medium flex items-center gap-1">
                            <Banknote className="w-3 h-3" /> Cash
                          </span>
                        ) : (
                          <span className="text-blue-300 font-medium flex items-center gap-1">
                            <Landmark className="w-3 h-3" /> Bank / UPI
                          </span>
                        )}
                      </span>
                      <span>•</span>
                      <span className="truncate">Disbursed by: <strong className="text-slate-300">{paidByName}</strong></span>
                    </div>

                    {exp.notes && (
                      <p className="text-[11px] text-slate-400/90 italic pt-0.5 line-clamp-2">
                        "{exp.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Side: Amount & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                  <div className="text-left sm:text-right">
                    <div className="text-base sm:text-lg font-bold font-mono-num text-rose-400 tracking-tight">
                      - {formatINR(exp.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Treasury Balance Drawn
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditExpense?.(exp)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-300 hover:bg-[#182647] transition-colors cursor-pointer"
                      title="Edit Voucher"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => requireAuth(() => setExpenseToDelete(exp))}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Voucher"
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

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0F172A] border border-rose-800/80 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2px]" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Voucher?</h3>
              <p className="text-xs text-slate-300 font-medium">
                Are you sure you want to delete <span className="text-white font-bold">"{expenseToDelete.name}"</span> ({formatINR(expenseToDelete.amount)})?
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                This disbursement will be removed from the Petty Cash Book and restored to the available treasury balance.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all active:scale-95 cursor-pointer"
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
