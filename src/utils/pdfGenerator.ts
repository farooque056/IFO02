import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EventItem, Expense, Member, Transaction } from '../types';
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

  const summary = calculateEventSummary(event, expenses, members, transactions);
  const eventExpenses = expenses.filter((e) => e.eventId === event.id);

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

  let currentY = 50;

  // === 2. EVENT DETAILS CARD ===
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(event.name, margin + 5, currentY + 7);

  // Meta row
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);

  const dateText = `Date: ${formatDate(event.date)}`;
  const locText = event.location ? `Location: ${event.location}` : 'Location: N/A';
  const typeText = `Type: ${event.type.toUpperCase()}`;
  const membersText = summary.weddingPersonName
    ? `Enrolled: ${summary.memberCount} (${summary.weddingPersonName} Exempt)`
    : `Enrolled: ${summary.memberCount} Members`;

  doc.text(dateText, margin + 5, currentY + 13.5);
  doc.text(locText, margin + 48, currentY + 13.5);
  doc.text(typeText, margin + 105, currentY + 13.5);
  doc.text(membersText, margin + 135, currentY + 13.5);

  if (event.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(`Note: ${event.notes}`, margin + 5, currentY + 19.5);
  }

  currentY += 28;

  // === 3. FINANCIAL SUMMARY METRIC BOXES ===
  const boxWidth = (contentWidth - 6) / 3;
  const boxHeight = 18;

  // Box 1: Total Cost
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 210, 245);
  doc.text('TOTAL EXPENDITURE', margin + 4, currentY + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(formatPDFCurrency(summary.totalCost), margin + 4, currentY + 13.5);

  // Box 2: Per Member Share
  doc.setFillColor(secondaryNavy[0], secondaryNavy[1], secondaryNavy[2]);
  doc.roundedRect(margin + boxWidth + 3, currentY, boxWidth, boxHeight, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 210, 245);
  doc.text('PER MEMBER SHARE', margin + boxWidth + 7, currentY + 5.5);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(formatPDFCurrency(summary.perMemberCost), margin + boxWidth + 7, currentY + 13.5);

  // Box 3: Payment Modes (Cash & Bank)
  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.roundedRect(margin + (boxWidth + 3) * 2, currentY, boxWidth, boxHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text('PAYMENT BREAKDOWN', margin + (boxWidth + 3) * 2 + 4, currentY + 5.5);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(emeraldGreen[0], emeraldGreen[1], emeraldGreen[2]);
  doc.text(`Cash: ${formatPDFCurrency(summary.cashTotal)}`, margin + (boxWidth + 3) * 2 + 4, currentY + 10.5);
  doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
  doc.text(`Bank/UPI: ${formatPDFCurrency(summary.bankTotal)}`, margin + (boxWidth + 3) * 2 + 4, currentY + 15);

  currentY += boxHeight + 6;

  // === 4. UNPAID MEMBERS ALERT BANNER (If any) ===
  if (summary.unpaidMembers.length > 0) {
    doc.setFillColor(254, 242, 242); // Red tint
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'FD');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(roseRed[0], roseRed[1], roseRed[2]);
    doc.text(
      `Pending Dues: ${summary.unpaidMembers.length} member(s) owe a total of ${formatPDFCurrency(summary.totalUnpaidAmount)} for this event.`,
      margin + 4,
      currentY + 6.5
    );

    currentY += 14;
  }

  // === 5. EXPENSE LEDGER TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('1. Itemized Transaction & Expense Ledger', margin, currentY);
  currentY += 3;

  const expenseRows = eventExpenses.map((exp, idx) => {
    const payer =
      exp.paidById === 'fund'
        ? 'Tm ISHAL Fund'
        : members.find((m) => m.id === exp.paidById)?.name || 'Member';
    const methodStr = (exp.paymentMethod || 'cash') === 'bank' ? 'Bank / UPI' : 'Cash';
    return [
      String(idx + 1),
      formatDate(exp.date),
      exp.name,
      exp.category,
      methodStr,
      payer,
      formatPDFCurrency(exp.amount),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['#', 'Date', 'Expense Item', 'Category', 'Method', 'Paid By', 'Amount']],
    body: expenseRows,
    foot: [
      [
        '',
        '',
        'Total Event Expenses',
        '',
        '',
        `${eventExpenses.length} bills`,
        formatPDFCurrency(summary.totalCost),
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 56],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2.2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 50, fontStyle: 'bold' },
      3: { cellWidth: 25 },
      4: { cellWidth: 22 },
      5: { cellWidth: 32 },
      6: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Get final Y from autoTable
  // @ts-ignore
  let finalY = doc.lastAutoTable?.finalY || currentY + 40;
  finalY += 8;

  // Check if we need a new page or have room for settlement & category summaries
  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 6. CATEGORY BREAKDOWN SUMMARY ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('2. Category Cost Distribution', margin, finalY);
  finalY += 3;

  const categoryRows = summary.categoryBreakdown.map((cat) => [
    cat.category,
    `${cat.count} items`,
    `${cat.percentage}%`,
    formatPDFCurrency(cat.amount),
  ]);

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['Category Name', 'Items Count', 'Share %', 'Total Amount']],
    body: categoryRows,
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
      0: { cellWidth: 60, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 52, halign: 'right', fontStyle: 'bold' },
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 30;
  finalY += 8;

  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 18;
  }

  // === 7. MEMBER SETTLEMENT & DUES TABLE ===
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text('3. Member Contribution & Settlement Statement', margin, finalY);
  finalY += 3;

  const settlementRows = summary.memberSettlement.map((m, idx) => {
    let statusText = 'Settled';
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
      formatPDFCurrency(m.totalPaid),
      m.isExemptFromSplit ? 'Rs. 0 (Exempt)' : formatPDFCurrency(m.expectedShare),
      balanceFormatted,
      statusText,
    ];
  });

  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    head: [['#', 'Member Name', 'Role', 'Amount Paid', 'Expected Share', 'Net Balance', 'Status']],
    body: settlementRows,
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 56],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 42, fontStyle: 'bold' },
      2: { cellWidth: 26 },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 26, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = settlementRows[data.row.index];
        const status = row[6];
        if (data.column.index === 5 || data.column.index === 6) {
          if (status === 'Receives Refund') {
            data.cell.styles.textColor = [5, 150, 105]; // Green
          } else if (status === 'Pending (Owes)') {
            data.cell.styles.textColor = [225, 29, 72]; // Red
          }
        }
      }
    },
  });

  // @ts-ignore
  finalY = doc.lastAutoTable?.finalY || finalY + 40;
  finalY += 12;

  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 20;
  }

  // === 8. SIGN-OFF & VERIFICATION BLOCK ===
  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  finalY += 6;

  doc.setFontSize(8);
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

    const statusText = fin.isAllClear ? 'SETTLED' : `${fin.pendingEvents.length} PENDING`;

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

