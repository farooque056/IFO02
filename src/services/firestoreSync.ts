import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  onSnapshot,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { EventItem, Expense, Member, TransactionRecord } from '../types';
import {
  INITIAL_EVENTS,
  INITIAL_EXPENSES,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_OPENING_BALANCE,
  INITIAL_TOTAL_COLLECTED,
} from '../data/initialData';

export type CloudSyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface CloudSettings {
  openingBalance: number;
  customTotalCollected: number | null;
  updatedAt?: string;
  seeded?: boolean;
}

/**
 * Remove undefined values to comply with Firestore requirements
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean as T;
}

/**
 * Check if the Firestore database is already seeded with data.
 * If not, seeds all initial members, events, expenses, transactions, and settings in an atomic batch.
 */
export async function ensureDatabaseSeeded(
  fallbackData?: {
    members?: Member[];
    events?: EventItem[];
    expenses?: Expense[];
    transactions?: TransactionRecord[];
    openingBalance?: number;
    customTotalCollected?: number | null;
  },
  forceReSeed: boolean = false
): Promise<boolean> {
  try {
    const settingsDocRef = doc(db, 'settings', 'global');
    
    if (!forceReSeed) {
      const settingsSnap = await getDoc(settingsDocRef);

      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data();
        if (settingsData?.cleared || settingsData?.seeded) {
          // Already seeded or explicitly cleared
          return false;
        }
      }

      // Check if transactions collection has any documents
      const txCol = collection(db, 'transactions');
      const txSnap = await getDocs(txCol);
      if (!txSnap.empty) {
        // Database already has transactions, mark settings as seeded
        await setDoc(
          settingsDocRef,
          {
            seeded: true,
            openingBalance: fallbackData?.openingBalance ?? 7911,
            customTotalCollected: fallbackData?.customTotalCollected ?? null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        return false;
      }
    }

    // Need initial seeding! Use provided fallback (e.g. from local device) or INITIAL data
    const membersToSeed = (fallbackData?.members && fallbackData.members.length > 0)
      ? fallbackData.members
      : INITIAL_MEMBERS;

    const eventsToSeed = (fallbackData?.events && fallbackData.events.length > 0)
      ? fallbackData.events
      : INITIAL_EVENTS;

    const expensesToSeed = (fallbackData?.expenses && fallbackData.expenses.length > 0)
      ? fallbackData.expenses
      : INITIAL_EXPENSES;

    const transactionsToSeed = (fallbackData?.transactions && fallbackData.transactions.length > 0)
      ? fallbackData.transactions
      : INITIAL_TRANSACTIONS;

    // Chunk batch writes safely (Firestore max 500 operations per batch)
    const writeOperations: ((b: ReturnType<typeof writeBatch>) => void)[] = [];

    membersToSeed.forEach((m) => {
      writeOperations.push((b) => b.set(doc(db, 'members', m.id), sanitizeForFirestore(m)));
    });

    eventsToSeed.forEach((e) => {
      writeOperations.push((b) => b.set(doc(db, 'events', e.id), sanitizeForFirestore(e)));
    });

    expensesToSeed.forEach((exp) => {
      writeOperations.push((b) => b.set(doc(db, 'expenses', exp.id), sanitizeForFirestore(exp)));
    });

    transactionsToSeed.forEach((tx) => {
      writeOperations.push((b) => b.set(doc(db, 'transactions', tx.transactionId), sanitizeForFirestore(tx)));
    });

    writeOperations.push((b) =>
      b.set(settingsDocRef, {
        seeded: true,
        openingBalance: fallbackData?.openingBalance ?? 7911,
        customTotalCollected: fallbackData?.customTotalCollected ?? null,
        updatedAt: new Date().toISOString(),
      })
    );

    const BATCH_SIZE = 400;
    for (let i = 0; i < writeOperations.length; i += BATCH_SIZE) {
      const b = writeBatch(db);
      const chunk = writeOperations.slice(i, i + BATCH_SIZE);
      chunk.forEach((op) => op(b));
      await b.commit();
    }

    return true;
  } catch (error) {
    console.error('Error seeding initial Firestore database:', error);
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      try {
        handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      } catch (err) {
        console.error('Formatted Firestore permission error:', err);
      }
    }
    return false;
  }
}

/**
 * Explicit one-shot pull from Firestore server to ensure immediate cross-device sync.
 * Queries Firestore server directly so any changes made on other phones are instantly fetched.
 */
