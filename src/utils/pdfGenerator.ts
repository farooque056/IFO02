import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventItem, Expense, Member, Transaction, CreditNote } from '../types';
import { calculateEventSummary, formatDate, getMemberFinancials } from './formatters';

// Format currency reliably for PDF standard fonts (avoids encoding issues with unicode ₹)
export function formatPDFCurrency(amount: number): string {
  if (isNaN(amount)) return 'Rs. 0';
  const numStr = Math.round(amount).toLocaleString('en-IN');
  return `Rs. ${numStr}`;
}

/**
 * Generate and download a high-quality, professional Event Financial Statement PDF
 */
export function downloadEventPDF(
  event: EventItem,
  expenses: Expense[],
  members: Member[],
  transactions?: Transaction[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const safeExpenses = expenses || [];
  const safeMembers = members || [];
  const safeTransactions = transactions || [];

  const summary = calculateEventSummary(event, safeExpenses, safeMembers, safeTransactions);
  const eventExpenses = safeExpenses.filter((e) => e.eventId === event.id);

  // Aggregate event-specific transactions
  const eventTransactions = safeTransactions.filter(
    (tx) => tx.eventId === event.id || (event.name && tx.event && tx.event.toLowerCase() === event.name.toLowerCase())
  );
  const eventContributions = eventTransactions.filter(
    (tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid'
  );
  const txCollections = eventContributions.reduce(
    (sum, tx) => sum + (Number(tx.amount) || 0),
    0
  );

  // Core Financial Metric Figures
  const totalCollectedAmount = Math.max(txCollections, summary.totalMemberPayments || 0);
  const totalExpensesAmount = summary.totalCost;
  const netBalanceAmount = totalCollectedAmount - totalExpensesAmount;

  // Colors Palette
  const primaryNavy = [11, 25, 56]; // #0B1938
  const secondaryNavy = [21, 38, 77];
  const accentBlue = [37, 99, 235]; // #2563EB
  const textDark = [15, 23, 42]; // #0F172A
  const textMuted = [100, 116, 139]; // #64748B
  const bgLight = [248, 250, 252]; // #F8FAFC
  const borderLight = [226, 232, 240]; // #E2E8F0
  const emeraldGreen = [5, 150, 105]; // #059669
  const roseRed = [225, 29, 72]; // #E11D48

  // === 1. TOP HEADER BANNER ===
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 32, 3, 3, 'F');

  // Badge Accent
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.roundedRect(margin + 6, 16, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IFO', margin + 12, 24, { align: 'center' });

  // Organization Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Financial Statement', margin + 22, 21);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text('Ishal Finance Organizer • Official Event Ledger & Audit Report', margin + 22, 26.5);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated on: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    pageWidth - margin - 6,
    21,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(165, 243, 252);
  doc.text(
    `STATUS: ${(event.status || 'ACTIVE').toUpperCase()}`,
    pageWidth - margin - 6,
    26.5,
    { align: 'right' }
  );

  let currentY = 48;

  // === 2. EVENT DETAILS CARD ===
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(event.name, margin + 5, currentY + 6.5);

  // Meta row
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

  const dateText = `Date: ${formatDate(event.date)}`;
  const locText = event.location ? `Location: ${event.location}` : 'Location: N/A';
  const typeText = `Type: ${event.type.toUpperCase()}`;
  const membersText = summary.weddingPersonName
    ? `Enrolled: ${summary.memberCount} (${summary.weddingPersonName} Exempt)`
    : `Enrolled: ${summary.memberCount} Members`;

  doc.text(dateText, margin + 5, currentY + 12.5);
  doc.text(locText, margin + 48, currentY + 12.5);
  doc.text(typeText, margin + 105, currentY + 12.5);
  doc.text(membersText, margin + 135, currentY + 12.5);

  if (event.notes) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${event.notes}`, margin + 5, currentY + 18);
  }

  currentY += 26;

  // === 3. REDESIGNED FINANCIAL SUMMARY METRIC BOXES ===
  // Core 3 Pillars: Total Collected Amount | Total Expenses | Net Balance
  const boxWidth = (contentWidth - 6) / 3;
  const boxHeight = 22;

  // Card 1: TOTAL COLLECTED AMOUNT
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, 'F');
  // Emerald Inflow Accent Strip on Left
  doc.setFillColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.roundedRect(margin, currentY, 2.5, boxHeight, 1, 1, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(167, 243, 208);
  doc.text('TOTAL COLLECTED', margin + 5, currentY + 5.5);

  // Inflow pill badge
  doc.setFillColor(6, 78, 59);
  doc.roundedRect(margin + boxWidth - 16, currentY + 3, 12, 4, 1, 1, 'F');
  doc.setTextColor(167, 243, 208);
  doc.setFontSize(5.5);
  doc.text('INFLOW', margin + boxWidth - 10, currentY + 5.8, { align: 'center' });

  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(52, 211, 153);
  doc.text(formatPDFCurrency(totalCollectedAmount), margin + 5, currentY + 13);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const collectionsDetailStr = eventContributions.length > 0
    ? `${eventContributions.length} Transactions Recorded`
    : `${summary.paidMembersCount}/${summary.splittingMemberCount} Members Settled`;
  doc.text(collectionsDetailStr, margin + 5, currentY + 18.5);

  // Card 2: TOTAL EXPENSES
  const col2X = margin + boxWidth + 3;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(col2X, currentY, boxWidth, boxHeight, 2, 2, 'F');
  // Rose Outflow Accent Strip on Left
  doc.setFillColor(roseRed[0], roseRed[1], roseRed[2]);
  doc.roundedRect(col2X, currentY, 2.5, boxHeight, 1, 1, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(254, 205, 211);
  doc.text('TOTAL EXPENSES', col2X + 5, currentY + 5.5);

  // Outflow pill badge
  doc.setFillColor(136, 19, 55);
  doc.roundedRect(col2X + boxWidth - 18, currentY + 3, 14, 4, 1, 1, 'F');
  doc.setTextColor(254, 205, 211);
  doc.setFontSize(5.5);
  doc.text('OUTFLOW', col2X + boxWidth - 11, currentY + 5.8, { align: 'center' });

  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(formatPDFCurrency(totalExpensesAmount), col2X + 5, currentY + 13);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`${eventExpenses.length} Expense Items Recorded`, col2X + 5, currentY + 18.5);

  // Card 3: NET BALANCE
  const col3X = margin + (boxWidth + 3) * 2;
  const isSurplus = netBalanceAmount > 0;
  const isDeficit = netBalanceAmount < 0;

  if (isSurplus) {
    doc.setFillColor(236, 253, 245); // Emerald-50
    doc.setDrawColor(16, 185, 129); // Emerald-500
  } else if (isDeficit) {
    doc.setFillColor(254, 242, 242); // Rose-50
    doc.setDrawColor(244, 63, 94); // Rose-500
  } else {
    doc.setFillColor(240, 249, 255); // Sky-50
    doc.setDrawColor(56, 189, 248); // Sky-400
  }
  doc.roundedRect(col3X, currentY, boxWidth, boxHeight, 2, 2, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('NET BALANCE', col3X + 5, currentY + 5.5);

  // Status Badge in Card 3
  const badgeLabel = isSurplus ? 'SURPLUS' : isDeficit ? 'DEFICIT' : 'SETTLED';
  const badgeBg = isSurplus ? [5, 150, 105] : isDeficit ? [225, 29, 72] : [37, 99, 235];
  doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
  doc.roundedRect(col3X + boxWidth - 18, currentY + 3, 14, 4, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5.5);
  doc.text(badgeLabel, col3X + boxWidth - 11, currentY + 5.8, { align: 'center' });

  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  if (isSurplus) {
    doc.setTextColor(5, 150, 105);
    doc.text(`+${formatPDFCurrency(netBalanceAmount)}`, col3X + 5, currentY + 13);
  } else if (isDeficit) {
    doc.setTextColor(225, 29, 72);
    doc.text(formatPDFCurrency(netBalanceAmount), col3X + 5, currentY + 13);
  } else {
    doc.setTextColor(15, 23, 42);
    doc.text(formatPDFCurrency(0), col3X + 5, currentY + 13);
  }

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const balanceSubStr = isSurplus
    ? 'Remaining Fund Position'
    : isDeficit
    ? 'Deficit / Uncollected Dues'
    : 'Evenly Cleared & Settled';
  doc.text(balanceSubStr, col3X + 5, currentY + 18.5);

  currentY += boxHeight + 3.5;

  // === AUXILIARY FINANCIAL METRICS STRIP ===
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 8.5, 1.5, 1.5, 'FD');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

  const stripW = contentWidth / 4;
  // Cell 1: Target Share
  doc.text('Target Per Head:', margin + 3, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(formatPDFCurrency(summary.perMemberCost), margin + 26, currentY + 5.5);

  // Cell 2: Cash
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Cash Spent:', margin + stripW + 3, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text(formatPDFCurrency(summary.cashTotal), margin + stripW + 20, currentY + 5.5);

  // Cell 3: Bank
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Bank / UPI Spent:', margin + stripW * 2 + 3, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.text(formatPDFCurrency(summary.bankTotal), margin + stripW * 2 + 27, currentY + 5.5);

  // Cell 4: Pending Dues
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Pending Dues:', margin + stripW * 3 + 3, currentY + 5.5);
  doc.setFont('helvetica', 'bold');
  if (summary.totalUnpaidAmount > 0) {
    doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
    doc.text(`${summary.unpaidMembersCount} pax (${formatPDFCurrency(summary.totalUnpaidAmount)})`, margin + stripW * 3 + 22, currentY + 5.5);
  } else {
    doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    doc.text('Nil (All Cleared)', margin + stripW * 3 + 22, currentY + 5.5);
  }

  currentY += 12;

  // === 4. SECTION 1: MEMBER COLLECTED & SETTLEMENT DETAILS ("Members collected details") ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('1. Member Collection & Settlement Statement', margin, currentY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Total Collected: ${formatPDFCurrency(totalCollectedAmount)} across ${summary.splittingMemberCount} contributing members`,
    pageWidth - margin,
    currentY,
    { align: 'right' }
  );

  currentY += 2.5;

  const memberRows = summary.memberSettlement.map((m, idx) => {
    let statusText = 'Paid in Full';
    let balanceFormatted = formatPDFCurrency(0);

    if (m.isExemptFromSplit) {
      statusText = 'Exempt (Groom)';
      balanceFormatted = m.totalPaid > 0 ? `+${formatPDFCurrency(m.netBalance)}` : 'Rs. 0 (Exempt)';
    } else if (m.isDonor && m.extraDonation && m.extraDonation > 0) {
      statusText = `Donated (+${formatPDFCurrency(m.extraDonation)})`;
      balanceFormatted = `+${formatPDFCurrency(m.extraDonation)} (Extra)`;
    } else if (m.netBalance > 0) {
      statusText = 'Receives Refund';
      balanceFormatted = `+${formatPDFCurrency(m.netBalance)}`;
    } else if (m.netBalance < 0) {
      statusText = 'Pending (Owes)';
      balanceFormatted = `-${formatPDFCurrency(Math.abs(m.netBalance))}`;
    }

    return [
      String(idx + 1),
      m.isWeddingPerson ? `${m.memberName} (Groom)` : m.memberName,
      m.role || 'Member',
      m.isExemptFromSplit ? 'Rs. 0 (Exempt)' : formatPDFCurrency(m.expectedShare),
      formatPDFCurrency(m.totalPaid),
      balanceFormatted,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Member Name', 'Role', 'Expected Share', 'Amount Collected', 'Net Balance', 'Collection Status']],
    body: memberRows,
    foot: [
      [
        '',
        'Total Collections',
        `${summary.memberCount} members`,
        formatPDFCurrency(summary.perMemberCost * summary.splittingMemberCount),
        formatPDFCurrency(totalCollectedAmount),
        summary.totalUnpaidAmount > 0 ? `-${formatPDFCurrency(summary.totalUnpaidAmount)} (Due)` : 'Rs. 0 (All Clear)',
        summary.unpaidMembersCount === 0 ? 'Fully Cleared' : `${summary.unpaidMembersCount} Pending`,
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 56],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 24 },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 26, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = memberRows[data.row.index];
        const status = row[6];
        if (data.column.index === 5 || data.column.index === 6) {
          if (status === 'Receives Refund' || status.startsWith('Donated')) {
            data.cell.styles.textColor = [5, 150, 105]; // Green
          } else if (status === 'Pending (Owes)') {
            data.cell.styles.textColor = [225, 29, 72]; // Red
          }
        }
      }
    },
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY || currentY + 40;
  finalY += 8;

  // Check if room for Section 2 (Itemized Expenses)
  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 5. SECTION 2: ITEMIZED EXPENSE DETAILS ("Expense deails") ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('2. Itemized Expense & Voucher Ledger', margin, finalY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Total Expenses: ${formatPDFCurrency(totalExpensesAmount)} across ${eventExpenses.length} bills`,
    pageWidth - margin,
    finalY,
    { align: 'right' }
  );

  finalY += 2.5;

  const expenseRows = eventExpenses.map((exp, idx) => {
    const payer =
      exp.paidById === 'fund'
        ? 'Tm ISHAL Fund'
        : members.find((m) => m.id === exp.paidById)?.name || 'Member';
    const methodStr = (exp.paymentMethod || 'cash') === 'bank' ? 'Bank / UPI' : 'Cash';
    return [
      String(idx + 1),
      formatDate(exp.date),
      exp.name + (exp.notes ? ` (${exp.notes})` : ''),
      exp.category || 'General',
      methodStr,
      payer,
      formatPDFCurrency(exp.amount),
    ];
  });

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['#', 'Date', 'Expense Item & Purpose', 'Category', 'Method', 'Paid By', 'Amount']],
    body: expenseRows,
    foot: [
      [
        '',
        '',
        'Total Event Expenses',
        `${eventExpenses.length} items`,
        `Cash: ${formatPDFCurrency(summary.cashTotal)}`,
        `Bank: ${formatPDFCurrency(summary.bankTotal)}`,
        formatPDFCurrency(totalExpensesAmount),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 56],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 51, fontStyle: 'bold' },
      3: { cellWidth: 25 },
      4: { cellWidth: 22 },
      5: { cellWidth: 30 },
      6: { cellWidth: 27, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 40;
  finalY += 8;

  // Check room for Category Breakdown
  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 6. SECTION 3: EXPENSE CATEGORY DISTRIBUTION ===
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('3. Expense Category Breakdown', margin, finalY);
  finalY += 2.5;

  const categoryRows = summary.categoryBreakdown.map((cat) => [
    cat.category,
    `${cat.count} items`,
    `${cat.percentage}%`,
    formatPDFCurrency(cat.amount),
  ]);

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['Category Name', 'Items Count', 'Budget Share %', 'Total Amount']],
    body: categoryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 52, halign: 'right', fontStyle: 'bold' },
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 30;
  finalY += 8;

  // === 7. SECTION 4: UNPAID MEMBERS DUES LIST (If any) ===
  if (summary.unpaidMembers.length > 0) {
    if (finalY > pageHeight - 55) {
      doc.addPage();
      finalY = 18;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
    doc.text(`4. Pending Member Dues (${summary.unpaidMembers.length} Unpaid Members)`, margin, finalY);
    finalY += 2.5;

    const unpaidRows = summary.unpaidMembers.map((u, idx) => [
      String(idx + 1),
      u.memberName,
      u.phone || 'N/A',
      formatPDFCurrency(u.expectedShare),
      formatPDFCurrency(u.totalPaid),
      formatPDFCurrency(u.amountOwed),
      'Pending Settlement',
    ]);

    autoTable(doc, {
      startY: finalY,
      margin: { left: margin, right: margin },
      head: [['#', 'Member Name', 'Phone', 'Expected Share', 'Amount Paid', 'Amount Due', 'Status']],
      body: unpaidRows,
      theme: 'grid',
      headStyles: {
        fillColor: [159, 18, 57], // Rose-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 1.8,
      },
      columnStyles: {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 45, fontStyle: 'bold' },
        2: { cellWidth: 30 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' },
        5: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
        6: { cellWidth: 25, halign: 'center', textColor: [225, 29, 72], fontStyle: 'bold' },
      },
    });

    // @ts-ignore
    finalY = doc.lastAutoTable?.finalY || finalY + 30;
    finalY += 8;
  }

  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 20;
  }

  // === 8. SIGN-OFF & VERIFICATION BLOCK ===
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 6;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Prepared by: Tm ISHAL Organizer', margin, finalY);
  doc.text('Verified & Audited by: Treasurer', margin + 70, finalY);
  doc.text('Approved by: President / Admin', margin + 140, finalY);

  // === 9. RUNNING PAGE FOOTER ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    // Bottom divider
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      'IFO — Ishal Finance Organizer • Tm ISHAL Group Financial Record',
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  // Save the PDF file
  const sanitizedName = event.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Tm_ISHAL_${sanitizedName}_Statement.pdf`);
}

/**
 * Generate and download a comprehensive Community Master Financial Statement PDF
 */
export function downloadCommunityMasterReportPDF(
  events: EventItem[],
  expenses: Expense[],
  members: Member[],
  totalCollected: number,
  openingBalance: number = 0,
  transactions: Transaction[] = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const totalSpending = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const netBalance = totalCollected - totalSpending;

  const cashTotal = expenses
    .filter((e) => (e.paymentMethod || 'cash') === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const bankTotal = expenses
    .filter((e) => e.paymentMethod === 'bank')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Palette
  const primaryNavy = [11, 25, 56];
  const accentBlue = [37, 99, 235];
  const textDark = [15, 23, 42];
  const textMuted = [100, 116, 139];
  const emeraldGreen = [5, 150, 105];
  const roseRed = [225, 29, 72];
  const bgLight = [248, 250, 252];
  const borderLight = [226, 232, 240];

  // === 1. TOP HEADER BANNER ===
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 32, 3, 3, 'F');

  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.roundedRect(margin + 6, 16, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IFO', margin + 12, 24, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Master Treasury Statement', margin + 22, 21);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text('Consolidated Financial Ledger • Community Income, Expenses & Net Balance', margin + 22, 26.5);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    pageWidth - margin - 6,
    21,
    { align: 'right' }
  );

  let currentY = 50;

  // === 2. TREASURY KPI GRID ===
  const boxWidth = (contentWidth - 6) / 3;
  const boxHeight = 22;

  // Box 1: Total Collected / Revenue
  doc.setFillColor(236, 253, 245); // Emerald tint
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text('TOTAL REVENUE / COLLECTED', margin + 4, currentY + 6);
  doc.setFontSize(13);
  doc.text(formatPDFCurrency(totalCollected), margin + 4, currentY + 15);

  // Box 2: Total Expenses
  doc.setFillColor(254, 242, 242); // Rose tint
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin + boxWidth + 3, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
  doc.text('TOTAL EXPENSES (OUTFLOW)', margin + boxWidth + 7, currentY + 6);
  doc.setFontSize(13);
  doc.text(formatPDFCurrency(totalSpending), margin + boxWidth + 7, currentY + 15);

  // Box 3: Net Treasury Balance
  const isSurplus = netBalance >= 0;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin + (boxWidth + 3) * 2, currentY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 210, 245);
  doc.text(`NET TREASURY BALANCE (${isSurplus ? 'SURPLUS' : 'DEFICIT'})`, margin + (boxWidth + 3) * 2 + 4, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(formatPDFCurrency(netBalance), margin + (boxWidth + 3) * 2 + 4, currentY + 15);

  currentY += boxHeight + 8;

  // Payment Breakdown Strip
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(
    `Outflow Channels:  Cash Outflow: ${formatPDFCurrency(cashTotal)}  |  Bank / UPI Outflow: ${formatPDFCurrency(bankTotal)}  |  Total Events Tracked: ${events.length}  |  Registered Members: ${members.length}`,
    margin + 4,
    currentY + 6.5
  );

  currentY += 15;

  // === 3. EVENTS SUMMARY TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('1. Events & Programs Financial Summary', margin, currentY);
  currentY += 3;

  const eventRows = events.map((ev, idx) => {
    const sum = calculateEventSummary(ev, expenses, members);
    return [
      String(idx + 1),
      formatDate(ev.date),
      ev.name,
      ev.type.toUpperCase(),
      `${sum.memberCount} pax`,
      formatPDFCurrency(sum.perMemberCost),
      formatPDFCurrency(sum.totalCost),
      (ev.status || 'active').toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Date', 'Event Name', 'Type', 'Members', 'Per Member', 'Total Cost', 'Status']],
    body: eventRows,
    foot: [
      [
        '',
        '',
        'Total Across All Events',
        '',
        `${members.length} roster`,
        '',
        formatPDFCurrency(totalSpending),
        '',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 56],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 48, fontStyle: 'bold' },
      3: { cellWidth: 20 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 17, halign: 'center' },
    },
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY || currentY + 40;
  finalY += 8;

  if (finalY > pageHeight - 75) {
    doc.addPage();
    finalY = 18;
  }

  // === 3B. MEMBERS CONTRIBUTIONS & PENDING DUES AUDIT TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('2. Members Contributions & Pending Dues Ledger', margin, finalY);
  finalY += 3;

  const memberAuditRows = members.map((member, idx) => {
    const fin = getMemberFinancials(member, events, expenses, transactions);
    const pendingDetailStr = fin.pendingEvents.length > 0
      ? fin.pendingEvents.map((pe) => `${pe.eventName} (${formatPDFCurrency(pe.pendingAmount)})`).join('; ')
      : 'All Cleared';

    return [
      String(idx + 1),
      member.name,
      member.role || 'Member',
      `${fin.joinedEventsCount} events`,
      formatPDFCurrency(fin.totalPaid),
      formatPDFCurrency(fin.totalPending),
      pendingDetailStr,
      fin.isAllClear ? 'SETTLED' : `${fin.pendingEvents.length} DUE`,
    ];
  });

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['#', 'Member Name', 'Role', 'Events', 'Total Paid (Donated)', 'Pending Dues', 'Pending Events Detail', 'Status']],
    body: memberAuditRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 22 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 42 },
      7: { cellWidth: 16, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 40;
  finalY += 8;

  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 4. COMPLETE EXPENSES CHRONOLOGY TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('3. Master Expense Transactions Ledger', margin, finalY);
  finalY += 3;

  const masterExpenseRows = expenses.map((exp, idx) => {
    const ev = events.find((e) => e.id === exp.eventId);
    const payer =
      exp.paidById === 'fund'
        ? 'Tm ISHAL Fund'
        : members.find((m) => m.id === exp.paidById)?.name || 'Member';
    const methodStr = (exp.paymentMethod || 'cash') === 'bank' ? 'Bank' : 'Cash';

    return [
      String(idx + 1),
      formatDate(exp.date),
      exp.name,
      ev?.name || 'General',
      exp.category,
      methodStr,
      payer,
      formatPDFCurrency(exp.amount),
    ];
  });

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['#', 'Date', 'Expense Item', 'Event', 'Category', 'Method', 'Paid By', 'Amount']],
    body: masterExpenseRows,
    foot: [
      [
        '',
        '',
        'Total Cumulative Spending',
        '',
        '',
        '',
        `${expenses.length} bills`,
        formatPDFCurrency(totalSpending),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18 },
      2: { cellWidth: 40, fontStyle: 'bold' },
      3: { cellWidth: 32 },
      4: { cellWidth: 22 },
      5: { cellWidth: 16 },
      6: { cellWidth: 26 },
      7: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 40;
  finalY += 10;

  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 20;
  }

  // === 5. AUDIT & SIGNATURE BLOCK ===
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Prepared by: Tm ISHAL Organizer', margin, finalY);
  doc.text('Audited by: Executive Committee', margin + 70, finalY);
  doc.text('Signature: ______________________', margin + 130, finalY);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      'IFO — Ishal Finance Organizer • Tm ISHAL Community Master Statement',
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Tm_ISHAL_Master_Financial_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generate and download an Individual Member Financial Statement PDF
 */
export function downloadMemberPDF(
  member: Member,
  events: EventItem[],
  expenses: Expense[],
  allMembers: Member[],
  transactions: Transaction[] = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Compute accurate financial metrics from event donations and pending shares
  const fin = getMemberFinancials(member, events, expenses, transactions);
  const { joinedEvents, joinedEventsCount, totalPaid, totalPending, pendingEvents, isAllClear, memberExpenses } = fin;

  // Colors Palette
  const primaryNavy = [11, 25, 56]; // #0B1938
  const accentBlue = [37, 99, 235]; // #2563EB
  const textDark = [15, 23, 42]; // #0F172A
  const textMuted = [100, 116, 139]; // #64748B
  const bgLight = [248, 250, 252]; // #F8FAFC
  const borderLight = [226, 232, 240]; // #E2E8F0
  const emeraldGreen = [5, 150, 105]; // #059669
  const amberOrange = [217, 119, 6]; // #D97706
  const roseRed = [225, 29, 72]; // #E11D48

  // === 1. TOP HEADER BANNER ===
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 30, 3, 3, 'F');

  // Badge Accent
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.roundedRect(margin + 6, 16, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IFO', margin + 12, 24, { align: 'center' });

  // Organization Header
  doc.setFontSize(13.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Member Financial Statement', margin + 22, 21);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text('Individual Member Contribution & Event Settlement Statement', margin + 22, 26);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    pageWidth - margin - 6,
    21,
    { align: 'right' }
  );

  const statusLabel = isAllClear ? 'ALL SETTLED' : `PENDING DUE: ${formatPDFCurrency(totalPending)}`;

  doc.setFont('helvetica', 'bold');
  if (isAllClear) {
    doc.setTextColor(165, 243, 252);
  } else {
    doc.setTextColor(254, 205, 211);
  }
  doc.text(statusLabel, pageWidth - margin - 6, 26, { align: 'right' });

  let currentY = 48;

  // === 2. MEMBER PROFILE CARD ===
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(member.name, margin + 6, currentY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Role: ${member.role || 'Member'}   •   Phone: ${member.phone || 'N/A'}   •   Joined Events: ${joinedEventsCount}`, margin + 6, currentY + 14);

  currentY += 28;

  // === 3. EXECUTIVE 4-PILLAR FINANCIAL METRICS ===
  const boxWidth = (contentWidth - 9) / 4;
  const boxHeight = 18;

  const metrics = [
    { label: 'Events Joined', value: String(joinedEventsCount), sub: 'Active Roster' },
    { label: 'Total Paid (Donated)', value: formatPDFCurrency(totalPaid), sub: 'Event Contributions' },
    {
      label: 'Pending Dues',
      value: formatPDFCurrency(totalPending),
      sub: totalPending > 0 ? `${pendingEvents.length} events pending` : 'All cleared',
      isPending: true,
    },
    {
      label: 'Payment Status',
      value: isAllClear ? 'Settled' : 'Action Due',
      sub: isAllClear ? 'All cleared' : `${pendingEvents.length} pending`,
      isStatus: true,
    },
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (boxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(m.label.toUpperCase(), x + boxWidth / 2, currentY + 4.5, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    if (m.isPending) {
      if (totalPending > 0) doc.setTextColor(amberOrange[0], amberOrange[1], amberOrange[2]);
      else doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
    } else if (m.isStatus) {
      if (isAllClear) doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
      else doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
    } else {
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    }
    doc.text(m.value, x + boxWidth / 2, currentY + 10.5, { align: 'center' });

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(m.sub, x + boxWidth / 2, currentY + 15, { align: 'center' });
  });

  currentY += boxHeight + 8;

  // === 3B. PENDING EVENTS CALLOUT (IF ANY) ===
  if (pendingEvents.length > 0) {
    doc.setFillColor(254, 243, 199); // Amber tint
    doc.setDrawColor(245, 158, 11);
    const calloutHeight = 12 + pendingEvents.length * 6;
    doc.roundedRect(margin, currentY, contentWidth, calloutHeight, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`ATTENTION: ${pendingEvents.length} Event(s) with Pending Contributions (Total: ${formatPDFCurrency(totalPending)})`, margin + 5, currentY + 6);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    pendingEvents.forEach((pe, pIdx) => {
      doc.text(
        `• ${pe.eventName} (${pe.eventType}): Share ${formatPDFCurrency(pe.perMemberCost)} | Donated: ${formatPDFCurrency(pe.donatedAmount)} | PENDING: ${formatPDFCurrency(pe.pendingAmount)}`,
        margin + 6,
        currentY + 12 + pIdx * 5.5
      );
    });

    currentY += calloutHeight + 7;
  }

  // === 4. JOINED EVENTS BREAKDOWN TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('1. Events Participation & Contribution Ledger', margin, currentY);
  currentY += 3;

  const eventRows = joinedEvents.map((ev, idx) => {
    const evSummary = calculateEventSummary(ev, expenses, allMembers);
    const pe = pendingEvents.find((p) => p.eventId === ev.id);
    const evDonated = fin.eventDonations
      .filter((d) => d.eventId === ev.id)
      .reduce((sum, d) => sum + d.amount, 0);

    const isPending = !!pe && pe.pendingAmount > 0;
    const evStatus = isPending ? `DUE (${formatPDFCurrency(pe.pendingAmount)})` : 'SETTLED';

    return [
      String(idx + 1),
      ev.name,
      formatDate(ev.date),
      formatPDFCurrency(evSummary.totalCost),
      formatPDFCurrency(evSummary.perMemberCost),
      formatPDFCurrency(evDonated),
      isPending ? formatPDFCurrency(pe.pendingAmount) : 'Rs. 0',
      evStatus,
    ];
  });

  if (eventRows.length === 0) {
    eventRows.push(['-', 'No events joined yet', '-', '-', '-', '-', '-', 'N/A']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Event Name', 'Date', 'Event Total', 'Share Cost', 'Donated (Paid)', 'Pending Due', 'Status']],
    body: eventRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 20 },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 20, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY || currentY + 40;
  finalY += 8;

  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 5. DIRECT EXPENSES PAID BY MEMBER ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('2. Direct Out-of-Pocket Expense Bills Paid', margin, finalY);
  finalY += 3;

  const expenseRows = memberExpenses.map((exp, idx) => {
    const parentEvent = events.find((e) => e.id === exp.eventId);
    return [
      String(idx + 1),
      formatDate(exp.date),
      parentEvent?.name || 'General',
      exp.name,
      exp.category || 'General',
      (exp.paymentMethod || 'cash').toUpperCase(),
      formatPDFCurrency(exp.amount),
    ];
  });

  if (expenseRows.length === 0) {
    expenseRows.push(['-', '-', 'No direct payments recorded', '-', '-', '-', formatPDFCurrency(0)]);
  }

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['#', 'Date', 'Event', 'Expense Item', 'Category', 'Method', 'Amount Paid']],
    body: expenseRows,
    foot: [
      [
        '',
        '',
        '',
        'Total Direct Out-of-Pocket Spending',
        '',
        '',
        formatPDFCurrency(totalPaid),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 36 },
      3: { cellWidth: 46, fontStyle: 'bold' },
      4: { cellWidth: 26 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 40;
  finalY += 10;

  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 20;
  }

  // === 6. AUDIT & SIGNATURE BLOCK ===
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('Prepared by: Tm ISHAL Organizer', margin, finalY);
  doc.text('Verified by: Treasurer', margin + 70, finalY);
  doc.text('Member Acknowledgment: ___________________', margin + 120, finalY);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      `IFO • Tm ISHAL Member Statement • ${member.name}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  const sanitized = member.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Tm_ISHAL_${sanitized}_Statement.pdf`);
}

/**
 * Generate and download a complete 17-Member Roster & Ledger Report PDF
 */
export function downloadRosterPDF(
  members: Member[],
  events: EventItem[],
  expenses: Expense[],
  transactions: Transaction[] = []
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors Palette
  const primaryNavy = [11, 25, 56]; // #0B1938
  const accentBlue = [37, 99, 235]; // #2563EB
  const textDark = [15, 23, 42]; // #0F172A
  const textMuted = [100, 116, 139]; // #64748B
  const bgLight = [248, 250, 252]; // #F8FAFC
  const borderLight = [226, 232, 240]; // #E2E8F0

  // === 1. TOP HEADER BANNER ===
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 28, 3, 3, 'F');

  // Badge Accent
  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.roundedRect(margin + 6, 15.5, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IFO', margin + 12, 23.5, { align: 'center' });

  // Organization Header
  doc.setFontSize(13.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Community Members Roster & Contribution Ledger', margin + 22, 20);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text(`Official Directory (${members.length} Members) • Event Donations & Pending Dues Audit`, margin + 22, 25.5);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    pageWidth - margin - 6,
    20,
    { align: 'right' }
  );

  let currentY = 46;

  // Member audit ledger rows
  let totalAllPaid = 0;
  let totalAllPending = 0;

  const tableRows = members.map((member, idx) => {
    const fin = getMemberFinancials(member, events, expenses, transactions);
    totalAllPaid += fin.totalPaid;
    totalAllPending += fin.totalPending;

    const pendingDetails = fin.pendingEvents.length > 0
      ? fin.pendingEvents.map((pe) => `${pe.eventName} (${formatPDFCurrency(pe.pendingAmount)})`).join(', ')
      : 'All Cleared';

    const statusText = fin.isAllClear
      ? `SETTLED (${fin.avgPaymentDelayDays}d avg)`
      : `${fin.pendingEvents.length} PENDING (${fin.maxDelayDays}d overdue)`;

    return [
      String(idx + 1),
      member.name,
      member.role || 'Member',
      member.phone || '-',
      `${fin.joinedEventsCount} events`,
      formatPDFCurrency(fin.totalPaid),
      formatPDFCurrency(fin.totalPending),
      pendingDetails,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Name', 'Role', 'Phone Number', 'Events', 'Total Paid (Donated)', 'Pending Dues', 'Pending Events Detail', 'Status']],
    body: tableRows,
    foot: [
      [
        '',
        `Total (${members.length} Members)`,
        '',
        '',
        `${events.length} events`,
        formatPDFCurrency(totalAllPaid),
        formatPDFCurrency(totalAllPending),
        `${members.filter((m) => !getMemberFinancials(m, events, expenses, transactions).isAllClear).length} members with dues`,
        '',
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 14, halign: 'center' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 35 },
      8: { cellWidth: 16, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY || currentY + 40;
  finalY += 10;

  if (finalY > pageHeight - 30) {
    doc.addPage();
    finalY = 20;
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      'IFO • Tm ISHAL Directory & Members Ledger Report',
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Tm_ISHAL_Members_Roster_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generate and download professional Other Expenses (Petty Cash Book) Statement PDF
 */
export function downloadPettyCashBookPDF(
  expenses: Expense[],
  members: Member[],
  openingBalance: number,
  netTreasuryBalance: number
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors Palette
  const primaryNavy = [11, 25, 56]; // #0B1938
  const secondaryNavy = [21, 38, 77];
  const accentAmber = [217, 119, 6]; // #D97706
  const textDark = [15, 23, 42]; // #0F172A
  const textMuted = [100, 116, 139]; // #64748B
  const bgLight = [248, 250, 252]; // #F8FAFC
  const borderLight = [226, 232, 240]; // #E2E8F0
  const emeraldGreen = [5, 150, 105]; // #059669
  const roseRed = [225, 29, 72]; // #E11D48

  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCash = expenses
    .filter((e) => (e.paymentMethod || 'cash') === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalBank = expenses
    .filter((e) => e.paymentMethod === 'bank')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Top Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 32, 3, 3, 'F');

  // Badge Accent
  doc.setFillColor(accentAmber[0], accentAmber[1], accentAmber[2]);
  doc.roundedRect(margin + 6, 16, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PCB', margin + 12, 24, { align: 'center' });

  // Organization Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Other Expenses (Petty Cash Book)', margin + 22, 21);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text('General Community Operating Expenses • Disbursed Directly from Treasury Balance', margin + 22, 26.5);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated on: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    pageWidth - margin - 6,
    21,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(253, 230, 138);
  doc.text(
    'NO MEMBER COLLECTION NEEDED',
    pageWidth - margin - 6,
    26.5,
    { align: 'right' }
  );

  let currentY = 50;

  // Policy / Explanation Card
  doc.setFillColor(254, 243, 199); // light amber
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(146, 64, 14);
  doc.text('Operating Principle (Petty Cash Book):', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text(
    'These expenses do not require collecting contributions or cost splits from members. All routine snacks, stationery, utilities,',
    margin + 4,
    currentY + 11
  );
  doc.text(
    'and emergency maintenance disbursements are paid directly out of the total available community fund balance.',
    margin + 4,
    currentY + 15
  );

  currentY += 23;

  // Key Metrics Row (4 Cards)
  const cardWidth = (contentWidth - 9) / 4;

  const metrics = [
    { label: 'TOTAL PETTY CASH SPENT', val: formatPDFCurrency(totalSpent), color: roseRed },
    { label: 'CURRENT TREASURY BALANCE', val: formatPDFCurrency(netTreasuryBalance), color: emeraldGreen },
    { label: 'CASH DISBURSEMENTS', val: formatPDFCurrency(totalCash), color: textDark },
    { label: 'BANK / UPI DISBURSEMENTS', val: formatPDFCurrency(totalBank), color: textDark },
  ];

  metrics.forEach((m, idx) => {
    const x = margin + idx * (cardWidth + 3);
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(x, currentY, cardWidth, 18, 2, 2, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(m.label, x + 3, currentY + 6);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, currentY + 14);
  });

  currentY += 24;

  // Expenses Table
  const tableRows = expenses.map((exp, idx) => {
    const paidBy = exp.paidById === 'fund'
      ? 'Group Fund'
      : members.find((m) => m.id === exp.paidById)?.name || 'Member';
    const method = (exp.paymentMethod || 'cash').toUpperCase();
    const dateStr = formatDate(exp.date);
    const receipt = exp.receiptNo ? `#${exp.receiptNo}` : `V-${String(idx + 1).padStart(3, '0')}`;

    return [
      dateStr,
      receipt,
      exp.name,
      exp.category || 'General',
      paidBy,
      method,
      formatPDFCurrency(exp.amount),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Date', 'Voucher #', 'Expense Description', 'Category', 'Paid By', 'Mode', 'Amount']],
    body: tableRows.length > 0 ? tableRows : [['-', '-', 'No petty cash expenses recorded yet.', '-', '-', '-', 'Rs. 0']],
    theme: 'grid',
    headStyles: {
      fillColor: [primaryNavy[0], primaryNavy[1], primaryNavy[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      textColor: [textDark[0], textDark[1], textDark[2]],
      lineColor: [borderLight[0], borderLight[1], borderLight[2]],
      lineWidth: 0.2,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'bold' },
      3: { cellWidth: 32 },
      4: { cellWidth: 24 },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [roseRed[0], roseRed[1], roseRed[2]] },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      'IFO • Tm ISHAL Other Expenses (Petty Cash Book) Audit Report',
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Tm_ISHAL_Petty_Cash_Book_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generate and download a high-quality, professional Custom Range Financial Statement PDF
 */
export function downloadCustomRangePDF(
  startDate: string,
  endDate: string,
  transactions: Transaction[],
  expenses: Expense[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Filter transactions and expenses by range
  const filteredTxs = transactions.filter((tx) => {
    if (!tx.date) return false;
    if (startDate && tx.date < startDate) return false;
    if (endDate && tx.date > endDate) return false;
    return true;
  });

  const filteredExpenses = expenses.filter((exp) => {
    if (!exp.date) return false;
    if (startDate && exp.date < startDate) return false;
    if (endDate && exp.date > endDate) return false;
    return true;
  });

  const collections = filteredTxs
    .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const totalExpenseAmount = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netMargin = collections - totalExpenseAmount;

  // Cash vs Bank
  const cashInflow = filteredTxs
    .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && (tx.paymentMethod || 'cash') === 'cash')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const bankInflow = filteredTxs
    .filter((tx) => tx.transactionType === 'Contribution' && tx.paymentStatus === 'Paid' && tx.paymentMethod === 'bank')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const cashOutflow = filteredExpenses
    .filter((e) => (e.paymentMethod || 'cash') === 'cash')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const bankOutflow = filteredExpenses
    .filter((e) => e.paymentMethod === 'bank')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Palette
  const primaryNavy = [11, 25, 56];
  const accentBlue = [37, 99, 235];
  const textDark = [15, 23, 42];
  const borderLight = [226, 232, 240];
  const emeraldGreen = [5, 150, 105];
  const roseRed = [225, 29, 72];

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 32, 3, 3, 'F');

  doc.setFillColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.roundedRect(margin + 6, 16, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('IFO', margin + 12, 24, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Tm ISHAL — Custom Range Statement', margin + 22, 21);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 210, 245);
  doc.text(
    `Period: ${formatDate(startDate)} to ${formatDate(endDate)} • Official Financial Report`,
    margin + 22,
    26.5
  );

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    pageWidth - margin - 6,
    21,
    { align: 'right' }
  );

  // Summary KPI Cards
  const kpiY = 48;
  const colWidth = (contentWidth - 6) / 3;

  // Inflow Card
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, kpiY, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL COLLECTIONS (INFLOW)', margin + 4, kpiY + 6);
  doc.setFontSize(11);
  doc.text(formatPDFCurrency(collections), margin + 4, kpiY + 13);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cash: ${formatPDFCurrency(cashInflow)} | Bank: ${formatPDFCurrency(bankInflow)}`, margin + 4, kpiY + 17.5);

  // Outflow Card
  doc.setFillColor(255, 241, 242);
  doc.roundedRect(margin + colWidth + 3, kpiY, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL EXPENSES (OUTFLOW)', margin + colWidth + 7, kpiY + 6);
  doc.setFontSize(11);
  doc.text(formatPDFCurrency(totalExpenseAmount), margin + colWidth + 7, kpiY + 13);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cash: ${formatPDFCurrency(cashOutflow)} | Bank: ${formatPDFCurrency(bankOutflow)}`, margin + colWidth + 7, kpiY + 17.5);

  // Net Balance Card
  doc.setFillColor(240, 249, 255);
  doc.roundedRect(margin + (colWidth + 3) * 2, kpiY, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('NET PERIOD BALANCE', margin + (colWidth + 3) * 2 + 4, kpiY + 6);
  doc.setFontSize(11);
  doc.text(
    `${netMargin >= 0 ? '+' : ''}${formatPDFCurrency(netMargin)}`,
    margin + (colWidth + 3) * 2 + 4,
    kpiY + 13
  );
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${filteredTxs.length} Transactions Recorded`, margin + (colWidth + 3) * 2 + 4, kpiY + 17.5);

  // Itemized Transactions Table
  const tableRows = filteredTxs.map((tx) => [
    formatDate(tx.date),
    tx.transactionId || '-',
    tx.nameOrCategory || '-',
    tx.event || '-',
    tx.transactionType || '-',
    (tx.paymentMethod || 'cash').toUpperCase(),
    tx.paymentStatus || 'Recorded',
    `${tx.transactionType === 'Contribution' ? '+' : '-'}${formatPDFCurrency(tx.amount)}`,
  ]);

  autoTable(doc, {
    startY: 72,
    margin: { left: margin, right: margin },
    head: [['Date', 'TX ID', 'Description', 'Event', 'Type', 'Mode', 'Status', 'Amount']],
    body: tableRows.length > 0 ? tableRows : [['-', '-', 'No transactions recorded in this range.', '-', '-', '-', '-', 'Rs. 0']],
    theme: 'grid',
    headStyles: {
      fillColor: [primaryNavy[0], primaryNavy[1], primaryNavy[2]],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      textColor: [textDark[0], textDark[1], textDark[2]],
      lineColor: [borderLight[0], borderLight[1], borderLight[2]],
      lineWidth: 0.2,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 16, fontStyle: 'bold' },
      2: { cellWidth: 'auto', fontStyle: 'bold' },
      3: { cellWidth: 26 },
      4: { cellWidth: 22 },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      `IFO • Tm ISHAL Custom Period Statement (${startDate} to ${endDate})`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Tm_ISHAL_Statement_${startDate}_to_${endDate}.pdf`);
}

/**
 * Generate and download an official Member Credit & Advance Statement PDF
 */
export function downloadMemberCreditStatementPDF(
  member: Member,
  creditTransactions: Transaction[],
  summary: { totalGiven: number; totalRepaid: number; outstanding: number }
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors Palette
  const primaryNavy: [number, number, number] = [11, 25, 56]; // #0B1938
  const textDark: [number, number, number] = [15, 23, 42]; // #0F172A
  const textMuted: [number, number, number] = [100, 116, 139]; // #64748B

  // Top header banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 30, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Tm ISHAL • MEMBER CREDIT STATEMENT', margin + 6, 23);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Emergency Assistance & Credit Facility (Disbursed from Group Balance)', margin + 6, 31);

  // Member Information Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 46, contentWidth, 24, 2, 2, 'FD');

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(member.name, margin + 5, 54);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const phoneText = member.phone ? `Phone: ${member.phone}` : 'No phone recorded';
  const roleText = member.role ? `Role: ${member.role}` : 'Community Member';
  doc.text(`${roleText} • ${phoneText} • Member ID: ${member.id}`, margin + 5, 62);

  // 3 KPI Boxes
  const cardW = (contentWidth - 6) / 3;
  const kpiY = 74;

  // Box 1: Total Given
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(margin, kpiY, cardW, 18, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text('TOTAL CREDIT GIVEN', margin + 4, kpiY + 6);
  doc.setFontSize(11);
  doc.text(formatPDFCurrency(summary.totalGiven), margin + 4, kpiY + 14);

  // Box 2: Total Repaid
  const kpi2X = margin + cardW + 3;
  doc.setFillColor(209, 250, 229);
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(kpi2X, kpiY, cardW, 18, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text('TOTAL REPAID BACK', kpi2X + 4, kpiY + 6);
  doc.setFontSize(11);
  doc.text(formatPDFCurrency(summary.totalRepaid), kpi2X + 4, kpiY + 14);

  // Box 3: Net Outstanding
  const kpi3X = kpi2X + cardW + 3;
  const isDue = summary.outstanding > 0;
  doc.setFillColor(isDue ? 254 : 241, isDue ? 226 : 245, isDue ? 226 : 249);
  doc.setDrawColor(isDue ? 248 : 203, isDue ? 113 : 213, isDue ? 113 : 225);
  doc.roundedRect(kpi3X, kpiY, cardW, 18, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(isDue ? 185 : 71, isDue ? 28 : 85, isDue ? 28 : 105);
  doc.text(isDue ? 'OUTSTANDING DUE' : 'ACCOUNT STATUS', kpi3X + 4, kpiY + 6);
  doc.setFontSize(11);
  doc.text(isDue ? formatPDFCurrency(summary.outstanding) : 'CLEARED (Rs. 0)', kpi3X + 4, kpiY + 14);

  // Table of transactions sorted chronologically
  const sortedTxs = [...creditTransactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runBalance = 0;
  const tableData = sortedTxs.map((tx, idx) => {
    const isGiven = tx.transactionType === 'Member Credit';
    if (isGiven) {
      runBalance += tx.amount;
    } else {
      runBalance = Math.max(0, runBalance - tx.amount);
    }

    return [
      String(idx + 1),
      formatDate(tx.date),
      tx.transactionId,
      isGiven ? 'Credit Disbursed' : 'Repayment Received',
      (tx.paymentMethod || 'bank').toUpperCase(),
      isGiven ? `+${formatPDFCurrency(tx.amount)}` : `-${formatPDFCurrency(tx.amount)}`,
      formatPDFCurrency(runBalance),
      tx.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: 97,
    head: [['#', 'Date', 'TX ID', 'Transaction Type', 'Mode', 'Amount', 'Balance', 'Notes']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', 'No transactions recorded', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 32 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 'auto' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.text(
      `IFO • Tm ISHAL Official Member Credit Statement • Generated on ${new Date().toLocaleDateString('en-GB')}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  doc.save(`Tm_ISHAL_Credit_Statement_${member.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

/**
 * Generate and download an official Credit Note Voucher PDF
 */
export function downloadCreditNoteVoucherPDF(cn: CreditNote) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Colors Palette
  const primaryNavy: [number, number, number] = [11, 25, 56];
  const textDark: [number, number, number] = [15, 23, 42];
  const textMuted: [number, number, number] = [100, 116, 139];

  // Header Banner
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, 12, contentWidth, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Tm ISHAL • CREDIT NOTE VOUCHER', margin + 6, 23);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Official Welfare & Emergency Advance Disbursement from Group Balance', margin + 6, 31);

  // Voucher Meta Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 44, contentWidth, 34, 2, 2, 'FD');

  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Voucher No: ${cn.voucherNo}`, margin + 5, 52);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Issue Date: ${formatDate(cn.date)}`, margin + 5, 60);
  doc.text(`Due Date: ${cn.dueDate ? formatDate(cn.dueDate) : 'Not specified'}`, margin + 5, 68);

  const col2X = margin + contentWidth / 2;
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Beneficiary: ${cn.memberName}`, col2X, 52);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(`Member ID: ${cn.memberId}`, col2X, 60);
  doc.text(`Payment Mode: ${(cn.paymentMethod || 'bank').toUpperCase()}`, col2X, 68);

  // 3 KPI Cards: Disbursed, Repaid, Remaining
  const cardW = (contentWidth - 6) / 3;
  const kpiY = 82;

  // Box 1: Disbursed Amount
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(margin, kpiY, cardW, 20, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text('ADVANCE DISBURSED', margin + 4, kpiY + 7);
  doc.setFontSize(12);
  doc.text(formatPDFCurrency(cn.amount), margin + 4, kpiY + 16);

  // Box 2: Total Repaid
  const kpi2X = margin + cardW + 3;
  doc.setFillColor(209, 250, 229);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(kpi2X, kpiY, cardW, 20, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text('AMOUNT REPAID', kpi2X + 4, kpiY + 7);
  doc.setFontSize(12);
  doc.text(formatPDFCurrency(cn.repaidAmount || 0), kpi2X + 4, kpiY + 16);

  // Box 3: Remaining Balance
  const kpi3X = kpi2X + cardW + 3;
  const isSettled = cn.status === 'settled';
  doc.setFillColor(isSettled ? 241 : 254, isSettled ? 245 : 243, isSettled ? 249 : 199);
  doc.setDrawColor(isSettled ? 203 : 251, isSettled ? 213 : 191, isSettled ? 225 : 36);
  doc.roundedRect(kpi3X, kpiY, cardW, 20, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setTextColor(isSettled ? 71 : 180, isSettled ? 85 : 83, isSettled ? 105 : 9);
  doc.text(isSettled ? 'VOUCHER STATUS' : 'OUTSTANDING BALANCE', kpi3X + 4, kpiY + 7);
  doc.setFontSize(12);
  doc.text(isSettled ? 'FULLY SETTLED' : formatPDFCurrency(cn.remainingAmount), kpi3X + 4, kpiY + 16);

  // Purpose & Terms
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 107, contentWidth, 22, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('Purpose of Credit Advance:', margin + 5, 114);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(cn.purpose || 'Welfare / Emergency Support', margin + 5, 122);

  // Repayments Table
  const repaymentRows = (cn.repayments || []).map((rep, idx) => [
    String(idx + 1),
    formatDate(rep.date),
    (rep.paymentMethod || 'bank').toUpperCase(),
    formatPDFCurrency(rep.amount),
    rep.notes || '-',
  ]);

  autoTable(doc, {
    startY: 134,
    head: [['#', 'Repayment Date', 'Payment Method', 'Amount Received', 'Notes']],
    body:
      repaymentRows.length > 0
        ? repaymentRows
        : [['-', '-', '-', 'No repayments recorded yet', '-']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: primaryNavy,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 'auto' },
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 25 : 180;

  // Signatures
  if (finalY < pageHeight - 35) {
    doc.setDrawColor(203, 213, 225);
    doc.line(margin + 10, finalY, margin + 60, finalY);
    doc.line(pageWidth - margin - 60, finalY, pageWidth - margin - 10, finalY);

    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.setFont('helvetica', 'normal');
    doc.text('Beneficiary Signature', margin + 18, finalY + 5);
    doc.text('Authorized Treasurer', pageWidth - margin - 52, finalY + 5);
  }

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
  doc.text(
    `IFO • Tm ISHAL Official Credit Note Voucher • Generated on ${new Date().toLocaleDateString('en-GB')}`,
    margin,
    pageHeight - 6
  );

  doc.save(`Tm_ISHAL_Credit_Voucher_${cn.voucherNo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

