export type EventType = 
  | 'wedding' 
  | 'iftar' 
  | 'picnic' 
  | 'eid' 
  | 'sports' 
  | 'meeting' 
  | 'party' 
  | 'custom';

export type PaymentMethod = 'cash' | 'bank';

export interface Member {
  id: string;
  name: string;
  phone?: string;
  role?: string; // e.g., "Coordinator", "Core Member", "Treasurer"
  avatarColor?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  eventId: string;
  name: string;
  category: string;
  amount: number; // in INR ₹
  date: string;
  paidById: string; // Member ID or 'fund' for Tm ISHAL Group Fund
  paymentMethod?: PaymentMethod; // 'cash' | 'bank'
  notes?: string;
  receiptNo?: string;
  createdAt: string;
}

export type EventStatus = 'active' | 'completed' | 'hold' | 'planning';
export type EventSplitMode = 'even' | 'minimum'; // 'even' = Particular amount split evenly, 'minimum' = Minimum amount per person with donations allowed

export interface EventItem {
  id: string;
  name: string;
  type: EventType;
  date: string;
  location?: string;
  status: EventStatus;
  weddingPersonId?: string; // Member ID of the team member getting married (exempt from cost split)
  exemptMemberIds?: string[]; // Array of member IDs exempt from splitting costs
  memberIds: string[]; // Participated members
  settledMemberIds?: string[]; // Array of member IDs who have paid / settled their dues
  categories: string[]; // Custom categories for this event
  splitMode?: EventSplitMode; // 'even' (particular amount split evenly) or 'minimum' (minimum per person + donation)
  targetSplitAmount?: number; // For 'even' mode: optional custom particular amount to split (defaults to total expenses)
  minimumAmountPerPerson?: number; // For 'minimum' mode: minimum required per person (donations can exceed this)
  notes?: string;
  createdAt: string;
}

export interface UnpaidMemberDetail {
  memberId: string;
  memberName: string;
  phone?: string;
  role?: string;
  totalPaid: number;
  expectedShare: number;
  amountOwed: number; // strictly positive value representing unpaid amount
  minimumRequired?: number;
}

export interface EventFinancialSummary {
  eventId: string;
  totalCost: number;
  totalExpensesCount: number;
  memberCount: number;
  splittingMemberCount: number;
  exemptMemberCount: number;
  weddingPersonId?: string;
  weddingPersonName?: string;
  splitMode: EventSplitMode;
  targetSplitAmount?: number;
  minimumAmountPerPerson?: number;
  totalMinimumTarget?: number; // For 'minimum' mode: minimumAmountPerPerson * splittingMemberCount
  totalDonations: number; // Total voluntary donations above expected share/minimum
  totalMemberPayments: number; // Total payments collected from members
  perMemberCost: number;
  categoryBreakdown: { category: string; amount: number; percentage: number; count: number }[];
  memberSettlement: {
    memberId: string;
    memberName: string;
    phone?: string;
    role?: string;
    totalPaid: number;
    expectedShare: number;
    extraDonation: number; // excess paid beyond expected share/minimum
    isDonor: boolean; // paid more than expectedShare/minimum
    netBalance: number; // positive = paid more (to be reimbursed or donated), negative = owes money
    status: 'paid' | 'unpaid' | 'settled' | 'exempt';
    isExemptFromSplit?: boolean;
    isWeddingPerson?: boolean;
  }[];
  fundPaidAmount: number;
  cashTotal: number;
  bankTotal: number;
  unpaidMembers: UnpaidMemberDetail[];
  totalUnpaidAmount: number;
  paidMembersCount: number;
  unpaidMembersCount: number;
}

export interface FundState {
  openingBalance: number;
  totalCollected: number;
}

export type TabType = 'dashboard' | 'events' | 'members' | 'transactions';

export type TransactionType = 'Contribution' | 'Expense' | 'Opening Balance';
export type TransactionStatus = 'Paid' | 'Unpaid' | 'Recorded';

export interface TransactionRecord {
  transactionId: string; // e.g. "TX001"
  event: string; // Event name
  eventId: string;
  date: string;
  transactionType: TransactionType;
  nameOrCategory: string; // Member name or Expense item
  amount: number; // INR
  paymentStatus: TransactionStatus;
  notes?: string;
  runningBalance?: number;
  memberId?: string;
  category?: string;
  paymentMethod?: PaymentMethod;
  createdAt?: string;
}

export type Transaction = TransactionRecord;
export type Event = EventItem;