export async function fetchLatestFromCloud(): Promise<{
  members: Member[];
  events: EventItem[];
  expenses: Expense[];
  transactions: TransactionRecord[];
  settings: CloudSettings | null;
}> {
  try {
    let membersSnap, eventsSnap, expensesSnap, txSnap, settingsSnap;
    try {
      [membersSnap, eventsSnap, expensesSnap, txSnap, settingsSnap] = await Promise.all([
        getDocsFromServer(collection(db, 'members')),
        getDocsFromServer(collection(db, 'events')),
        getDocsFromServer(collection(db, 'expenses')),
        getDocsFromServer(collection(db, 'transactions')),
        getDocFromServer(doc(db, 'settings', 'global')),
      ]);
    } catch {
      // Fallback to cache/standard read if server long-polling is temporarily interrupted
      [membersSnap, eventsSnap, expensesSnap, txSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'members')),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'expenses')),
        getDocs(collection(db, 'transactions')),
        getDoc(doc(db, 'settings', 'global')),
      ]);
    }

    const membersList: Member[] = [];
    membersSnap.forEach((d) => membersList.push(d.data() as Member));
    membersList.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    const eventsList: EventItem[] = [];
    eventsSnap.forEach((d) => eventsList.push(d.data() as EventItem));
    eventsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const expensesList: Expense[] = [];
    expensesSnap.forEach((d) => expensesList.push(d.data() as Expense));
    expensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const txList: TransactionRecord[] = [];
    txSnap.forEach((d) => txList.push(d.data() as TransactionRecord));
    txList.sort((a, b) => {
      const numA = parseInt(a.transactionId.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.transactionId.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    let settingsData: CloudSettings | null = null;
    if (settingsSnap.exists()) {
      const s = settingsSnap.data() as CloudSettings;
      settingsData = {
        openingBalance: typeof s.openingBalance === 'number' ? s.openingBalance : 7911,
        customTotalCollected: s.customTotalCollected ?? null,
        updatedAt: s.updatedAt,
        seeded: s.seeded,
      };
    }

    return {
      members: membersList,
      events: eventsList,
      expenses: expensesList,
      transactions: txList,
      settings: settingsData,
    };
  } catch (error) {
    console.error('Error fetching latest from cloud:', error);
    throw error;
  }
}

/**
 * Real-time subscribers for global state across all phones.
 * Automatically recovers from mobile background sleep, network switches, and errors.
 */
export function subscribeToCloudSync(callbacks: {
  onMembers: (members: Member[]) => void;
  onEvents: (events: EventItem[]) => void;
  onExpenses: (expenses: Expense[]) => void;
  onTransactions: (transactions: TransactionRecord[]) => void;
  onSettings: (settings: CloudSettings) => void;
  onStatusChange: (status: CloudSyncStatus) => void;
}): Unsubscribe {
  let unsubscribers: Unsubscribe[] = [];
  let isSubscribed = true;
  let retryTimeoutId: any = null;

  const startListeners = () => {
    // Teardown previous listeners before rebinding
    unsubscribers.forEach((u) => {
      try {
        u();
      } catch {}
    });
    unsubscribers = [];

    callbacks.onStatusChange('syncing');

    const handleListenerError = (colName: string, err: any) => {
      console.warn(`${colName} cloud subscription error:`, err);
      if (!isSubscribed) return;
      callbacks.onStatusChange('error');
      // Automatic recovery after connection glitch or mobile sleep
      if (!retryTimeoutId) {
        retryTimeoutId = setTimeout(() => {
          retryTimeoutId = null;
          if (isSubscribed) {
            console.log(`Re-establishing real-time cloud listeners for ${colName}...`);
            startListeners();
          }
        }, 3500);
      }
    };

    try {
      // 1. Members listener
      const unsubMembers = onSnapshot(
        collection(db, 'members'),
        (snapshot) => {
          const membersList: Member[] = [];
          snapshot.forEach((docSnap) => {
            membersList.push(docSnap.data() as Member);
          });
          membersList.sort((a, b) => {
            const numA = parseInt(a.id.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.id.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });
          callbacks.onMembers(membersList);
          callbacks.onStatusChange('connected');
        },
        (err) => handleListenerError('Members', err)
      );
      unsubscribers.push(unsubMembers);

      // 2. Events listener
      const unsubEvents = onSnapshot(
        collection(db, 'events'),
        (snapshot) => {
          const eventsList: EventItem[] = [];
          snapshot.forEach((docSnap) => {
            eventsList.push(docSnap.data() as EventItem);
          });
          eventsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          callbacks.onEvents(eventsList);
          callbacks.onStatusChange('connected');
        },
        (err) => handleListenerError('Events', err)
      );
      unsubscribers.push(unsubEvents);

      // 3. Expenses listener
      const unsubExpenses = onSnapshot(
        collection(db, 'expenses'),
        (snapshot) => {
          const expensesList: Expense[] = [];
          snapshot.forEach((docSnap) => {
            expensesList.push(docSnap.data() as Expense);
          });
          expensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          callbacks.onExpenses(expensesList);
          callbacks.onStatusChange('connected');
        },
        (err) => handleListenerError('Expenses', err)
      );
      unsubscribers.push(unsubExpenses);

      // 4. Transactions listener
      const unsubTransactions = onSnapshot(
        collection(db, 'transactions'),
        (snapshot) => {
          const txList: TransactionRecord[] = [];
          snapshot.forEach((docSnap) => {
            txList.push(docSnap.data() as TransactionRecord);
          });
          txList.sort((a, b) => {
            const numA = parseInt(a.transactionId.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.transactionId.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
          });
          callbacks.onTransactions(txList);
          callbacks.onStatusChange('connected');
        },
        (err) => handleListenerError('Transactions', err)
      );
      unsubscribers.push(unsubTransactions);

      // 5. Settings listener
      const unsubSettings = onSnapshot(
        doc(db, 'settings', 'global'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as CloudSettings;
            callbacks.onSettings({
              openingBalance: typeof data.openingBalance === 'number' ? data.openingBalance : 7911,
              customTotalCollected: data.customTotalCollected ?? null,
              updatedAt: data.updatedAt,
              seeded: data.seeded,
            });
            callbacks.onStatusChange('connected');
          }
        },
        (err) => handleListenerError('Settings', err)
      );
      unsubscribers.push(unsubSettings);
    } catch (e) {
      console.error('Error starting cloud sync listeners:', e);
      callbacks.onStatusChange('error');
    }
  };

  startListeners();

  // Mobile OS lifecycle events: when user unlocks phone or switches back to tab
  const onVisibilityOrFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && isSubscribed) {
      startListeners();
    }
  };

  const onOnline = () => {
    if (isSubscribed) {
      startListeners();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityOrFocus);
    }
  }

  return () => {
    isSubscribed = false;
    if (retryTimeoutId) clearTimeout(retryTimeoutId);
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVisibilityOrFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      }
    }
  };
}

