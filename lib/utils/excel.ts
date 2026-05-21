import ExcelJS from 'exceljs';

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
    if ('result' in value) return String((value as ExcelJS.CellFormulaValue).result ?? '');
    if ('text' in value) return String((value as { text: unknown }).text ?? '');
  }
  return String(value);
}

export async function writeExcelFile(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string,
  colWidths?: Record<string, number>,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  ws.columns = keys.map(key => ({
    header: key,
    key,
    width: colWidths?.[key] ?? Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2,
  }));
  ws.addRows(rows);
  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(new Uint8Array(buf), filename);
}

export async function writeExcelBuffer(
  rows: Record<string, unknown>[],
  sheetName: string,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  ws.columns = keys.map(key => ({ header: key, key }));
  ws.addRows(rows);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export async function readExcelRows(buffer: ArrayBuffer): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const result: unknown[][] = [];
  ws.eachRow(row => {
    // row.values[0] is always undefined in ExcelJS (1-indexed), so slice from 1
    result.push((row.values as ExcelJS.CellValue[]).slice(1).map(v => cellText(v)));
  });
  return result;
}

function triggerDownload(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
