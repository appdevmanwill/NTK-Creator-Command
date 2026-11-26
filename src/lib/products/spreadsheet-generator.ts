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

  const accentHex = spec.brandColor.replace('#', '').toUpperCase() || '4F46E5';

  // 1. Data Tracker Sheet
  const tracker = wb.addWorksheet('Data Tracker');
  tracker.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Description', key: 'description', width: 34 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Amount', key: 'amount', width: 16 },
    { header: 'Share of Total', key: 'share', width: 16 },
  ];

  const headerRow = tracker.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentHex}` } };

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
  totalRow.font = { bold: true };
  totalRow.getCell('amount').numFmt = `${spec.currencySymbol}#,##0.00`;
  totalRow.getCell('share').numFmt = '0.0%';

  // 2. Dashboard Sheet (with REAL SUMIF / AVERAGE formulas)
  const dash = wb.addWorksheet('Dashboard');
  dash.columns = [
    { header: 'Metric / Category', key: 'label', width: 28 },
    { header: 'Value', key: 'value', width: 20 },
    { header: '% of Expense', key: 'pct', width: 18 },
  ];

  dash.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dash.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentHex}` } };

  dash.addRow({
    label: 'Total Income',
    value: { formula: `SUMIF('Data Tracker'!D2:D${lastDataRow},"Income",'Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  dash.addRow({
    label: 'Total Expenses',
    value: { formula: `SUMIF('Data Tracker'!D2:D${lastDataRow},"Expense",'Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  dash.addRow({
    label: 'Net Balance',
    value: { formula: 'B2-B3' },
    pct: { formula: 'IF(B2=0,0,B4/B2)' },
  });
  dash.addRow({
    label: 'Average Transaction Size',
    value: { formula: `AVERAGE('Data Tracker'!E2:E${lastDataRow})` },
    pct: '',
  });
  dash.addRow({ label: '--- Category Breakdown ---', value: '', pct: '' });

  spec.categories.forEach((cat, idx) => {
    const rNum = 7 + idx;
    const row = dash.addRow({
      label: cat,
      value: { formula: `SUMIF('Data Tracker'!C2:C${lastDataRow},"${cat}",'Data Tracker'!E2:E${lastDataRow})` },
      pct: { formula: `IF($B$3=0,0,B${rNum}/$B$3)` },
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
    { header: 'Setting', key: 'setting', width: 26 },
    { header: 'Value', key: 'val', width: 32 },
  ];
  settings.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  settings.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${accentHex}` } };
  settings.addRow({ setting: 'Workbook Title', val: spec.title });
  settings.addRow({ setting: 'Currency Symbol', val: spec.currencySymbol });
  spec.categories.forEach((c, idx) => {
    settings.addRow({ setting: `Category ${idx + 1}`, val: c });
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
