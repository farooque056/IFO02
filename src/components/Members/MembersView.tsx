import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Member } from '../../types';
import { formatINR, getMemberFinancials } from '../../utils/formatters';
import { downloadMemberPDF, downloadRosterPDF } from '../../utils/pdfGenerator';
import { MemberDetailModal } from './MemberDetailModal';
import { BatchImportModal } from './BatchImportModal';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Edit,
  Trash2,
  CalendarCheck,
  CreditCard,
  Building2,
  ExternalLink,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  Share2,
  MessageCircle,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Trophy,
  ArrowUpRight,
} from 'lucide-react';

interface MembersViewProps {
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onSelectEvent: (eventId: string) => void;
}

type FilterRole = 'all' | 'due' | 'settled' | 'top-contributors' | 'coordinator' | 'core' | 'inactive';
type SortOption = 'name-asc' | 'name-desc' | 'events-desc' | 'paid-desc' | 'due-desc';

export const MembersView: React.FC<MembersViewProps> = ({
  onAddMember,
  onEditMember,
  onSelectEvent,
}) => {
  const { members, events, expenses, transactions, searchQuery, requireAuth } = useFinance();
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<Member | null>(null);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [localSearch, setLocalSearch] = useState('');

  // Compute aggregated stats for each member using event donated amounts & pending calculations
  const memberStats = useMemo(() => {
    return members.map((member) => {
      const financials = getMemberFinancials(member, events, expenses, transactions);

      return {
        member,
        joinedEventsCount: financials.joinedEventsCount,
        joinedEvents: financials.joinedEvents,
        totalPaid: financials.totalPaid,
        totalDonated: financials.totalDonated,
        totalDirectExpenses: financials.totalDirectExpenses,
        pendingEvents: financials.pendingEvents,
        totalPending: financials.totalPending,
        isAllClear: financials.isAllClear,
      };
    });
  }, [members, events, expenses, transactions]);

  // Combined totals
  const overallMetrics = useMemo(() => {
    let activeCount = 0;
    let totalDonations = 0;
    let totalPendingDues = 0;
    let membersWithPending = 0;
    let donorsCount = 0;

    memberStats.forEach((s) => {
      if (s.joinedEventsCount > 0) activeCount++;
      totalDonations += s.totalPaid;
      if (s.totalPending > 0) {
        totalPendingDues += s.totalPending;
        membersWithPending++;
      }
      if (s.totalPaid > 0) {
        donorsCount++;
      }
    });

    return {
      activeCount,
      totalDonations,
      totalPendingDues,
      membersWithPending,
      donorsCount,
    };
  }, [memberStats]);

  // Filter and Sort members list
  const filteredMembers = useMemo(() => {
    let list = [...memberStats];
    const isTopDonorsFilter = roleFilter === 'top-contributors';

    if (isTopDonorsFilter) {
      // Top Donors strictly depends on having paid contributions
      list = list.filter((item) => item.totalPaid > 0);
    } else {
      list = list.filter(({ member, joinedEventsCount, totalPending, isAllClear }) => {
        if (roleFilter === 'coordinator') {
          if (!member.role?.toLowerCase().includes('coordinator')) return false;
        } else if (roleFilter === 'core') {
          if (member.role?.toLowerCase().includes('coordinator')) return false;
        } else if (roleFilter === 'due') {
          if (totalPending <= 0) return false;
        } else if (roleFilter === 'settled') {
          if (!isAllClear) return false;
        } else if (roleFilter === 'inactive') {
          if (joinedEventsCount > 0) return false;
        }
        return true;
      });
    }

    const q = (localSearch || searchQuery || '').toLowerCase().trim();
    if (q) {
      list = list.filter(
        ({ member }) =>
          member.name.toLowerCase().includes(q) ||
          member.role?.toLowerCase().includes(q) ||
          member.phone?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (isTopDonorsFilter) {
        // When Top Donors is active, rank strictly by totalPaid descending
        if (sortOption === 'name-asc') {
          return b.totalPaid - a.totalPaid || a.member.name.localeCompare(b.member.name);
        }
        if (sortOption === 'name-desc') {
          return b.totalPaid - a.totalPaid || b.member.name.localeCompare(a.member.name);
        }
        if (sortOption === 'due-desc') {
          return b.totalPending - a.totalPending || b.totalPaid - a.totalPaid;
        }
        if (sortOption === 'events-desc') {
          return b.joinedEventsCount - a.joinedEventsCount || b.totalPaid - a.totalPaid;
        }
        return b.totalPaid - a.totalPaid;
      }

      if (sortOption === 'name-asc') {
        return a.member.name.localeCompare(b.member.name);
      }
      if (sortOption === 'name-desc') {
        return b.member.name.localeCompare(a.member.name);
      }
      if (sortOption === 'events-desc') {
        return b.joinedEventsCount - a.joinedEventsCount;
      }
      if (sortOption === 'paid-desc') {
        return b.totalPaid - a.totalPaid;
      }
      if (sortOption === 'due-desc') {
        return b.totalPending - a.totalPending; // Most pending first
      }
      return 0;
    });

    return list;
  }, [memberStats, roleFilter, sortOption, localSearch, searchQuery]);

  // Export roster to CSV
  const handleExportCSV = () => {
    let csv = 'Name,Role,Phone,Events Joined,Total Donated / Paid (INR),Total Pending (INR),Pending Events Breakdown,Status\n';
    memberStats.forEach(({ member, joinedEventsCount, totalPaid, totalPending, pendingEvents, isAllClear }) => {
      const status = isAllClear ? 'Settled' : 'Pending Due';
      const pendingBreakdown = pendingEvents.map((p) => `${p.eventName}: ${formatINR(p.pendingAmount)}`).join('; ');
      csv += `"${member.name}","${member.role || 'Member'}","${member.phone || ''}",${joinedEventsCount},${totalPaid},${totalPending},"${pendingBreakdown}","${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tm_ISHAL_Members_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // WhatsApp Share Full Roster
  const handleShareAllWhatsApp = () => {
    let msg = `*Tm ISHAL — Members Financial Roster (${members.length} Members)*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    memberStats.forEach(({ member, joinedEventsCount, totalPaid, totalPending, pendingEvents, isAllClear }, idx) => {
      const statusText = isAllClear
        ? `✅ Settled`
        : `⚠️ Pending ${formatINR(totalPending)} (${pendingEvents.map((p) => p.eventName).join(', ')})`;
      msg += `${idx + 1}. *${member.name}* (${member.role || 'Member'})\n`;
      msg += `   • Events: ${joinedEventsCount} | Paid: ${formatINR(totalPaid)} | ${statusText}\n`;
    });
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_Total Donated (Paid): ${formatINR(overallMetrics.totalDonations)} • Total Pending Dues: ${formatINR(overallMetrics.totalPendingDues)}_\n`;
    msg += `_Generated via Tm ISHAL (Ishal Finance Organizer)_`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400 stroke-[2.2px]" />
            Tm ISHAL Members
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Manage directory ({members.length} members), tracking, dues, & individual statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBatchImportOpen(true)}
            className="py-2 px-3 bg-[#111A2E] hover:bg-[#15223C] border border-slate-800 hover:border-blue-700/60 text-slate-200 font-bold text-xs rounded-2xl flex items-center gap-1.5 transition-all active:scale-95 shadow-xs"
            title="Batch import member list from CSV or text"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Batch Import</span>
          </button>

          <button
            onClick={() => requireAuth(() => onAddMember())}
            className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.6px]" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Roster Overview Card */}
      <div className="bg-[#111A2E]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Roster
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-white font-mono-num mt-0.5 block tracking-tight">
              {members.length}
            </span>
            <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
              community members
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Active in Events
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-blue-400 font-mono-num mt-0.5 block tracking-tight">
              {overallMetrics.activeCount}
            </span>
            <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
              participating
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Paid (Donated)
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono-num mt-0.5 block tracking-tight">
              {formatINR(overallMetrics.totalDonations)}
            </span>
            <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
              across all events
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Pending Dues
            </span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono-num mt-0.5 block tracking-tight">
              {formatINR(overallMetrics.totalPendingDues)}
            </span>
            <span className="text-[10.5px] text-slate-500 block font-medium mt-0.5">
              {overallMetrics.membersWithPending} members with dues
            </span>
          </div>
        </div>

        {/* Quick Export & Actions Toolbar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Roster Tools:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleExportCSV}
              className="py-1.5 px-2.5 bg-[#0B1323] hover:bg-[#15223C] border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
              title="Download CSV spreadsheet"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => downloadRosterPDF(members, events, expenses, transactions)}
              className="py-1.5 px-2.5 bg-[#0B1323] hover:bg-[#15223C] border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
              title="Download Printable PDF Roster"
            >
              <FileText className="w-3 h-3 text-blue-400" />
              <span>Roster PDF</span>
            </button>

            <button
              onClick={handleShareAllWhatsApp}
              className="py-1.5 px-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 text-emerald-300 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95"
              title="Share formatted roster to WhatsApp group"
            >
              <MessageCircle className="w-3 h-3 text-emerald-400" />
              <span>Share WhatsApp</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips & Sort Controls */}
      <div className="space-y-2.5">
        {/* Search, Single Box Filter & Sort Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search member by name, phone, or role..."
              className="w-full pl-9 pr-4 py-2 bg-[#111A2E]/90 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Single Box Filter Dropdown */}
            <div className="relative flex-1 sm:flex-initial shrink-0">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as FilterRole)}
                className="w-full sm:w-auto bg-[#111A2E] border border-slate-800 text-slate-300 text-xs font-bold py-2 pl-3 pr-8 rounded-2xl focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
                title="Filter by status or role"
              >
                <option value="all">Filter: All ({members.length})</option>
                <option value="due">Filter: With Dues ({overallMetrics.membersWithPending})</option>
                <option value="settled">Filter: All Cleared ({members.length - overallMetrics.membersWithPending})</option>
                <option value="top-contributors">Filter: Top Donors</option>
                <option value="coordinator">Filter: Coordinators</option>
                <option value="core">Filter: Core Members</option>
                <option value="inactive">Filter: No Events</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative flex-1 sm:flex-initial shrink-0">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full sm:w-auto bg-[#111A2E] border border-slate-800 text-slate-300 text-xs font-bold py-2 pl-3 pr-8 rounded-2xl focus:outline-none focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="name-asc">Sort: Name (A → Z)</option>
                <option value="name-desc">Sort: Name (Z → A)</option>
                <option value="events-desc">Sort: Most Events</option>
                <option value="paid-desc">Sort: Highest Paid</option>
                <option value="due-desc">Sort: Largest Due</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Members Grid/List */}
      {filteredMembers.length === 0 ? (
        <div className="p-8 text-center bg-[#111A2E]/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-xs space-y-3">
          <Users className="w-10 h-10 text-slate-500 mx-auto" />
          <p className="text-sm font-bold text-white">No members match filters</p>
          <p className="text-xs text-slate-400">
            Try resetting your search or filter selection.
          </p>
          <button
            onClick={() => {
              setRoleFilter('all');
              setLocalSearch('');
            }}
            className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow-sm"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMembers.map(({ member, joinedEventsCount, totalPaid, totalPending, pendingEvents, isAllClear }) => {
            const rawPhone = (member.phone || '').replace(/[^0-9]/g, '');
            const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

            return (
              <div
                key={member.id}
                className="bg-[#111A2E]/90 backdrop-blur-xl border border-slate-800/80 hover:border-blue-700/60 rounded-3xl p-4 sm:p-4.5 transition-all duration-200 shadow-xs group"
              >
                {/* Top Row: Avatar, Identity, Role & Quick Action Buttons */}
                <div className="flex items-start justify-between gap-3">
                  {/* Clickable Profile Area */}
                  <div
                    onClick={() => setSelectedMemberDetail(member)}
                    className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-extrabold text-white shadow-xs shrink-0 ring-2 ring-[#0D1527] group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: member.avatarColor || '#2563EB' }}
                    >
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                          {member.name}
                        </h3>
                        {member.role && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 shrink-0">
                            {member.role}
                          </span>
                        )}
                      </div>
                      {member.phone ? (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate font-mono-num font-medium">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{member.phone}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Tm ISHAL Member</p>
                      )}
                    </div>
                  </div>

                  {/* Direct Action Icons Bar */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Direct WhatsApp Action */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const pendingDetails = pendingEvents.length > 0
                          ? ` Pending dues: ${formatINR(totalPending)} (in: ${pendingEvents.map((p) => `${p.eventName}: ${formatINR(p.pendingAmount)}`).join(', ')}).`
                          : ' All event contributions are cleared!';
                        const text = encodeURIComponent(
                          `Salam ${member.name}, Tm ISHAL financial update: You have joined ${joinedEventsCount} events. Total Donated / Paid: ${formatINR(totalPaid)}.${pendingDetails}`
                        );
                        const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
                        window.open(url, '_blank');
                      }}
                      className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 transition-colors"
                      title="Send WhatsApp update"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>

                    {/* Direct Call Action */}
                    {member.phone && (
                      <a
                        href={`tel:${member.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 transition-colors"
                        title="Call Phone"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}

                    {/* Download Single Member PDF */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMemberPDF(member, events, expenses, members, transactions);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                      title="Download PDF statement"
                    >
                      <FileText className="w-4 h-4" />
                    </button>

                    {/* Edit Profile */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requireAuth(() => onEditMember(member));
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                      title="Edit member profile"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Member Financial Metric Bar (Clickable) */}
                <div
                  onClick={() => setSelectedMemberDetail(member)}
                  className="grid grid-cols-3 gap-2 mt-3.5 pt-3.5 border-t border-slate-800/80 text-center cursor-pointer"
                >
                  <div className="bg-[#0B1323]/80 p-2.5 rounded-2xl border border-slate-800/80 group-hover:border-slate-700 transition-colors">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                      Events Joined
                    </span>
                    <span className="text-xs font-extrabold text-white font-mono-num">
                      {joinedEventsCount}
                    </span>
                  </div>

                  <div className="bg-[#0B1323]/80 p-2.5 rounded-2xl border border-slate-800/80 group-hover:border-slate-700 transition-colors">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                      Total Paid
                    </span>
                    <span className="text-xs font-extrabold font-mono-num text-emerald-400">
                      {formatINR(totalPaid)}
                    </span>
                  </div>

                  <div className="bg-[#0B1323]/80 p-2.5 rounded-2xl border border-slate-800/80 group-hover:border-slate-700 transition-colors">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-wider">
                      Pending Amount
                    </span>
                    <span
                      className={`text-xs font-extrabold font-mono-num ${
                        totalPending > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {totalPending > 0 ? formatINR(totalPending) : '₹0'}
                    </span>
                  </div>
                </div>

                {/* Event Pending Breakdown Detail */}
                {pendingEvents.length > 0 ? (
                  <div className="mt-3 p-2.5 rounded-2xl bg-amber-950/30 border border-amber-800/50">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Pending in {pendingEvents.length} {pendingEvents.length === 1 ? 'event' : 'events'}:</span>
                      </span>
                      <span className="font-mono-num text-amber-200 font-extrabold">
                        {formatINR(totalPending)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pendingEvents.map((pe) => (
                        <button
                          key={pe.eventId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(pe.eventId);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-[#0B1323] hover:bg-amber-950/80 border border-amber-700/50 text-[11px] text-amber-200 font-medium flex items-center gap-1.5 transition-all group/pe hover:border-amber-500"
                          title={`Click to open event: ${pe.eventName}`}
                        >
                          <span className="font-semibold text-white">{pe.eventName}</span>
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 font-bold font-mono-num text-[10.5px]">
                            {formatINR(pe.pendingAmount)}
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-amber-400 group-hover/pe:translate-x-0.5 group-hover/pe:-translate-y-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>All event contributions cleared</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40 font-mono-num">
                      Settled
                    </span>
                  </div>
                )}

                {/* Footer hint */}
                <div
                  onClick={() => setSelectedMemberDetail(member)}
                  className="mt-2 text-right cursor-pointer"
                >
                  <span className="text-[10.5px] text-slate-500 group-hover:text-blue-400 font-medium inline-flex items-center gap-0.5 transition-colors">
                    View Ledger & Statement <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Member Detailed Statement & Ledger Modal */}
      {selectedMemberDetail && (
        <MemberDetailModal
          isOpen={!!selectedMemberDetail}
          onClose={() => setSelectedMemberDetail(null)}
          member={selectedMemberDetail}
          onEditMember={(m) => {
            setSelectedMemberDetail(null);
            onEditMember(m);
          }}
          onSelectEvent={(eventId) => {
            setSelectedMemberDetail(null);
            onSelectEvent(eventId);
          }}
        />
      )}

      {/* Batch Import Modal */}
      {isBatchImportOpen && (
        <BatchImportModal
          isOpen={isBatchImportOpen}
          onClose={() => setIsBatchImportOpen(false)}
        />
      )}
    </div>
  );
};

