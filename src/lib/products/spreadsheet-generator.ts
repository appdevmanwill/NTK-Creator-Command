import ExcelJS from 'exceljs';

export interface SpreadsheetSpec {
  title: string;
  brandColor: string;
  currencySymbol: string;
  categories: string[];
  rows: Array<{
    date: string;
    description: string;
    category: string;
    type: 'Income' | 'Expense';
    amount: number;
  }>;
}

const THIN_STONE: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFDCD5C6' } };
const GOLD_RULE: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FFD4AF37' } };

export async function buildFormulaExcelWorkbook(spec: SpreadsheetSpec): Promise<{
  buffer: Buffer;
  chartSummary: Array<{ category: string; total: number }>;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NTK Creator Command';
  wb.created = new Date();

  const rawHex = spec.brandColor.replace('#', '').toUpperCase();
  const accentHex = rawHex && /^[0-9A-F]{6}$/.test(rawHex) ? rawHex : '141210';

  const styleHeaderRow = (row: ExcelJS.Row) => {
    row.height = 28;
    row.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFF5ECD6' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentHex}` } };
    row.alignment = { vertical: 'middle' };
    row.eachCell((cell) => {
      cell.border = { top: THIN_STONE, left: THIN_STONE, right: THIN_STONE, bottom: GOLD_RULE };
    });
  };

  // 1. Data Tracker Sheet (Header remains Row 1 so all dynamic row references stay exact)
  const tracker = wb.addWorksheet('Data Tracker', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  tracker.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Description', key: 'description', width: 36 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Type', key: 'type', width: 13 },
    { header: 'Amount', key: 'amount', width: 17 },
    { header: 'Share of Total', key: 'share', width: 17 },
  ];

  styleHeaderRow(tracker.getRow(1));

  const lastDataRow = spec.rows.length + 1;
  spec.rows.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const added = tracker.addRow({
      date: row.date,
      description: row.description,
      category: row.category,
      type: row.type,
      amount: row.amount,
      share: { formula: `IF($E$${lastDataRow + 1}=0,0,E${excelRowNum}/$E$${lastDataRow + 1})` },
    });
    added.height = 22;
    added.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF141210' } };
    added.alignment = { vertical: 'middle' };
    if (idx % 2 === 1) {
      added.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F4' } };
    }
    added.eachCell((cell) => {
      cell.border = { top: THIN_STONE, left: THIN_STONE, right: THIN_STONE, bottom: THIN_STONE };
    });
    added.getCell('amount').numFmt = `${spec.currencySymbol}#,##0.00`;
    added.getCell('share').numFmt = '0.0%';
  });

  const totalRow = tracker.addRow({
    date: 'TOTAL',
    description: `${spec.rows.length} Transactions`,
    category: 'All Categories',
    type: 'Summary',
    amount: { formula: `SUM(E2:E${lastDataRow})` },
    share: { formula: `SUM(F2:F${lastDataRow})` },
  });
  totalRow.height = 25;
  totalRow.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF141210' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5ECD6' } };
  totalRow.alignment = { vertical: 'middle' };
  totalRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF9E7318' } },
      bottom: { style: 'double', color: { argb: 'FF9E7318' } },
      left: THIN_STONE,
      right: THIN_STONE,
    };
  });
  totalRow.getCell('amount').numFmt = `${spec.currencySymbol}#,##0.00`;
  totalRow.getCell('share').numFmt = '0.0%';

  // 2. Dashboard Sheet (with REAL SUMIF / AVERAGE formulas preserving exact B2..B5 & 7+idx row coordinates)
  const dash = wb.addWorksheet('Dashboard', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  dash.columns = [
    { header: 'Metric / Category', key: 'label', width: 32 },
    { header: 'Value', key: 'value', width: 22 },
    { header: '% of Expense', key: 'pct', width: 18 },
  ];

  styleHeaderRow(dash.getRow(1));

  const kpiIncome = dash.addRow({
    label: 'Total Income',
    value: { formula: `SUMIF('Data Tracker'!D2:D${lastDataRow},"Income",'Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  const kpiExpense = dash.addRow({
    label: 'Total Expenses',
    value: { formula: `SUMIF('Data Tracker'!D2:D${lastDataRow},"Expense",'Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  const kpiNet = dash.addRow({
    label: 'Net Balance',
    value: { formula: 'B2-B3' },
    pct: { formula: 'IF(B2=0,0,B4/B2)' },
  });
  const kpiAvg = dash.addRow({
    label: 'Average Transaction Size',
    value: { formula: `AVERAGE('Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  [kpiIncome, kpiExpense, kpiNet, kpiAvg].forEach((r, idx) => {
    r.height = 24;
    r.font = { name: 'Segoe UI', size: 10.5, bold: idx === 2, color: { argb: 'FF141210' } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx === 2 ? 'FFF5ECD6' : 'FFFAF8F4' } };
    r.alignment = { vertical: 'middle' };
    r.eachCell((cell) => {
      cell.border = { top: THIN_STONE, left: THIN_STONE, right: THIN_STONE, bottom: THIN_STONE };
    });
  });

  const dividerRow = dash.addRow({ label: 'CATEGORY ALLOCATION BREAKDOWN', value: '', pct: '' });
  dividerRow.height = 24;
  dividerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF8C6410' } };
  dividerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEAE0' } };
  dividerRow.alignment = { vertical: 'middle' };

  spec.categories.forEach((cat, idx) => {
    const rNum = 7 + idx;
    const row = dash.addRow({
      label: cat,
      value: { formula: `SUMIF('Data Tracker'!C2:C${lastDataRow},"${cat}",'Data Tracker'!E2:E${lastDataRow})` },
      pct: { formula: `IF($B$3=0,0,B${rNum}/$B$3)` },
    });
    row.height = 22;
    row.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF141210' } };
    row.alignment = { vertical: 'middle' };
    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F4' } };
    }
    row.eachCell((cell) => {
      cell.border = { top: THIN_STONE, left: THIN_STONE, right: THIN_STONE, bottom: THIN_STONE };
    });
    row.getCell('value').numFmt = `${spec.currencySymbol}#,##0.00`;
    row.getCell('pct').numFmt = '0.0%';
  });

  for (let r = 2; r <= 5; r++) {
    dash.getCell(`B${r}`).numFmt = `${spec.currencySymbol}#,##0.00`;
  }
  dash.getCell('C4').numFmt = '0.0%';

  // 3. Categories & Settings Sheet
  const settings = wb.addWorksheet('Categories & Settings');
  settings.columns = [
    { header: 'Setting', key: 'setting', width: 28 },
    { header: 'Value', key: 'val', width: 38 },
  ];
  styleHeaderRow(settings.getRow(1));
  const settingEntries: Array<[string, string]> = [
    ['Workbook Title', spec.title],
    ['Currency Symbol', spec.currencySymbol],
    ...spec.categories.map((c, idx): [string, string] => [`Category ${idx + 1}`, c]),
  ];
  settingEntries.forEach(([setting, val], idx) => {
    const r = settings.addRow({ setting, val });
    r.height = 22;
    r.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF141210' } };
    r.alignment = { vertical: 'middle' };
    if (idx % 2 === 1) {
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF8F4' } };
    }
    r.eachCell((cell) => {
      cell.border = { top: THIN_STONE, left: THIN_STONE, right: THIN_STONE, bottom: THIN_STONE };
    });
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const totalIncome = spec.rows.filter((r) => r.type === 'Income').reduce((a, b) => a + b.amount, 0);
  const totalExpense = spec.rows.filter((r) => r.type === 'Expense').reduce((a, b) => a + b.amount, 0);
  const chartSummary = spec.categories.map((cat) => ({
    category: cat,
    total: Number(spec.rows.filter((r) => r.category === cat).reduce((a, b) => a + b.amount, 0).toFixed(2)),
  }));

  return {
    buffer,
    chartSummary,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    netBalance: Number((totalIncome - totalExpense).toFixed(2)),
  };
}
