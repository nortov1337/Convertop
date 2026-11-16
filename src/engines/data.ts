import { promises as fsp } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { stringify as stringifyCsv } from 'csv-stringify/sync';
import { outputDir } from '../storage.js';
import { tempName, baseName } from '../util.js';
import { mimeOf } from '../formats.js';
import type { ConvertRequest, ConvertResult } from '../types.js';

interface Table {
  header: string[];
  rows: unknown[][];
}

function csvToTable(text: string): Table {
  const grid = parseCsv(text, { bom: true, relax_column_count: true }) as string[][];
  if (grid.length === 0) return { header: [], rows: [] };
  return { header: grid[0], rows: grid.slice(1) };
}

function jsonToTable(text: string): Table {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    if (data.length === 0) return { header: [], rows: [] };
    const first = data[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      const header = Object.keys(first as object);
      const rows = data.map((o) => header.map((k) => (o as Record<string, unknown>)[k]));
      return { header, rows };
    }
    if (Array.isArray(first)) return { header: [], rows: data as unknown[][] };
    return { header: [], rows: data.map((v) => [v]) };
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const header = Object.keys(data);
    return { header, rows: [header.map((k) => (data as Record<string, unknown>)[k])] };
  }
  return { header: [], rows: [[data]] };
}

async function xlsxToTable(buffer: Buffer): Promise<Table> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return { header: [], rows: [] };
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals: unknown[] = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      vals[colNumber - 1] = cell.text;
    });
    rows.push(vals);
  });
  if (rows.length === 0) return { header: [], rows: [] };
  return { header: rows[0].map(String), rows: rows.slice(1) };
}

async function readTable(req: ConvertRequest): Promise<Table> {
  const buf = await fsp.readFile(req.filePath);
  if (req.ext === 'csv') return csvToTable(buf.toString('utf8'));
  if (req.ext === 'json') return jsonToTable(buf.toString('utf8'));
  return xlsxToTable(buf);
}

async function writeXlsx(table: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  if (table.header.length) ws.addRow(table.header);
  for (const r of table.rows) ws.addRow(r);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function convertData(req: ConvertRequest): Promise<ConvertResult> {
  const table = await readTable(req);
  let buffer: Buffer;

  if (req.target === 'csv') {
    const grid: unknown[][] = [table.header, ...table.rows];
    buffer = Buffer.from(stringifyCsv(grid as string[][]));
  } else if (req.target === 'json') {
    const objs = table.rows.map((r) => Object.fromEntries(table.header.map((k, i) => [k, r[i] ?? null])));
    buffer = Buffer.from(JSON.stringify(objs, null, 2));
  } else {
    buffer = await writeXlsx(table);
  }

  const outPath = path.join(outputDir, tempName(req.target));
  await fsp.writeFile(outPath, buffer);
  return { filePath: outPath, filename: `${baseName(req.filename)}.${req.target}`, mime: mimeOf(req.target) };
}
