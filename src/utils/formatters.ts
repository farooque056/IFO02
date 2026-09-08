import { EventFinancialSummary, EventItem, EventSplitMode, Expense, Member, TransactionRecord } from '../types';

export function formatINR(amount: number, showDecimals = false): string {
  if (isNaN(amount)) return '₹0';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0,
  });
  return formatter.format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function isMemberExemptFromEvent(
  event: EventItem,
  memberId: string,
  members: Member[] = []
): boolean {
  if (!event || !memberId) return false;

  // Other Expenses fund is non-split
  if (
    event.id === 'ev_other_expenses' ||
    event.name.trim().toLowerCase() === 'other expenses' ||
    event.name.toLowerCase().includes('other expense')
  ) {
    return true;
  }

  // Explicit wedding person ID
  if (event.weddingPersonId && event.weddingPersonId === memberId) {
    return true;
  }

  // Explicit exempt member IDs list
  if (event.exemptMemberIds && Array.isArray(event.exemptMemberIds) && event.exemptMemberIds.includes(memberId)) {
    return true;
  }

  // Auto-detection: if event is wedding or related celebration and title contains member's name
  const evNameLower = (event.name || '').toLowerCase();
  if (
    event.type === 'wedding' ||
    evNameLower.includes('wedding') ||
    evNameLower.includes('marriage') ||
    evNameLower.includes('nikah')
  ) {
    const member = members.find((m) => m.id === memberId);
    if (member && member.name) {
      const mNameLower = member.name.toLowerCase().trim();
      if (
        evNameLower.includes(mNameLower) ||
        evNameLower.startsWith(mNameLower)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function calculateEventSummary(
  event: EventItem,
  expenses: Expense[],
  members: Member[],
  transactions: TransactionRecord[] = []
): EventFinancialSummary {
  const eventExpenses = expenses.filter((e) => e.eventId === event.id);
  const totalCost = eventExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const allMemberIds = event.memberIds || [];
  const memberCount = allMemberIds.length;

  // Identify exempt members (e.g. team member getting married who shouldn't have costs split to them)
  const isOtherExpenses =
    event.id === 'ev_other_expenses' ||
    event.name.trim().toLowerCase() === 'other expenses' ||
    event.name.toLowerCase().includes('other expense');

  const exemptIds = new Set<string>();
  if (event.weddingPersonId) {
    exemptIds.add(event.weddingPersonId);
  }
  if (event.exemptMemberIds && Array.isArray(event.exemptMemberIds)) {
    event.exemptMemberIds.forEach((id) => exemptIds.add(id));
  }
  if (isOtherExpenses) {
    allMemberIds.forEach((id) => exemptIds.add(id));
  }

  // Check all members with isMemberExemptFromEvent
  allMemberIds.forEach((mId) => {
    if (isMemberExemptFromEvent(event, mId, members)) {
      exemptIds.add(mId);
    }
  });

  // Find wedding person name if available
  let resolvedWeddingPersonId = event.weddingPersonId;
  let weddingPersonMember = resolvedWeddingPersonId
    ? members.find((m) => m.id === resolvedWeddingPersonId)
    : undefined;

  if (!weddingPersonMember) {
    const detectedId = Array.from(exemptIds).find((id) => id !== 'ev_other_expenses');
    if (detectedId) {
      weddingPersonMember = members.find((m) => m.id === detectedId);
      if (weddingPersonMember) {
        resolvedWeddingPersonId = detectedId;
      }
    }
  }
  const weddingPersonName = weddingPersonMember?.name;

  // Splitting members are participating members who are NOT exempt
  const splittingMemberIds = allMemberIds.filter((id) => !exemptIds.has(id));
  const splittingMemberCount = splittingMemberIds.length;
  const exemptMemberCount = allMemberIds.filter((id) => exemptIds.has(id)).length;

  // Split Mode determination
  // 1. 'even': Split a particular target amount OR total actual expenses evenly among members
  // 2. 'minimum': Minimum floor amount per person (members can voluntarily donate more)
  let splitMode: EventSplitMode = event.splitMode || 'even';
  let minimumAmountPerPerson = Number(event.minimumAmountPerPerson) || 0;
  let targetSplitAmount = Number(event.targetSplitAmount) || 0;

  // Domain defaults / auto-detection for known events or events with voluntary donations
  if (event.id === 'ev_taawun_2026' || event.name.toLowerCase().includes('taawun')) {
    splitMode = 'minimum';
    if (!minimumAmountPerPerson) {
      minimumAmountPerPerson = 2000;
    }
  } else if (event.id === 'ev_iftar_2026' || event.name.toLowerCase().includes('iftar')) {
    if (!minimumAmountPerPerson && !targetSplitAmount) {
      splitMode = 'minimum';
      minimumAmountPerPerson = 500;
    }
  } else if (event.id === 'ev_premier_league_2027' || event.id === 'ev_premier_league_2026' || event.name.toLowerCase().includes('premier league')) {
    if (!minimumAmountPerPerson && !targetSplitAmount) {
      splitMode = 'minimum';
      minimumAmountPerPerson = 300;
    }
  } else if (event.id === 'ev_ameen_wedding' || event.name.toLowerCase().includes("ameen's wedding")) {
    if (!targetSplitAmount) {
      targetSplitAmount = 32000;
    }
  }

  // If splitMode is not explicitly minimum, but there are transactions where some members donated more:
  // Determine if there is a common base contribution amount with voluntary extra donors
  if (splitMode === 'even' && targetSplitAmount === 0 && transactions && transactions.length > 0) {
    const eventTxAmounts = transactions
      .filter((tx) => {
        const matchesEvent = tx.eventId === event.id || (tx.event && tx.event.toLowerCase() === event.name.toLowerCase());
        const isContrib = tx.transactionType === 'Contribution' || (tx.category && tx.category.toLowerCase().includes('contribution'));
        const isPaid = !tx.paymentStatus || tx.paymentStatus === 'Paid' || tx.paymentStatus === 'Recorded';
        return matchesEvent && isContrib && isPaid && Number(tx.amount) > 0;
      })
      .map((tx) => Number(tx.amount));

    if (eventTxAmounts.length > 0) {
      const freq: Record<number, number> = {};
      eventTxAmounts.forEach((amt) => {
        freq[amt] = (freq[amt] || 0) + 1;
      });
      let maxCount = 0;
      let modalAmt = 0;
      Object.entries(freq).forEach(([amtStr, count]) => {
        if (count > maxCount) {
          maxCount = count;
          modalAmt = Number(amtStr);
        }
      });
      const hasDonors = eventTxAmounts.some((amt) => amt > modalAmt);
      if (hasDonors && modalAmt > 0) {
        splitMode = 'minimum';
        minimumAmountPerPerson = modalAmt;
      }
    }
  }

  let perMemberCost = 0;
  let totalMinimumTarget: number | undefined = undefined;

  if (isOtherExpenses) {
    perMemberCost = 0;
    totalMinimumTarget = undefined;
  } else if (splitMode === 'minimum' && minimumAmountPerPerson > 0) {
    perMemberCost = minimumAmountPerPerson;
    totalMinimumTarget = minimumAmountPerPerson * splittingMemberCount;
  } else if (splitMode === 'even' && targetSplitAmount > 0) {
    perMemberCost = splittingMemberCount > 0 ? Math.round(targetSplitAmount / splittingMemberCount) : 0;
  } else {
    // Standard even split of total cost
    perMemberCost = splittingMemberCount > 0 ? Math.round(totalCost / splittingMemberCount) : 0;
  }

  // Cash vs Bank totals
  const cashTotal = eventExpenses
    .filter((e) => (e.paymentMethod || 'cash') === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const bankTotal = eventExpenses
    .filter((e) => e.paymentMethod === 'bank')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Category Breakdown
  const catMap: Record<string, { amount: number; count: number }> = {};
  eventExpenses.forEach((exp) => {
    const cat = exp.category || 'Miscellaneous';
    if (!catMap[cat]) {
      catMap[cat] = { amount: 0, count: 0 };
    }
    catMap[cat].amount += Number(exp.amount) || 0;
    catMap[cat].count += 1;
  });

  const categoryBreakdown = Object.entries(catMap)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalCost > 0 ? Math.round((data.amount / totalCost) * 100) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Fund Paid Amount
  const fundPaidAmount = eventExpenses
    .filter((e) => e.paidById === 'fund')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Member Settlement Calculation
  // Considers direct out-of-pocket expenses + recorded contribution transactions
  const settledIds = new Set(event.settledMemberIds || []);

  const memberSettlement = allMemberIds.map((mId) => {
    const memberObj = members.find((m) => m.id === mId);
    const memberName = memberObj ? memberObj.name : 'Unknown Member';

    // Expenses paid out of pocket (excluding expenses paid by group fund)
    const expensePaid = eventExpenses
      .filter((e) => e.paidById === mId && e.paidById !== 'fund')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Contribution transactions recorded for this event
    const txPaid = transactions && transactions.length > 0
      ? transactions
          .filter(
            (t) =>
              (t.eventId === event.id || (t.event && t.event.toLowerCase() === event.name.toLowerCase())) &&
              t.memberId === mId &&
              t.paymentStatus === 'Paid'
          )
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
      : 0;

    // Safeguard: if a member has both recorded contribution transactions and out-of-pocket expenses,
    // ensure transactions that sponsor or settle those expenses are not counted twice.
    let effectiveExpensePaid = expensePaid;
    if (txPaid > 0 && expensePaid > 0) {
      const memberTxs = (transactions || []).filter(
        (t) =>
          (t.eventId === event.id || (t.event && t.event.toLowerCase() === event.name.toLowerCase())) &&
          t.memberId === mId &&
          t.paymentStatus === 'Paid'
      );
      const isAlreadyCoveredInTx = eventExpenses.some(
        (e) =>
          e.paidById === mId &&
          memberTxs.some(
            (t) =>
              Number(t.amount) === Number(e.amount) ||
              (t.notes && e.name && t.notes.toLowerCase().includes(e.name.toLowerCase())) ||
              (e.notes && t.transactionId && e.notes.toLowerCase().includes(t.transactionId.toLowerCase()))
          )
      );
      if (isAlreadyCoveredInTx) {
        effectiveExpensePaid = Math.max(0, expensePaid - txPaid);
      }
    }

    const basePaid = effectiveExpensePaid + txPaid;
    const isExempt = exemptIds.has(mId);
    const isWeddingPerson = event.weddingPersonId === mId;
    const expectedShare = isExempt ? 0 : perMemberCost;
    const isExplicitlySettled = settledIds.has(mId);

    // If explicitly marked as settled/paid in the event and has no higher recorded transactions,
    // totalPaid reflects their expected share (or basePaid if higher).
    const totalPaid = isExplicitlySettled && expectedShare > 0
      ? Math.max(basePaid, expectedShare)
      : basePaid;

    // Track voluntary extra donations above expected share/minimum
    const extraDonation = !isExempt && totalPaid > expectedShare ? totalPaid - expectedShare : (isExempt ? totalPaid : 0);
    const isDonor = extraDonation > 0;

    let netBalance = totalPaid - expectedShare;
    let status: 'paid' | 'unpaid' | 'settled' | 'exempt';

    if (isExempt) {
      status = totalPaid > 0 ? 'paid' : 'exempt';
    } else if (isExplicitlySettled) {
      status = 'paid';
    } else if (totalPaid > expectedShare) {
      status = 'paid';
    } else if (totalPaid === expectedShare && expectedShare > 0) {
      status = 'paid';
    } else if (totalPaid === 0 && expectedShare === 0) {
      status = 'settled';
    } else {
      status = 'unpaid';
    }

    return {
      memberId: mId,
      memberName,
      phone: memberObj?.phone,
      role: memberObj?.role,
      totalPaid,
      expectedShare,
      extraDonation,
      isDonor,
      netBalance,
      status,
      isExemptFromSplit: isExempt,
      isWeddingPerson,
    };
  }).sort((a, b) => b.netBalance - a.netBalance);

  // Unpaid members list (excludes all paid, settled, and exempt members)
  const unpaidMembers = memberSettlement
    .filter((m) => m.status === 'unpaid' && !m.isExemptFromSplit)
    .map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      phone: m.phone,
      role: m.role,
      totalPaid: m.totalPaid,
      expectedShare: m.expectedShare,
      amountOwed: Math.max(0, m.expectedShare - m.totalPaid),
      minimumRequired: splitMode === 'minimum' ? minimumAmountPerPerson : undefined,
    }));

  const totalUnpaidAmount = unpaidMembers.reduce((sum, m) => sum + m.amountOwed, 0);
  const unpaidMembersCount = unpaidMembers.length;
  const paidMembersCount = Math.max(0, splittingMemberCount - unpaidMembersCount);

  // Donation metrics
  const totalDonations = memberSettlement.reduce((sum, m) => sum + m.extraDonation, 0);
  const totalMemberPayments = memberSettlement.reduce((sum, m) => sum + m.totalPaid, 0);

  return {
    eventId: event.id,
    totalCost,
    totalExpensesCount: eventExpenses.length,
    memberCount,
    splittingMemberCount,
    exemptMemberCount,
    weddingPersonId: resolvedWeddingPersonId,
    weddingPersonName,
    splitMode,
    targetSplitAmount: targetSplitAmount > 0 ? targetSplitAmount : undefined,
    minimumAmountPerPerson: minimumAmountPerPerson > 0 ? minimumAmountPerPerson : undefined,
    totalMinimumTarget,
    totalDonations,
    totalMemberPayments,
    perMemberCost,
    categoryBreakdown,
    memberSettlement,
    fundPaidAmount,
    cashTotal,
    bankTotal,
    unpaidMembers,
    totalUnpaidAmount,
    paidMembersCount,
    unpaidMembersCount,
  };
}

export interface EventFinancialMetrics {
  summary: EventFinancialSummary;
  evTransactions: TransactionRecord[];
  evContributions: TransactionRecord[];
  evTotalCollections: number;
  evBalance: number | null;
  primaryLabel: string;
}

export function getEventFinancials(
  event: EventItem,
  expenses: Expense[],
  members: Member[],
  transactions: TransactionRecord[] = []
): EventFinancialMetrics {
  const summary = calculateEventSummary(event, expenses, members, transactions);
  const evTransactions = transactions.filter(
    (tx) => tx.eventId === event.id || (tx.event && tx.event.toLowerCase() === event.name.toLowerCase())
  );
  const evContributions = evTransactions.filter(
    (tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid'
  );
  const txCollections = evContributions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );
  const evTotalCollections = Math.max(txCollections, summary.totalMemberPayments);
  const evBalance =
    evTotalCollections > 0 || summary.totalCost > 0 ? evTotalCollections - summary.totalCost : null;

  const primaryLabel = evTotalCollections > 0 ? 'Expenditure' : 'Total Expense';

  return {
    summary,
    evTransactions,
    evContributions,
    evTotalCollections,
    evBalance,
    primaryLabel,
  };
}

export function generateEventWhatsAppText(
  event: EventItem,
  expenses: Expense[],
  members: Member[],
  transactions: TransactionRecord[] = []
): string {
  const summary = calculateEventSummary(event, expenses, members, transactions);
  const eventExpenses = expenses.filter((e) => e.eventId === event.id);

  let text = `✨ *Tm ISHAL — Event Financial Statement* ✨\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📌 *Event:* ${event.name}\n`;
  text += `📅 *Date:* ${formatDate(event.date)}\n`;
  if (event.location) text += `📍 *Location:* ${event.location}\n`;
  if (summary.weddingPersonName) {
    text += `💍 *Wedding Person:* ${summary.weddingPersonName} (Exempt from split)\n`;
  }
  text += `👥 *Participants:* ${summary.memberCount} members (${summary.splittingMemberCount} splitting)\n`;
  text += `💰 *Total Expense:* ${formatINR(summary.totalCost)}\n`;
  text += `💵 *Paid via Cash:* ${formatINR(summary.cashTotal)} | 🏦 *Paid via Bank/UPI:* ${formatINR(summary.bankTotal)}\n`;

  if (summary.splitMode === 'minimum') {
    text += `🎁 *Split Calculation:* Minimum Amount (Floor: ${formatINR(summary.perMemberCost)}/person)\n`;
    if (summary.totalMinimumTarget) {
      text += `🎯 *Minimum Collection Target:* ${formatINR(summary.totalMinimumTarget)}\n`;
    }
    if (summary.totalDonations > 0) {
      text += `🌟 *Extra Voluntary Donations:* ${formatINR(summary.totalDonations)}\n`;
    }
    text += `📥 *Total Collected from Members:* ${formatINR(summary.totalMemberPayments)}\n`;
  } else if (summary.targetSplitAmount) {
    text += `📊 *Split Calculation:* Even Split of Fixed Target ${formatINR(summary.targetSplitAmount)} (${formatINR(summary.perMemberCost)}/member)\n`;
  } else {
    text += `📊 *Cost Per Member:* ${formatINR(summary.perMemberCost)}${summary.weddingPersonName ? ` (excluding ${summary.weddingPersonName})` : ''}\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `📋 *TRANSACTIONS & PAYMENT METHOD:*\n`;
  eventExpenses.forEach((exp, idx) => {
    const payer = exp.paidById === 'fund' ? 'Tm ISHAL Fund' : members.find(m => m.id === exp.paidById)?.name || 'Member';
    const methodBadge = (exp.paymentMethod || 'cash') === 'bank' ? '🏦 Bank/UPI' : '💵 Cash';
    text += `${idx + 1}. ${exp.name}\n   └ ${formatINR(exp.amount)} [${exp.category}] • ${methodBadge} • Paid by: ${payer}\n`;
  });

  text += `\n🏷️ *CATEGORY SUMMARY:*\n`;
  summary.categoryBreakdown.forEach((cat) => {
    text += `• ${cat.category}: ${formatINR(cat.amount)} (${cat.percentage}%)\n`;
  });

  if (summary.unpaidMembers.length > 0) {
    text += `\n⚠️ *UNPAID MEMBERS / PENDING SETTLEMENT (${summary.unpaidMembers.length} members | Total: ${formatINR(summary.totalUnpaidAmount)}):*\n`;
    summary.unpaidMembers.forEach((m, idx) => {
      const shareLabel = summary.splitMode === 'minimum' ? 'Min' : 'Share';
      text += `${idx + 1}. 🔴 ${m.memberName}: Owes ${formatINR(m.amountOwed)} (Paid: ${formatINR(m.totalPaid)} / ${shareLabel}: ${formatINR(m.expectedShare)})\n`;
    });
  }

  text += `\n⚖️ *COMPLETE MEMBER SETTLEMENT BALANCE SHEET:*\n`;
  summary.memberSettlement.forEach((m) => {
    if (m.isExemptFromSplit) {
      if (m.totalPaid > 0) {
        text += `💍 ${m.memberName}: Wedding Member (Exempt from split • Paid ${formatINR(m.totalPaid)} voluntary contribution)\n`;
      } else {
        text += `💍 ${m.memberName}: Wedding Member (Exempt from split • Share ₹0)\n`;
      }
    } else if (m.isDonor && m.extraDonation > 0) {
      text += `🌟 ${m.memberName}: Paid ${formatINR(m.totalPaid)} (✅ Min Met • 🎁 Donated +${formatINR(m.extraDonation)} extra!)\n`;
    } else if (m.netBalance > 0) {
      text += `🟢 ${m.memberName}: Paid ${formatINR(m.totalPaid)} → Surplus ${formatINR(m.netBalance)}\n`;
    } else if (m.netBalance < 0) {
      text += `🔴 ${m.memberName}: Paid ${formatINR(m.totalPaid)} → Owes ${formatINR(Math.abs(m.netBalance))}\n`;
    } else {
      text += `⚪ ${m.memberName}: Settled (${formatINR(m.totalPaid)})\n`;
    }
  });

  if (summary.fundPaidAmount > 0) {
    text += `\n🏦 *Group Fund Contribution:* ${formatINR(summary.fundPaidAmount)}\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `_Generated by IFO (Ishal Finance Organizer) • Tm ISHAL_`;

  return text;
}

export function downloadEventCSV(
  event: EventItem,
  expenses: Expense[],
  members: Member[],
  transactions: TransactionRecord[] = []
) {
  const eventExpenses = expenses.filter((e) => e.eventId === event.id);
  const summary = calculateEventSummary(event, expenses, members, transactions);

  const rows = [
    ['Event Name', event.name],
    ['Date', event.date],
    ['Location', event.location || 'N/A'],
    ['Type', event.type],
    ['Split Mode', summary.splitMode === 'minimum' ? 'Minimum Amount Per Person (+ Voluntary Donations)' : 'Particular Amount Splitting Even'],
    ['Minimum / Expected Share', String(summary.perMemberCost)],
    ['Total Voluntary Donations', String(summary.totalDonations)],
    ['Wedding Person (Exempt)', summary.weddingPersonName || 'N/A'],
    ['Total Members', String(event.memberIds.length)],
    ['Splitting Members', String(summary.splittingMemberCount)],
    ['Total Cost', String(summary.totalCost)],
    ['Cash Expense Total', String(summary.cashTotal)],
    ['Bank Expense Total', String(summary.bankTotal)],
    ['Total Unpaid Amount', String(summary.totalUnpaidAmount)],
    [],
    ['ID', 'Date', 'Expense Name', 'Category', 'Amount (INR)', 'Payment Method', 'Paid By', 'Notes'],
    ...eventExpenses.map((exp) => [
      exp.id,
      exp.date,
      `"${exp.name.replace(/"/g, '""')}"`,
      `"${exp.category}"`,
      String(exp.amount),
      exp.paymentMethod || 'cash',
      exp.paidById === 'fund' ? 'Group Fund' : members.find((m) => m.id === exp.paidById)?.name || 'Member',
      `"${(exp.notes || '').replace(/"/g, '""')}"`,
    ]),
    [],
    ['Member Name', 'Status', 'Share/Min (INR)', 'Total Paid (INR)', 'Extra Donation (INR)', 'Balance / Owed (INR)'],
    ...summary.memberSettlement.map((m) => [
      `"${m.memberName}"`,
      m.isExemptFromSplit ? 'Wedding Member (Exempt)' : m.status,
      String(m.expectedShare),
      String(m.totalPaid),
      String(m.extraDonation),
      String(m.netBalance),
    ]),
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${event.name.replace(/\s+/g, '_')}_Financial_Statement.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadAllDataCSV(
  events: EventItem[],
  expenses: Expense[],
  members: Member[]
) {
  const rows = [
    ['Expense ID', 'Event Name', 'Event Type', 'Date', 'Item Name', 'Category', 'Amount (INR)', 'Payment Method', 'Paid By', 'Notes'],
    ...expenses.map((exp) => {
      const ev = events.find((e) => e.id === exp.eventId);
      const payer = exp.paidById === 'fund'
        ? 'Tm ISHAL Fund'
        : members.find((m) => m.id === exp.paidById)?.name || 'Unknown';
      return [
        exp.id,
        `"${(ev?.name || 'N/A').replace(/"/g, '""')}"`,
        ev?.type || 'N/A',
        exp.date,
        `"${exp.name.replace(/"/g, '""')}"`,
        `"${exp.category}"`,
        String(exp.amount),
        (exp.paymentMethod || 'cash') === 'bank' ? 'Bank / UPI' : 'Cash',
        `"${payer.replace(/"/g, '""')}"`,
        `"${(exp.notes || '').replace(/"/g, '""')}"`,
      ];
    }),
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Tm_ISHAL_All_Expenses_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface MemberPendingEvent {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventType: string;
  pendingAmount: number;
  expectedShare: number;
  paidAmount: number;
  perMemberCost: number; // convenience alias for expectedShare
  donatedAmount: number; // convenience alias for paidAmount
  unpaidTxId?: string;
  reason: string;
}

export interface MemberFinancialMetrics {
  joinedEvents: EventItem[];
  joinedEventsCount: number;
  totalDonated: number;
  totalDirectExpenses: number;
  totalPaid: number;
  pendingEvents: MemberPendingEvent[];
  totalPending: number;
  isAllClear: boolean;
  memberExpenses: Expense[];
  eventDonations: { eventId: string; amount: number; txId?: string }[];
}

export function getMemberFinancials(
  member: Member,
  events: EventItem[],
  expenses: Expense[],
  transactions: TransactionRecord[] = []
): MemberFinancialMetrics {
  const joinedEvents = events.filter(
    (ev) =>
      (ev.memberIds || []).includes(member.id) &&
      ev.id !== 'ev_other_expenses' &&
      ev.name.trim().toLowerCase() !== 'other expenses' &&
      !ev.name.toLowerCase().includes('other expense')
  );

  // 1. Total Donated: all paid contribution transactions across all events
  const memberPaidContributions = transactions.filter((tx) => {
    if (tx.transactionType !== 'Contribution' || tx.paymentStatus !== 'Paid') return false;
    if (tx.memberId && tx.memberId === member.id) return true;
    const cleanTxName = (tx.nameOrCategory || '').toLowerCase().trim();
    const cleanMemberName = member.name.toLowerCase().trim();
    return cleanTxName === cleanMemberName || cleanTxName.startsWith(cleanMemberName);
  });

  const totalDonated = memberPaidContributions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  // 2. Direct expenses out-of-pocket (if any bill was paid by member directly and not fund)
  const memberDirectExpenses = expenses.filter(
    (exp) => exp.paidById === member.id && exp.paidById !== 'fund'
  );
  const totalDirectExpenses = memberDirectExpenses.reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  // Total Paid matches event donated amount
  const totalPaid = totalDonated + totalDirectExpenses;

  // 3. Pending Events calculation
  const pendingEvents: MemberPendingEvent[] = [];

  joinedEvents.forEach((ev) => {
    if (
      ev.id === 'ev_other_expenses' ||
      ev.name.trim().toLowerCase() === 'other expenses' ||
      ev.name.toLowerCase().includes('other expense')
    ) {
      return;
    }

    // Check if member is exempt (wedding person or in exemptMemberIds)
    const isExempt =
      isMemberExemptFromEvent(ev, member.id, [member]) ||
      ev.weddingPersonId === member.id ||
      (ev.exemptMemberIds || []).includes(member.id);

    if (isExempt) {
      // The member is exempt from this event (e.g. Groom / Bride in a wedding).
      // They do NOT owe any money, their share is ₹0, and they CANNOT have pending dues.
      return;
    }

    const paidForEventTxs = transactions.filter((tx) => {
      const matchesEvent =
        tx.eventId === ev.id ||
        (tx.event && tx.event.toLowerCase().trim() === ev.name.toLowerCase().trim());
      if (!matchesEvent) return false;

      const matchesMember =
        tx.memberId === member.id ||
        (tx.nameOrCategory &&
          (tx.nameOrCategory.toLowerCase().trim() === member.name.toLowerCase().trim() ||
            tx.nameOrCategory.toLowerCase().trim().startsWith(member.name.toLowerCase().trim())));

      return matchesMember && tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid';
    });

    const paidForEvent = paidForEventTxs.reduce(
      (sum, tx) => sum + (Number(tx.amount) || 0),
      0
    );

    const unpaidTx = transactions.find((tx) => {
      const matchesEvent =
        tx.eventId === ev.id ||
        (tx.event && tx.event.toLowerCase().trim() === ev.name.toLowerCase().trim());
      if (!matchesEvent) return false;

      const matchesMember =
        tx.memberId === member.id ||
        (tx.nameOrCategory &&
          (tx.nameOrCategory.toLowerCase().trim() === member.name.toLowerCase().trim() ||
            tx.nameOrCategory.toLowerCase().trim().startsWith(member.name.toLowerCase().trim())));

      return matchesMember && tx.transactionType === 'Contribution' && tx.paymentStatus === 'Unpaid';
    });

    const isMarkedSettled = (ev.settledMemberIds || []).includes(member.id);

    // Determine baseline standard contribution target for this event
    const allPaidForEvent = transactions.filter(
      (tx) =>
        (tx.eventId === ev.id ||
          (tx.event && tx.event.toLowerCase().trim() === ev.name.toLowerCase().trim())) &&
        tx.transactionType === 'Contribution' &&
        tx.paymentStatus === 'Paid' &&
        Number(tx.amount) > 0
    );

    let baselineTarget = 0;
    if (allPaidForEvent.length > 0) {
      const freqMap: Record<number, number> = {};
      allPaidForEvent.forEach((tx) => {
        const amt = Number(tx.amount);
        freqMap[amt] = (freqMap[amt] || 0) + 1;
      });
      let highestFreq = 0;
      let modalAmount = 0;
      Object.entries(freqMap).forEach(([amtStr, count]) => {
        if (count > highestFreq) {
          highestFreq = count;
          modalAmount = Number(amtStr);
        }
      });
      baselineTarget = modalAmount;
    }

    if (baselineTarget === 0) {
      const evSummary = calculateEventSummary(ev, expenses, [member]);
      baselineTarget = evSummary.perMemberCost;
    }

    if (unpaidTx) {
      const dueAmt = Number(unpaidTx.amount) > 0 ? Number(unpaidTx.amount) : baselineTarget;
      pendingEvents.push({
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date,
        eventType: ev.type,
        pendingAmount: dueAmt,
        expectedShare: baselineTarget,
        perMemberCost: baselineTarget,
        paidAmount: paidForEvent,
        donatedAmount: paidForEvent,
        unpaidTxId: unpaidTx.transactionId,
        reason: unpaidTx.notes || `Pending contribution in ${ev.name}`,
      });
    } else if (!isMarkedSettled && paidForEvent === 0) {
      pendingEvents.push({
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date,
        eventType: ev.type,
        pendingAmount: baselineTarget,
        expectedShare: baselineTarget,
        perMemberCost: baselineTarget,
        paidAmount: 0,
        donatedAmount: 0,
        reason: `Pending contribution share for ${ev.name}`,
      });
    } else if (!isMarkedSettled && paidForEvent < baselineTarget) {
      pendingEvents.push({
        eventId: ev.id,
        eventName: ev.name,
        eventDate: ev.date,
        eventType: ev.type,
        pendingAmount: baselineTarget - paidForEvent,
        expectedShare: baselineTarget,
        perMemberCost: baselineTarget,
        paidAmount: paidForEvent,
        donatedAmount: paidForEvent,
        reason: `Remaining balance for ${ev.name}`,
      });
    }
  });

  const totalPending = pendingEvents.reduce((sum, p) => sum + p.pendingAmount, 0);

  const eventDonations = memberPaidContributions.map((tx) => ({
    eventId: tx.eventId,
    amount: Number(tx.amount) || 0,
    txId: tx.transactionId,
  }));

  return {
    joinedEvents,
    joinedEventsCount: joinedEvents.length,
    totalDonated,
    totalDirectExpenses,
    totalPaid,
    pendingEvents,
    totalPending,
    isAllClear: totalPending === 0,
    memberExpenses: memberDirectExpenses,
    eventDonations,
  };
}

