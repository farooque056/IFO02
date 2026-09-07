import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/Dashboard/DashboardView';
import { EventsView } from './components/Events/EventsView';
import { MembersView } from './components/Members/MembersView';
import { TransactionsView } from './components/Transactions/TransactionsView';
import { EventDetailModal } from './components/Events/EventDetailModal';
import { EventFormModal } from './components/Events/EventFormModal';
import { ExpenseFormModal } from './components/Expenses/ExpenseFormModal';
import { MemberFormModal } from './components/Members/MemberFormModal';
import { PinModal } from './components/PinModal';
import { SettingsModal } from './components/SettingsModal';
import { QuickCreateModal } from './components/QuickCreateModal';
import { EventItem, Expense, Member } from './types';

function MainLayout() {
  const {
    activeTab,
    selectedEventId,
    setSelectedEventId,
    requireAuth,
  } = useFinance();

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  // Expense modal state
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseInitialEventId, setExpenseInitialEventId] = useState<string | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<EventItem | null>(null);
  const [eventInitialDate, setEventInitialDate] = useState<string | undefined>(undefined);

  // Member modal state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);

  // Handlers
  const handleOpenAddExpense = (eventId?: string) => {
    setExpenseInitialEventId(eventId || selectedEventId || null);
    setExpenseToEdit(null);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditExpense = (expense: Expense) => {
    setExpenseToEdit(expense);
    setExpenseInitialEventId(expense.eventId);
    setIsExpenseModalOpen(true);
  };

  const handleOpenCreateEvent = (defaultDate?: string) => {
    setEventToEdit(null);
    setEventInitialDate(defaultDate);
    setIsEventModalOpen(true);
  };

  const handleOpenEditEvent = (event: EventItem) => {
    setEventToEdit(event);
    setEventInitialDate(undefined);
    setIsEventModalOpen(true);
  };

  const handleOpenAddMember = () => {
    setMemberToEdit(null);
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: Member) => {
    setMemberToEdit(member);
    setIsMemberModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col selection:bg-blue-900 selection:text-blue-200 antialiased">
      {/* Top Navbar */}
      <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Container framed cleanly for mobile & desktop */}
      <main id="main-content" className="flex-1 max-w-md md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto w-full px-3.5 sm:px-6 pt-5 pb-28">
        {activeTab === 'dashboard' && (
          <DashboardView
            onSelectEvent={(id) => setSelectedEventId(id)}
            onOpenQuickCreate={() => setIsQuickCreateOpen(true)}
            onAddExpense={() => handleOpenAddExpense()}
            onCreateEvent={() => handleOpenCreateEvent()}
            onEditExpense={handleOpenEditExpense}
          />
        )}

        {activeTab === 'events' && (
          <EventsView
            onSelectEvent={(id) => setSelectedEventId(id)}
            onCreateEvent={(defaultDate) => handleOpenCreateEvent(defaultDate)}
            onAddExpense={(evId) => handleOpenAddExpense(evId)}
            onEditExpense={handleOpenEditExpense}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView />
        )}

        {activeTab === 'members' && (
          <MembersView
            onAddMember={() => handleOpenAddMember()}
            onEditMember={handleOpenEditMember}
            onSelectEvent={(id) => setSelectedEventId(id)}
          />
        )}
      </main>

      {/* Bottom Sticky 3-Tab Bar with Central Action Button */}
      <BottomNav onOpenQuickCreate={() => setIsQuickCreateOpen(true)} />

      {/* Event Detail View (Ledger & Accounting Sheet) */}
      {selectedEventId && (
        <EventDetailModal
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onEditEvent={handleOpenEditEvent}
          onAddExpense={(evId) => handleOpenAddExpense(evId)}
          onEditExpense={handleOpenEditExpense}
        />
      )}

      {/* Quick Action Sheet */}
      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        onAddExpense={() => handleOpenAddExpense()}
        onCreateEvent={() => handleOpenCreateEvent()}
        onAddMember={() => handleOpenAddMember()}
      />

      {/* Add / Edit Expense Modal */}
      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseToEdit(null);
        }}
        initialEventId={expenseInitialEventId}
        expenseToEdit={expenseToEdit}
        onOpenCreateEvent={() => {
          setIsExpenseModalOpen(false);
          handleOpenCreateEvent();
        }}
      />

      {/* Create / Edit Event Modal */}
      <EventFormModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEventToEdit(null);
          setEventInitialDate(undefined);
        }}
        eventToEdit={eventToEdit}
        defaultDate={eventInitialDate}
      />

      {/* Add / Edit Member Modal */}
      <MemberFormModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setMemberToEdit(null);
        }}
        memberToEdit={memberToEdit}
      />

      {/* Shared PIN Authentication Dialog */}
      <PinModal />

      {/* Settings, Backup & Restore Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <MainLayout />
    </FinanceProvider>
  );
}
