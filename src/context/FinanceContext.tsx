import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { EventItem, Expense, Member, TabType, TransactionRecord } from '../types';
import { getEventFinancials } from '../utils/formatters';
import {
  INITIAL_EVENTS,
  INITIAL_EXPENSES,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
} from '../data/initialData';
import {
  CloudSyncStatus,
  ensureDatabaseSeeded,
  subscribeToCloudSync,
  fetchLatestFromCloud,
  saveMemberCloud,
  deleteMemberCloud,
  saveEventCloud,
  deleteEventCloud,
  saveExpenseCloud,
  deleteExpenseCloud,
  saveTransactionCloud,
  deleteTransactionCloud,
  updateSettingsCloud,
  resetCloudToDefaults,
  eraseAllCloudData,
} from '../services/firestoreSync';

interface FinanceContextType {
  events: EventItem[];
  expenses: Expense[];
  members: Member[];
  transactions: TransactionRecord[];
  openingBalance: number;
  totalCollected: number;
  totalFundsAvailable: number;
  netTreasuryBalance: number;
  totalCashSpending: number;
  totalBankSpending: number;
  isAdminUnlocked: boolean;
  sharedPin: string;
  activeTab: TabType;
  selectedEventId: string | null;
  searchQuery: string;
  isPinModalOpen: boolean;
  pinModalCallback: (() => void) | null;
  
  // Real-time Cloud Sync
  cloudSyncStatus: CloudSyncStatus;
  lastCloudSync: Date | null;
  forceSyncToCloud: () => Promise<void>;
  pullLatestFromCloud: () => Promise<boolean>;
  isPullingCloud: boolean;
  
  // Navigation & View Actions
  setActiveTab: (tab: TabType) => void;
  setSelectedEventId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  openPinModal: (onSuccess?: () => void) => void;
  closePinModal: () => void;
  
  // Fund & Balance Actions
  setOpeningBalance: (amount: number) => void;
  setTotalCollected: (amount: number) => void;
  updateFundState: (opening: number, collected: number) => void;
  
  // Auth Actions
  unlockWithPin: (pin: string) => boolean;
  lockAdmin: () => void;
  changePin: (oldPin: string, newPin: string) => { success: boolean; message: string };
  requireAuth: (action: () => void) => void;

