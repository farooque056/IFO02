import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { TabType } from '../types';
import { LayoutDashboard, CalendarDays, BookOpenText, Users, Plus } from 'lucide-react';

interface BottomNavProps {
  onOpenQuickCreate: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenQuickCreate }) => {
  const { activeTab, setActiveTab, events, members, transactions, setSelectedEventId } = useFinance();

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'events') {
      setSelectedEventId(null);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0D1527]/95 backdrop-blur-xl border-t border-slate-800/80 pb-safe shadow-xl">
      <div className="max-w-md md:max-w-lg mx-auto px-4 sm:px-6 py-2 flex items-center justify-between relative">
        {/* Tab 1: Dashboard */}
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeTab === 'dashboard' ? 'stroke-[2.4px]' : 'stroke-2'}`} />
          <span className="text-[10px] font-semibold tracking-tight">Dashboard</span>
        </button>

        {/* Tab 2: Events */}
        <button
          onClick={() => handleTabChange('events')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl relative transition-all duration-200 ${
            activeTab === 'events'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <CalendarDays className={`w-5 h-5 mb-0.5 ${activeTab === 'events' ? 'stroke-[2.4px]' : 'stroke-2'}`} />
            {events.length > 0 && (
              <span className="absolute -top-1 -right-2.5 bg-blue-600 text-white text-[9px] font-bold rounded-full px-1 min-w-[14px] h-3.5 flex items-center justify-center shadow-xs">
                {events.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-tight">Events</span>
        </button>

        {/* Central Quick Create Button */}
        <div className="flex items-center justify-center -mt-6">
          <button
            onClick={onOpenQuickCreate}
            className="w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-[#0B1120]"
            title="Quick Create Expense, Event, or Member"
            aria-label="Create New"
          >
            <Plus className="w-5 h-5 stroke-[2.8px]" />
          </button>
        </div>

        {/* Tab 3: Transactions Ledger */}
        <button
          onClick={() => handleTabChange('transactions')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl relative transition-all duration-200 ${
            activeTab === 'transactions'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <BookOpenText className={`w-5 h-5 mb-0.5 ${activeTab === 'transactions' ? 'stroke-[2.4px]' : 'stroke-2'}`} />
            {transactions.length > 0 && (
              <span className="absolute -top-1 -right-2.5 bg-cyan-600 text-white text-[9px] font-bold rounded-full px-1 min-w-[14px] h-3.5 flex items-center justify-center shadow-xs">
                {transactions.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-tight">Ledger</span>
        </button>

        {/* Tab 4: Members */}
        <button
          onClick={() => handleTabChange('members')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl relative transition-all duration-200 ${
            activeTab === 'members'
              ? 'text-blue-400 font-bold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Users className={`w-5 h-5 mb-0.5 ${activeTab === 'members' ? 'stroke-[2.4px]' : 'stroke-2'}`} />
            {members.length > 0 && (
              <span className="absolute -top-1 -right-2.5 bg-slate-800 text-slate-300 text-[9px] font-bold rounded-full px-1 min-w-[14px] h-3.5 flex items-center justify-center border border-slate-700">
                {members.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold tracking-tight">Members</span>
        </button>
      </div>
    </div>
  );
};
