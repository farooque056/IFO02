import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { X, Receipt, CalendarPlus, UserPlus, Share2 } from 'lucide-react';

interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: () => void;
  onCreateEvent: () => void;
  onAddMember: () => void;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  onCreateEvent,
  onAddMember,
}) => {
  const { requireAuth, events } = useFinance();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl text-slate-900 animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/50">
          <h3 className="font-bold text-base text-slate-900">Quick Actions</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-4 sm:p-5 space-y-3 pb-8 sm:pb-5">
          {/* 1. Add Expense */}
          <button
            onClick={() => {
              onClose();
              requireAuth(() => onAddExpense());
            }}
            className="w-full p-4 rounded-2xl bg-white hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-200 flex items-center gap-4 text-left transition-all active:scale-[0.99] group shadow-xs hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center font-bold shadow-xs group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <Receipt className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Add New Expense
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                Record a bill, payment, or purchase under an event
              </p>
            </div>
          </button>

          {/* 2. Create Event */}
          <button
            onClick={() => {
              onClose();
              requireAuth(() => onCreateEvent());
            }}
            className="w-full p-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 flex items-center gap-4 text-left transition-all active:scale-[0.99] group shadow-xs hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs group-hover:scale-105 transition-all">
              <CalendarPlus className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Create New Event / Function
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                Wedding, Iftar, Picnic, Eid, Sports match, or gathering
              </p>
            </div>
          </button>

          {/* 3. Add Member */}
          <button
            onClick={() => {
              onClose();
              requireAuth(() => onAddMember());
            }}
            className="w-full p-4 rounded-2xl bg-white hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-200 flex items-center gap-4 text-left transition-all active:scale-[0.99] group shadow-xs hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100/80 text-emerald-600 flex items-center justify-center font-bold shadow-xs group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <UserPlus className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Add Tm ISHAL Member
              </h4>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                Save a new community member to the reusable list
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