/**
 * Cloud mutation methods for real-time writes
 */
export async function saveMemberCloud(member: Member): Promise<void> {
  try {
    await setDoc(doc(db, 'members', member.id), sanitizeForFirestore(member), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `members/${member.id}`);
  }
}

export async function deleteMemberCloud(memberId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'members', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `members/${memberId}`);
  }
}

export async function saveEventCloud(event: EventItem): Promise<void> {
  try {
    await setDoc(doc(db, 'events', event.id), sanitizeForFirestore(event), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `events/${event.id}`);
  }
}

export async function deleteEventCloud(
  eventId: string,
  associatedExpenseIds: string[] = [],
  associatedTxIds: string[] = []
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events', eventId));

    associatedExpenseIds.forEach((expId) => {
      batch.delete(doc(db, 'expenses', expId));
    });

    associatedTxIds.forEach((txId) => {
      batch.delete(doc(db, 'transactions', txId));
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `events/${eventId}`);
  }
}

export async function saveExpenseCloud(expense: Expense, tx?: TransactionRecord): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'expenses', expense.id), sanitizeForFirestore(expense), { merge: true });
    if (tx) {
      batch.set(doc(db, 'transactions', tx.transactionId), sanitizeForFirestore(tx), { merge: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `expenses/${expense.id}`);
  }
}

export async function deleteExpenseCloud(expenseId: string, receiptNo?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'expenses', expenseId));
    if (receiptNo) {
      batch.delete(doc(db, 'transactions', receiptNo));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseId}`);
  }
}

export async function saveTransactionCloud(tx: TransactionRecord): Promise<void> {
  try {
    await setDoc(doc(db, 'transactions', tx.transactionId), sanitizeForFirestore(tx), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${tx.transactionId}`);
  }
}

export async function deleteTransactionCloud(transactionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${transactionId}`);
  }
}

export async function updateSettingsCloud(settings: Partial<CloudSettings>): Promise<void> {
  try {
    await setDoc(
      doc(db, 'settings', 'global'),
      {
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/global');
  }
}

/**
 * Resets Firestore database to baseline data
 */
export async function resetCloudToDefaults(): Promise<void> {
  const batch = writeBatch(db);

  // Overwrite members
  INITIAL_MEMBERS.forEach((m) => {
    batch.set(doc(db, 'members', m.id), sanitizeForFirestore(m));
  });

  // Overwrite events
  INITIAL_EVENTS.forEach((e) => {
    batch.set(doc(db, 'events', e.id), sanitizeForFirestore(e));
  });

  // Overwrite expenses
  INITIAL_EXPENSES.forEach((exp) => {
    batch.set(doc(db, 'expenses', exp.id), sanitizeForFirestore(exp));
  });

  // Overwrite transactions
  INITIAL_TRANSACTIONS.forEach((tx) => {
    batch.set(doc(db, 'transactions', tx.transactionId), sanitizeForFirestore(tx));
  });

  // Overwrite settings
  batch.set(doc(db, 'settings', 'global'), {
    seeded: true,
    cleared: false,
    openingBalance: INITIAL_OPENING_BALANCE,
    customTotalCollected: INITIAL_TOTAL_COLLECTED,
    updatedAt: new Date().toISOString(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'resetCloudToDefaults');
  }
}

/**
 * Completely erases all records (events, expenses, transactions, members) from Firestore database
 */
export async function eraseAllCloudData(): Promise<void> {
  try {
    const collectionsToClear = ['events', 'expenses', 'transactions', 'members'];
    
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        for (const docSnap of snap.docs) {
          batch.delete(docSnap.ref);
          count++;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
    }

    // Set settings/global to mark database as explicitly cleared
    await setDoc(doc(db, 'settings', 'global'), {
      seeded: true,
      cleared: true,
      openingBalance: 0,
      customTotalCollected: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'eraseAllCloudData');
  }
}
