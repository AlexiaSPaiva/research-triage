/**
 * CSV reader for reference-manager exports.
 *
 * Implements the part of RFC 4180 that actually occurs in these files: quoted
 * fields, embedded commas, embedded newlines, and "" as an escaped quote. An
 * abstract routinely contains all four, so a naive `split(',')` corrupts real
 * data — which is why this is a small state machine rather than one line.
 *
 * Column names differ per tool, so headers are matched against a list of known
 * aliases (Zotero writes "Abstract Note", PubMed writes "Abstract").
 */

import { IMPORT_LIMITS, safeString } from './importLimits.js';

/** Header aliases, lowercased. First match in file order wins. */
const COLUMN_ALIASES = {
  title: ['title', 'document title', 'article title', 'ti'],
  abstract: ['abstract', 'abstract note', 'abstractnote', 'ab', 'description'],
  authors: ['authors', 'author', 'author full names', 'au', 'creator'],
  year: ['year', 'publication year', 'date', 'py'],
  doi: ['doi', 'di'],
};

/**
 * Splits CSV text into rows of fields.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // Normalise line endings first so the state machine only handles '\n'.
  const input = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1; // Escaped quote: consume both characters.
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Flush the last field unless the file ended with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Maps header names to column indices.
 *
 * @param {string[]} header
 * @returns {Record<keyof typeof COLUMN_ALIASES, number>} -1 when absent.
 */
export function mapColumns(header) {
  const normalised = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^\uFEFF/, ''),
  );
  const mapping = /** @type {Record<string, number>} */ ({});

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    mapping[field] = normalised.findIndex((name) => aliases.includes(name));
  }
  return mapping;
}

/**
 * Parses CSV text into articles.
 *
 * @param {string} text
 * @returns {{ articles: import('../domain/similarity.js').Article[], skipped: number, error: string | null }}
 */
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { articles: [], skipped: 0, error: 'CSV has no data rows below the header.' };
  }

  const columns = mapColumns(rows[0]);
  if (columns.title === -1) {
    return {
      articles: [],
      skipped: 0,
      error: `No title column found. Expected one of: ${COLUMN_ALIASES.title.join(', ')}.`,
    };
  }

  const articles = [];
  let skipped = 0;

  for (const row of rows.slice(1, IMPORT_LIMITS.maxEntries + 1)) {
    const cell = (index) => (index === -1 ? '' : (row[index] ?? ''));
    const title = safeString(cell(columns.title), IMPORT_LIMITS.titleChars);

    if (!title) {
      skipped += 1;
      continue;
    }

    const year = Number.parseInt(cell(columns.year).slice(0, 4), 10);

    articles.push({
      id: safeString(cell(columns.doi), 200) || `csv-${articles.length + 1}`,
      title,
      abstract: safeString(cell(columns.abstract), IMPORT_LIMITS.abstractChars),
      authors: cell(columns.authors)
        .split(/;|(?:\s+and\s+)/i)
        .map((a) => safeString(a, 200))
        .filter(Boolean)
        .slice(0, IMPORT_LIMITS.maxAuthors),
      year: Number.isFinite(year) ? year : null,
      doi: safeString(cell(columns.doi), 200),
    });
  }

  skipped += Math.max(0, rows.length - 1 - IMPORT_LIMITS.maxEntries);
  return { articles, skipped, error: null };
}
