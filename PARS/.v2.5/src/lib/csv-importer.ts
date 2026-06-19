/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Реализация парсера CSV для обратного импорта правок из Excel
// Используется для загрузки отредактированного куратором CSV и применения правок к editsMap хранилища. Зависимостей не добавляем.
// Потоковый разбор CSV (RFC 4180) без внешних зависимостей.

export type ParsedCsvRow = Record<string, string>;

export interface CsvImportResult {
  rows: ParsedCsvRow[];
  headers: string[];
  skippedRows: string[];
}

export interface CsvImportValidation {
  valid: boolean;
  missingColumns?: string[];
  error?: string;
}

export function stripBom(value: string): string {
  if (value.startsWith('\uFEFF')) {
    return value.slice(1);
  }
  return value;
}

export function parseCsv(content: string): CsvImportResult {
  const normalized = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsvLines(normalized);

  const headers = parseCsvLine(lines[0] || '').map((h) => h.trim());
  const rows: ParsedCsvRow[] = [];
  const skippedRows: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (isEmptyLine(line)) continue;
    const values = parseCsvLine(line);
    const row: ParsedCsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return { rows, headers, skippedRows };
}

export function validateCsvHeaders(headers: string[], required: string[]): CsvImportValidation {
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    return {
      valid: false,
      missingColumns: missing,
      error: `Отсутствуют обязательные колонки: ${missing.join(', ')}`,
    };
  }
  return { valid: true };
}

export function sanitizePostId(value: string): string {
  return value.trim();
}

export function sanitizeText(value: string): string {
  return value.trim();
}

export function sanitizePrice(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(/\s+/g, '').replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function splitCsvLines(input: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.length > 0 || inQuotes) {
    lines.push(current);
  }

  return lines;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}