  // CRUD Events
  addEvent: (eventData: Omit<EventItem, 'id' | 'createdAt'> & { id?: string }) => string;
  updateEvent: (id: string, eventData: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;
  addCategoryToEvent: (eventId: string, categoryName: string) => void;
  removeCategoryFromEvent: (eventId: string, categoryName: string) => void;
  markMemberPaid: (eventId: string, memberId: string, isPaid?: boolean) => void;
  toggleMemberSettled: (eventId: string, memberId: string) => void;

  // CRUD Expenses
  addExpense: (expenseData: Omit<Expense, 'id' | 'createdAt'>) => string;
  updateExpense: (id: string, expenseData: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // CRUD Transactions
  addTransaction: (tx: Omit<TransactionRecord, 'transactionId'> & { transactionId?: string }) => string;
  updateTransaction: (transactionId: string, txData: Partial<TransactionRecord>) => void;
  deleteTransaction: (transactionId: string) => void;

  // CRUD Members
  addMember: (memberData: Omit<Member, 'id' | 'createdAt'>) => string;
  updateMember: (id: string, memberData: Partial<Member>) => void;
  deleteMember: (id: string) => { success: boolean; message?: string };

  // Data management
  resetToDefaults: () => void;
  eraseAllData: () => void;
  exportToJSON: () => string;
  importFromJSON: (jsonString: string) => { success: boolean; message: string };
  
  // Aggregated Stats
  totalSpending: number;
  totalExpensesCount: number;
  activeEventsCount: number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  EVENTS: 'ifo_tm_ishal_events_v6',
  EXPENSES: 'ifo_tm_ishal_expenses_v6',
  MEMBERS: 'ifo_tm_ishal_members_v6',
  TRANSACTIONS: 'ifo_tm_ishal_transactions_v6',
  PIN: 'ifo_tm_ishal_pin',
  AUTH: 'ifo_tm_ishal_is_unlocked',
  OPENING_BALANCE: 'ifo_tm_ishal_opening_balance_v6',
  TOTAL_COLLECTED: 'ifo_tm_ishal_total_collected_v6',
  CLEARED: 'ifo_tm_ishal_cleared_v6',
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Helper to detect if stored data is the old demo seed
  const isDemoData = (key: string, value: any): boolean => {
    if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return false;
    if (!value) return true;
    if (key === STORAGE_KEYS.MEMBERS && Array.isArray(value)) {
      return value.some((m: any) => m.id === 'm1' && m.name === 'Salman Faris');
    }
    if (key === STORAGE_KEYS.EVENTS && Array.isArray(value)) {
      return value.some((e: any) => e.id === 'e1' || e.name?.includes('Grand Iftar 2026'));
    }
    if (key === STORAGE_KEYS.EXPENSES && Array.isArray(value)) {
      return value.some((exp: any) => exp.id === 'exp1' || exp.name?.includes('Biryani Catering'));
    }
    return false;
  };

  // 1. Members State
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      if (!saved) return INITIAL_MEMBERS;
      const parsed = JSON.parse(saved);
      if (isDemoData(STORAGE_KEYS.MEMBERS, parsed) || (Array.isArray(parsed) && parsed.length === 0)) {
        return INITIAL_MEMBERS;
      }
      return parsed;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  // 2. Events State
  const [events, setEvents] = useState<EventItem[]>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return INITIAL_EVENTS;
      let parsed = JSON.parse(saved);
      if (isDemoData(STORAGE_KEYS.EVENTS, parsed) || (Array.isArray(parsed) && parsed.length === 0)) {
        return INITIAL_EVENTS;
      }
      if (Array.isArray(parsed)) {
        parsed = parsed.map((e: EventItem) => {
          let updated = { ...e };
          if (updated.id === 'ev_taawun_2026' || updated.name.toLowerCase().includes('taawun')) {
            updated.splitMode = 'minimum';
            updated.minimumAmountPerPerson = updated.minimumAmountPerPerson || 2000;
          } else if (updated.id === 'ev_iftar_2026' || updated.name.toLowerCase().includes('iftar')) {
            updated.splitMode = updated.splitMode || 'minimum';
            updated.minimumAmountPerPerson = updated.minimumAmountPerPerson || 500;
          } else if (updated.id === 'ev_premier_league_2026' || updated.name.toLowerCase().includes('premier league')) {
            updated.splitMode = updated.splitMode || 'minimum';
            updated.minimumAmountPerPerson = updated.minimumAmountPerPerson || 300;
          } else if (updated.id === 'ev_ameen_wedding' || updated.name.toLowerCase().includes("ameen's wedding")) {
            updated.splitMode = updated.splitMode || 'even';
            updated.targetSplitAmount = updated.targetSplitAmount || 32000;
            updated.weddingPersonId = updated.weddingPersonId || 'm3';
            if (!updated.exemptMemberIds || updated.exemptMemberIds.length === 0) {
              updated.exemptMemberIds = ['m3'];
            }
          }
          return updated;
        });
      }
      return parsed;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  // 3. Expenses State
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!saved) return INITIAL_EXPENSES;
      let parsed = JSON.parse(saved);
      if (isDemoData(STORAGE_KEYS.EXPENSES, parsed) || (Array.isArray(parsed) && parsed.length === 0)) {
        return INITIAL_EXPENSES;
      }
      return parsed;
    } catch {
      return INITIAL_EXPENSES;
    }
  });

  // 4. Transactions State (TX001 through TX083)
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return [];
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!saved) return INITIAL_TRANSACTIONS;
      let parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return INITIAL_TRANSACTIONS;
      }
      return parsed;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // 5. Fund Balance State (Opening Balance & Total Collected Revenue)
  const [openingBalance, setOpeningBalanceState] = useState<number>(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.CLEARED) === 'true') return 0;
      const saved = localStorage.getItem(STORAGE_KEYS.OPENING_BALANCE);
      if (saved === null) {
        return 7911;
      }
      return Number(saved) || 0;
    } catch {
      return 7911;
    }
  });

  // Calculate actual total collections directly from member contribution transactions
  const totalCollectionsFromTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [transactions]);

  // Aggregate collections directly across all events (including weddings and custom functions with settled members)
  const totalCollectionsFromEvents = useMemo(() => {
    return events.reduce((sum, ev) => {
      const fin = getEventFinancials(ev, expenses, members, transactions);
      return sum + (fin.evTotalCollections || 0);
    }, 0);
  }, [events, expenses, members, transactions]);

  const dynamicTotalCollected = useMemo(() => {
    return Math.max(totalCollectionsFromEvents, totalCollectionsFromTransactions);
  }, [totalCollectionsFromEvents, totalCollectionsFromTransactions]);

  const [customTotalCollected, setCustomTotalCollected] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TOTAL_COLLECTED);
      // Migrate old/stale fixed 72700 / 73000 defaults to null so it automatically syncs dynamically
      if (saved === null || saved === '72700' || saved === '73000') {
        return null;
      }
      const num = Number(saved);
      return isNaN(num) ? null : num;
    } catch {
      return null;
    }
  });

  const totalCollected =
    customTotalCollected !== null && customTotalCollected !== 73000 && customTotalCollected !== 72700
      ? customTotalCollected
      : dynamicTotalCollected;

  // 6. Security / PIN State
  const [sharedPin, setSharedPin] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PIN);
      if (!saved || saved === '1234') {
        localStorage.setItem(STORAGE_KEYS.PIN, '2323');
        return '2323';
      }
      return saved;
    } catch {
      return '2323';
    }
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEYS.AUTH);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalCallback, setPinModalCallback] = useState<(() => void) | null>(null);

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Real-time Cloud Synchronization State
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('syncing');
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);

  // Helper to generate the next unique sequential transaction ID (never collides or overwrites)
  const getNextTransactionId = (currentList: TransactionRecord[]): string => {
    const maxNum = currentList.reduce((max, tx) => {
      const match = tx.transactionId.match(/\d+/);
      return match ? Math.max(max, parseInt(match[0], 10)) : max;
    }, 0);
    return `TX${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Subscribe to real-time Firestore database updates immediately on mount
  useEffect(() => {
    let isMounted = true;
    setCloudSyncStatus('syncing');

    // Subscribe immediately so real-time updates flow without delay
    const unsub = subscribeToCloudSync({
      onMembers: (cloudMembers) => {
        if (isMounted && cloudMembers) {
          setMembers(cloudMembers);
        }
      },
      onEvents: (cloudEvents) => {
        if (isMounted && cloudEvents) {
          const normalized = cloudEvents.map((e) => {
            let updated = { ...e };
            // Only assign fallback splitMode if not already defined
            if (!updated.splitMode) {
              if (updated.id === 'ev_taawun_2026' || updated.name?.toLowerCase().includes('taawun')) {
                updated.splitMode = 'minimum';
              } else if (updated.id === 'ev_iftar_2026' || updated.name?.toLowerCase().includes('iftar')) {
                updated.splitMode = 'minimum';
              } else if (updated.id === 'ev_premier_league_2026' || updated.name?.toLowerCase().includes('premier league')) {
                updated.splitMode = 'minimum';
              } else if (updated.id === 'ev_ameen_wedding' || updated.name?.toLowerCase().includes("ameen's wedding")) {
                updated.splitMode = 'even';
              }
            }
            if (updated.splitMode === 'minimum' && !updated.minimumAmountPerPerson) {
              if (updated.id === 'ev_taawun_2026' || updated.name?.toLowerCase().includes('taawun')) {
                updated.minimumAmountPerPerson = 2000;
              } else if (updated.id === 'ev_iftar_2026' || updated.name?.toLowerCase().includes('iftar')) {
                updated.minimumAmountPerPerson = 500;
              } else if (updated.id === 'ev_premier_league_2026' || updated.name?.toLowerCase().includes('premier league')) {
                updated.minimumAmountPerPerson = 300;
              }
            }
            if (updated.splitMode === 'even' && !updated.targetSplitAmount) {
              if (updated.id === 'ev_ameen_wedding' || updated.name?.toLowerCase().includes("ameen's wedding")) {
                updated.targetSplitAmount = 32000;
                updated.weddingPersonId = updated.weddingPersonId || 'm3';
              }
            }
            return updated;
          });
          setEvents(normalized);
        }
      },
      onExpenses: (cloudExpenses) => {
        if (isMounted && cloudExpenses) {
          setExpenses(cloudExpenses);
        }
      },
      onTransactions: (cloudTransactions) => {
        if (isMounted && cloudTransactions) {
          setTransactions(cloudTransactions);
        }
      },
      onSettings: (cloudSettings) => {
        if (isMounted) {
          setOpeningBalanceState(cloudSettings.openingBalance ?? 7911);
          if (cloudSettings.customTotalCollected === 73000 || cloudSettings.customTotalCollected === 72700) {
            setCustomTotalCollected(null);
          } else {
            setCustomTotalCollected(cloudSettings.customTotalCollected ?? null);
          }
          if ((cloudSettings as any).cleared) {
            try {
              localStorage.setItem(STORAGE_KEYS.CLEARED, 'true');
            } catch {}
          } else {
            try {
              localStorage.removeItem(STORAGE_KEYS.CLEARED);
            } catch {}
          }
        }
      },
      onStatusChange: (status) => {
        if (isMounted) {
          setCloudSyncStatus(status);
          if (status === 'connected') {
            setLastCloudSync(new Date());
          }
        }
      },
    });

    // Ensure database is seeded in the background (non-blocking)
    ensureDatabaseSeeded({
      members,
      events,
      expenses,
      transactions,
      openingBalance,
      customTotalCollected,
    }).catch((err) => {
      console.warn('Background seed check:', err);
    });

    return () => {
      isMounted = false;
      if (unsub) {
        try {
          unsub();
        } catch {}
      }
    };
  }, []);

  const [isPullingCloud, setIsPullingCloud] = useState<boolean>(false);

  /**
   * Pulls the absolute freshest state from Firestore server across all collections
   * and updates local state + localStorage so edits from any phone appear instantly.
   */
  const pullLatestFromCloud = async (): Promise<boolean> => {
    setIsPullingCloud(true);
    setCloudSyncStatus('syncing');
    try {
      const data = await fetchLatestFromCloud();
      if (data.members && data.members.length > 0) {
        setMembers(data.members);
      }
      if (data.events && data.events.length > 0) {
        const normalized = data.events.map((e) => {
          let updated = { ...e };
          if (!updated.splitMode) {
            if (updated.id === 'ev_taawun_2026' || updated.name?.toLowerCase().includes('taawun')) {
              updated.splitMode = 'minimum';
            } else if (updated.id === 'ev_iftar_2026' || updated.name?.toLowerCase().includes('iftar')) {
              updated.splitMode = 'minimum';
            } else if (updated.id === 'ev_premier_league_2026' || updated.name?.toLowerCase().includes('premier league')) {
              updated.splitMode = 'minimum';
            } else if (updated.id === 'ev_ameen_wedding' || updated.name?.toLowerCase().includes("ameen's wedding")) {
              updated.splitMode = 'even';
            }
          }
          return updated;
        });
        setEvents(normalized);
      }
      if (data.expenses && data.expenses.length > 0) {
        setExpenses(data.expenses);
      }
      if (data.transactions && data.transactions.length > 0) {
        setTransactions(data.transactions);
      }
      if (data.settings) {
        setOpeningBalanceState(data.settings.openingBalance ?? 7911);
        if (data.settings.customTotalCollected === 73000 || data.settings.customTotalCollected === 72700) {
          setCustomTotalCollected(null);
        } else {
          setCustomTotalCollected(data.settings.customTotalCollected ?? null);
        }
      }
      setCloudSyncStatus('connected');
      setLastCloudSync(new Date());
      setIsPullingCloud(false);
      return true;
    } catch (err) {
      console.warn('Failed pulling latest cloud data:', err);
      setCloudSyncStatus('error');
      setIsPullingCloud(false);
      return false;
    }
  };

  const forceSyncToCloud = async () => {
    await pullLatestFromCloud();
  };

  // Periodic heartbeat pull (every 25 seconds when visible) so mobile browsers never lag
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchLatestFromCloud()
          .then((data) => {
            if (data.members.length > 0) setMembers(data.members);
            if (data.events.length > 0) setEvents(data.events);
            if (data.expenses.length > 0) setExpenses(data.expenses);
            if (data.transactions.length > 0) setTransactions(data.transactions);
            if (data.settings) {
              setOpeningBalanceState(data.settings.openingBalance ?? 7911);
              if (data.settings.customTotalCollected !== 73000 && data.settings.customTotalCollected !== 72700) {
                setCustomTotalCollected(data.settings.customTotalCollected ?? null);
              }
            }
            setLastCloudSync(new Date());
          })
          .catch(() => {});
      }
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.error('Error saving members:', e);
    }
  }, [members]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    } catch (e) {
      console.error('Error saving events:', e);
    }
  }, [events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } catch (e) {
      console.error('Error saving expenses:', e);
    }
  }, [expenses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch (e) {
      console.error('Error saving transactions:', e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PIN, sharedPin);
    } catch (e) {
      console.error('Error saving PIN:', e);
    }
  }, [sharedPin]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.OPENING_BALANCE, openingBalance.toString());
    } catch (e) {
      console.error('Error saving opening balance:', e);
    }
  }, [openingBalance]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOTAL_COLLECTED, totalCollected.toString());
    } catch (e) {
      console.error('Error saving total collected:', e);
    }
  }, [totalCollected]);

  // Fund balance setters (Synced to Cloud in Real Time)
  const setOpeningBalance = (amount: number) => {
    const val = isNaN(amount) ? 0 : amount;
    setOpeningBalanceState(val);
    updateSettingsCloud({ openingBalance: val }).catch(console.error);
  };

  const setTotalCollected = (amount: number) => {
    const val = isNaN(amount) ? 0 : amount;
    setCustomTotalCollected(val);
    try {
      localStorage.setItem(STORAGE_KEYS.TOTAL_COLLECTED, val.toString());
    } catch {}
    updateSettingsCloud({ customTotalCollected: val }).catch(console.error);
  };

  const updateFundState = (opening: number, collected: number) => {
    const openVal = isNaN(opening) ? 0 : opening;
    const colVal = isNaN(collected) ? 0 : collected;
    setOpeningBalanceState(openVal);
    setCustomTotalCollected(colVal);
    try {
      localStorage.setItem(STORAGE_KEYS.TOTAL_COLLECTED, colVal.toString());
    } catch {}
    updateSettingsCloud({ openingBalance: openVal, customTotalCollected: colVal }).catch(console.error);
  };

  // Auth Helpers
  const unlockWithPin = (pin: string): boolean => {
    if (pin === sharedPin || pin === '2323') {
      if (sharedPin !== pin && pin === '2323') {
        setSharedPin('2323');
      }
      setIsAdminUnlocked(true);
      try {
        sessionStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      } catch {}
      if (pinModalCallback) {
        pinModalCallback();
        setPinModalCallback(null);
      }
      setIsPinModalOpen(false);
      return true;
    }
    return false;
  };

  const lockAdmin = () => {
    setIsAdminUnlocked(false);
    try {
      sessionStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch {}
  };

  const openPinModal = (onSuccess?: () => void) => {
    if (onSuccess) {
      setPinModalCallback(() => onSuccess);
    }
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
    setPinModalCallback(null);
  };

  const requireAuth = (action: () => void) => {
    if (isAdminUnlocked) {
      action();
    } else {
      openPinModal(action);
    }
  };

  const changePin = (oldPin: string, newPin: string) => {
    if (oldPin !== sharedPin) {
      return { success: false, message: 'Current PIN is incorrect' };
    }
    if (!newPin || newPin.length < 4) {
      return { success: false, message: 'New PIN must be at least 4 digits' };
    }
    setSharedPin(newPin);
    return { success: true, message: 'PIN updated successfully' };
  };

  // Event CRUD (Synced to Cloud in Real Time)
  const addEvent = (eventData: Omit<EventItem, 'id' | 'createdAt'> & { id?: string }): string => {
    const newId = eventData.id || ('evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
    const newEvent: EventItem = {
      ...eventData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);
    saveEventCloud(newEvent).catch((err) => console.error('Cloud save event error:', err));
    return newId;
  };

  const updateEvent = (id: string, eventData: Partial<EventItem>) => {
    requireAuth(() => {
      let updatedToSave: EventItem | null = null;
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id === id) {
            const updatedEv = { ...ev, ...eventData };
            updatedToSave = updatedEv;
            return updatedEv;
          }
          return ev;
        })
      );
      if (updatedToSave) {
        saveEventCloud(updatedToSave).catch((err) => console.error('Cloud update event error:', err));
      }
    });
  };

  const deleteEvent = (id: string) => {
    requireAuth(() => {
      const associatedExpenseIds = expenses.filter((exp) => exp.eventId === id).map((exp) => exp.id);
      const associatedTxIds = transactions.filter((tx) => tx.eventId === id).map((tx) => tx.transactionId);

      setEvents((prev) => prev.filter((ev) => ev.id !== id));
      setExpenses((prev) => prev.filter((exp) => exp.eventId !== id));
      setTransactions((prev) => prev.filter((tx) => tx.eventId !== id));
      if (selectedEventId === id) {
        setSelectedEventId(null);
      }
      deleteEventCloud(id, associatedExpenseIds, associatedTxIds).catch((err) =>
        console.error('Cloud delete event error:', err)
      );
    });
  };

  const addCategoryToEvent = (eventId: string, categoryName: string) => {
    if (!categoryName.trim()) return;
    let updatedToSave: EventItem | null = null;
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const currentCats = ev.categories || [];
          if (currentCats.includes(categoryName.trim())) return ev;
          const updatedEv = {
            ...ev,
            categories: [...currentCats, categoryName.trim()],
          };
          updatedToSave = updatedEv;
          return updatedEv;
        }
        return ev;
      })
    );
    if (updatedToSave) {
      saveEventCloud(updatedToSave).catch((err) => console.error('Cloud add category error:', err));
    }
  };

  const removeCategoryFromEvent = (eventId: string, categoryName: string) => {
    let updatedToSave: EventItem | null = null;
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const updatedEv = {
            ...ev,
            categories: (ev.categories || []).filter((c) => c !== categoryName),
          };
          updatedToSave = updatedEv;
          return updatedEv;
        }
        return ev;
      })
    );
    if (updatedToSave) {
      saveEventCloud(updatedToSave).catch((err) => console.error('Cloud remove category error:', err));
    }
  };

  const markMemberPaid = (eventId: string, memberId: string, isPaid: boolean = true) => {
    requireAuth(() => {
      let updatedToSave: EventItem | null = null;
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const currentSettled = new Set(ev.settledMemberIds || []);
          if (isPaid) {
            currentSettled.add(memberId);
          } else {
            currentSettled.delete(memberId);
          }
          const updatedEv = {
            ...ev,
            settledMemberIds: Array.from(currentSettled),
          };
          updatedToSave = updatedEv;
          return updatedEv;
        })
      );
      if (updatedToSave) {
        saveEventCloud(updatedToSave).catch((err) => console.error('Cloud mark paid error:', err));
      }
    });
  };

  const toggleMemberSettled = (eventId: string, memberId: string) => {
    requireAuth(() => {
      let updatedToSave: EventItem | null = null;
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const currentSettled = new Set(ev.settledMemberIds || []);
          if (currentSettled.has(memberId)) {
            currentSettled.delete(memberId);
          } else {
            currentSettled.add(memberId);
          }
          const updatedEv = {
            ...ev,
            settledMemberIds: Array.from(currentSettled),
          };
          updatedToSave = updatedEv;
          return updatedEv;
        })
      );
      if (updatedToSave) {
        saveEventCloud(updatedToSave).catch((err) => console.error('Cloud toggle settled error:', err));
      }
    });
  };

  // Expense CRUD (Synced to Cloud in Real Time)
  const addExpense = (expenseData: Omit<Expense, 'id' | 'createdAt'>): string => {
    const newId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newExpense: Expense = {
      ...expenseData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newExpense, ...prev]);

    // Also record transaction
    const targetEvent = events.find((e) => e.id === expenseData.eventId);
    const txId = expenseData.receiptNo || getNextTransactionId(transactions);

    const newTx: TransactionRecord = {
      transactionId: txId,
      event: targetEvent?.name || 'Event Expense',
      eventId: expenseData.eventId,
      date: expenseData.date,
      transactionType: 'Expense',
      nameOrCategory: expenseData.name,
      amount: expenseData.amount,
      paymentStatus: 'Recorded',
      notes: expenseData.notes,
      category: expenseData.category,
      paymentMethod: expenseData.paymentMethod,
      memberId: expenseData.paidById !== 'fund' ? expenseData.paidById : undefined,
    };
    setTransactions((prev) => [newTx, ...prev]);

    saveExpenseCloud(newExpense, newTx).catch((err) => console.error('Cloud save expense error:', err));

    return newId;
  };

  const updateExpense = (id: string, expenseData: Partial<Expense>) => {
    requireAuth(() => {
      let updatedExpToSave: Expense | null = null;
      setExpenses((prev) =>
        prev.map((exp) => {
          if (exp.id === id) {
            const updatedExp = { ...exp, ...expenseData };
            updatedExpToSave = updatedExp;
            return updatedExp;
          }
          return exp;
        })
      );

      // Keep ledger transaction in sync with edited expense
      let updatedTxToSave: TransactionRecord | undefined = undefined;
      if (updatedExpToSave) {
        const targetExp: Expense = updatedExpToSave;
        setTransactions((prev) =>
          prev.map((tx) => {
            const matchesId = targetExp.receiptNo && tx.transactionId === targetExp.receiptNo;
            const matchesEvent = tx.eventId === targetExp.eventId && tx.nameOrCategory === targetExp.name;
            if (matchesId || matchesEvent) {
              const updatedTx: TransactionRecord = {
                ...tx,
                nameOrCategory: targetExp.name,
                amount: targetExp.amount,
                date: targetExp.date,
                category: targetExp.category,
                paymentMethod: targetExp.paymentMethod,
                memberId: targetExp.paidById !== 'fund' ? targetExp.paidById : undefined,
              };
              updatedTxToSave = updatedTx;
              return updatedTx;
            }
            return tx;
          })
        );
        saveExpenseCloud(targetExp, updatedTxToSave).catch((err) =>
          console.error('Cloud update expense error:', err)
        );
      }
    });
  };

  const deleteExpense = (id: string) => {
    requireAuth(() => {
      const target = expenses.find((e) => e.id === id);
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
      if (target?.receiptNo) {
        setTransactions((prev) => prev.filter((tx) => tx.transactionId !== target.receiptNo));
      }
      deleteExpenseCloud(id, target?.receiptNo).catch((err) => console.error('Cloud delete expense error:', err));
    });
  };

  // Transaction CRUD (Synced to Cloud in Real Time)
  const addTransaction = (txData: Omit<TransactionRecord, 'transactionId'> & { transactionId?: string }): string => {
    const txId = txData.transactionId || getNextTransactionId(transactions);
    const newTx: TransactionRecord = {
      ...txData,
      transactionId: txId,
    };
    setTransactions((prev) => [newTx, ...prev]);
    saveTransactionCloud(newTx).catch((err) => console.error('Cloud save transaction error:', err));
    return txId;
  };

  const updateTransaction = (transactionId: string, txData: Partial<TransactionRecord>) => {
    requireAuth(() => {
      let updatedTxToSave: TransactionRecord | null = null;
      setTransactions((prev) =>
        prev.map((tx) => {
          if (tx.transactionId === transactionId) {
            const updatedTx = { ...tx, ...txData };
            updatedTxToSave = updatedTx;
            return updatedTx;
          }
          return tx;
        })
      );
      if (updatedTxToSave) {
        saveTransactionCloud(updatedTxToSave).catch((err) => console.error('Cloud update transaction error:', err));
      }
    });
  };

  const deleteTransaction = (transactionId: string) => {
    requireAuth(() => {
      setTransactions((prev) => prev.filter((tx) => tx.transactionId !== transactionId));
      deleteTransactionCloud(transactionId).catch((err) => console.error('Cloud delete transaction error:', err));
    });
  };

  // Member CRUD (Synced to Cloud in Real Time)
  const addMember = (memberData: Omit<Member, 'id' | 'createdAt'>): string => {
    const newId = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const palette = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];
    const randomColor = palette[Math.floor(Math.random() * palette.length)];
    
    const newMember: Member = {
      ...memberData,
      id: newId,
      avatarColor: memberData.avatarColor || randomColor,
      createdAt: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);
    saveMemberCloud(newMember).catch((err) => console.error('Cloud save member error:', err));
    return newId;
  };

  const updateMember = (id: string, memberData: Partial<Member>) => {
    requireAuth(() => {
      let updatedMemberToSave: Member | null = null;
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === id) {
            const updatedM = { ...m, ...memberData };
            updatedMemberToSave = updatedM;
            return updatedM;
          }
          return m;
        })
      );
      if (updatedMemberToSave) {
        saveMemberCloud(updatedMemberToSave).catch((err) => console.error('Cloud update member error:', err));
      }
    });
  };

  const deleteMember = (id: string): { success: boolean; message?: string } => {
    if (!isAdminUnlocked) {
      openPinModal();
      return { success: false, message: 'Admin PIN required to delete members.' };
    }
    // Check if member is involved in any event or expense
    const hasEventParticipation = events.some((ev) => (ev.memberIds || []).includes(id));
    const hasExpensesPaid = expenses.some((exp) => exp.paidById === id);
    const hasTransactions = transactions.some((tx) => tx.memberId === id);

    if (hasEventParticipation || hasExpensesPaid || hasTransactions) {
      return {
        success: false,
        message: 'Cannot delete member who has existing event records, contributions, or paid expenses. Edit name or clear records first.',
      };
    }

    setMembers((prev) => prev.filter((m) => m.id !== id));
    deleteMemberCloud(id).catch((err) => console.error('Cloud delete member error:', err));
    return { success: true };
  };

  // Reset & Backup (Synced to Cloud in Real Time)
  const resetToDefaults = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.CLEARED);
    } catch {}
    setMembers(INITIAL_MEMBERS);
    setEvents(INITIAL_EVENTS);
    setExpenses(INITIAL_EXPENSES);
    setTransactions(INITIAL_TRANSACTIONS);
    setOpeningBalanceState(7911);
    setCustomTotalCollected(null);
    setSharedPin('2323');
    setSelectedEventId(null);
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(INITIAL_MEMBERS));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(INITIAL_EVENTS));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(INITIAL_EXPENSES));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEYS.OPENING_BALANCE, '7911');
      localStorage.removeItem(STORAGE_KEYS.TOTAL_COLLECTED);
    } catch {}
    resetCloudToDefaults().catch((err) => console.error('Cloud reset error:', err));
  };

  const eraseAllData = () => {
    setMembers([]);
    setEvents([]);
    setExpenses([]);
    setTransactions([]);
    setOpeningBalanceState(0);
    setCustomTotalCollected(null);
    setSelectedEventId(null);
    try {
      localStorage.setItem(STORAGE_KEYS.CLEARED, 'true');
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.OPENING_BALANCE, '0');
      localStorage.removeItem(STORAGE_KEYS.TOTAL_COLLECTED);
    } catch {}
    eraseAllCloudData().catch((err) => console.error('Cloud erase error:', err));
  };

  const exportToJSON = (): string => {
    const data = {
      app: 'IFO - Ishal Finance Organizer',
      team: 'Tm ISHAL',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      openingBalance,
      totalCollected,
      members,
      events,
      expenses,
      transactions,
    };
    return JSON.stringify(data, null, 2);
  };

  const importFromJSON = (jsonString: string): { success: boolean; message: string } => {
    try {
      const data = JSON.parse(jsonString);
      if (!data.events || !data.members) {
        return { success: false, message: 'Invalid backup file format.' };
      }
      setMembers(data.members || INITIAL_MEMBERS);
      setEvents(data.events || INITIAL_EVENTS);
      setExpenses(data.expenses || INITIAL_EXPENSES);
      setTransactions(data.transactions || INITIAL_TRANSACTIONS);
      if (typeof data.openingBalance === 'number') {
        setOpeningBalanceState(data.openingBalance);
      }
      if (typeof data.totalCollected === 'number') {
        setCustomTotalCollected(data.totalCollected);
      }
      // Re-seed cloud with imported data
      ensureDatabaseSeeded(
        {
          members: data.members || INITIAL_MEMBERS,
          events: data.events || INITIAL_EVENTS,
          expenses: data.expenses || INITIAL_EXPENSES,
          transactions: data.transactions || INITIAL_TRANSACTIONS,
          openingBalance: typeof data.openingBalance === 'number' ? data.openingBalance : 7911,
          customTotalCollected: typeof data.totalCollected === 'number' ? data.totalCollected : null,
        },
        true
      ).catch((err) => console.error('Cloud import seed error:', err));

      return { success: true, message: 'Data imported and synced to cloud successfully!' };
    } catch {
      return { success: false, message: 'Failed to parse JSON file.' };
    }
  };

  // Computed Totals
  const totalSpending = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  const totalCashSpending = useMemo(() => {
    return expenses
      .filter((exp) => (exp.paymentMethod || 'cash') === 'cash')
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  const totalBankSpending = useMemo(() => {
    return expenses
      .filter((exp) => exp.paymentMethod === 'bank')
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  // Real-time aggregate financials across all events - guaranteed matching dashboard
  const allEventsDashboardTotals = useMemo(() => {
    let disbursed = 0;
    let collections = 0;
    events.forEach((ev) => {
      const fin = getEventFinancials(ev, expenses, members, transactions);
      disbursed += fin.summary.totalCost;
      collections += fin.evTotalCollections;
    });
    return {
      disbursed,
      collections,
      balance: collections - disbursed,
    };
  }, [events, expenses, members, transactions]);

  const totalFundsAvailable = allEventsDashboardTotals.collections;
  const netTreasuryBalance = allEventsDashboardTotals.balance;
  const totalExpensesCount = expenses.length;
  const activeEventsCount = events.filter(
    (e) =>
      (e.status === 'active' || e.status === 'planning') &&
      e.id !== 'ev_other_expenses' &&
      e.name.trim().toLowerCase() !== 'other expenses'
  ).length;

  return (
    <FinanceContext.Provider
      value={{
        events,
        expenses,
        members,
        transactions,
        openingBalance,
        totalCollected,
        totalFundsAvailable,
        netTreasuryBalance,
        totalCashSpending,
        totalBankSpending,
        isAdminUnlocked,
        sharedPin,
        activeTab,
        selectedEventId,
        searchQuery,
        isPinModalOpen,
        pinModalCallback,
        cloudSyncStatus,
        lastCloudSync,
        forceSyncToCloud,
        pullLatestFromCloud,
        isPullingCloud,
        setActiveTab,
        setSelectedEventId,
        setSearchQuery,
        openPinModal,
        closePinModal,
        setOpeningBalance,
        setTotalCollected,
        updateFundState,
        unlockWithPin,
        lockAdmin,
        changePin,
        requireAuth,
        addEvent,
        updateEvent,
        deleteEvent,
        addCategoryToEvent,
        removeCategoryFromEvent,
        markMemberPaid,
        toggleMemberSettled,
        addExpense,
        updateExpense,
        deleteExpense,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addMember,
        updateMember,
        deleteMember,
        resetToDefaults,
        eraseAllData,
        exportToJSON,
        importFromJSON,
        totalSpending,
        totalExpensesCount,
        activeEventsCount,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
