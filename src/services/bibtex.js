/**
 * Minimal BibTeX reader — enough for what Zotero, Mendeley, PubMed and Google
 * Scholar export, and no more.
 *
 * It reads five fields (title, abstract, author, year, doi) from @-entries and
 * ignores everything else. It does NOT implement @string macros, @preamble,
 * cross-references or concatenation with `#`. Those appear in hand-maintained
 * .bib files, not in reference-manager exports, and supporting them would cost
 * more code than the whole app. Stated in the README under "Known limitations".
 *
 * Written by hand rather than pulled from npm: 80 lines that can be explained
 * line by line beat a dependency whose failure modes are opaque.
 */

import { IMPORT_LIMITS, safeString } from './importLimits.js';

/**
 * Reads one `field = {value}` / `field = "value"` / `field = value` pair.
 *
 * Brace counting matters: a title like `{Alzheimer{'}s} disease` contains nested
 * braces, and stopping at the first `}` would truncate it.
 *
 * @param {string} body Text inside a single @entry{...}.
 * @param {string} fieldName
 * @returns {string} Raw value, or '' when the field is absent.
 */
export function readField(body, fieldName) {
  const keyPattern = new RegExp(`(^|,)\\s*${fieldName}\\s*=\\s*`, 'i');
  const keyMatch = keyPattern.exec(body);
  if (!keyMatch) return '';

  let index = keyMatch.index + keyMatch[0].length;
  const opener = body[index];

  if (opener === '{') {
    let depth = 0;
    const start = index + 1;
    for (; index < body.length; index += 1) {
      if (body[index] === '{') depth += 1;
      else if (body[index] === '}') {
        depth -= 1;
        if (depth === 0) return body.slice(start, index);
      }
    }
    return body.slice(start); // Unbalanced braces: take what is there.
  }

  if (opener === '"') {
    const end = body.indexOf('"', index + 1);
    return end === -1 ? body.slice(index + 1) : body.slice(index + 1, end);
  }

  // Bare value (typically a year): runs to the next comma or end of entry.
  const end = body.slice(index).search(/[,\n]/);
  return end === -1 ? body.slice(index) : body.slice(index, index + end);
}

/** Removes TeX braces and escapes that survive field extraction. */
function cleanValue(value) {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\[a-zA-Z]+\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits a BibTeX author field on ` and `, then flips "Surname, Given" into
 * "Given Surname" for display.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function parseAuthors(value) {
  if (!value) return [];
  return value
    .split(/\s+and\s+/i)
    .map(cleanValue)
    .filter(Boolean)
    .map((name) => {
      const parts = name.split(',');
      return parts.length === 2 ? `${parts[1].trim()} ${parts[0].trim()}` : name;
    })
    .slice(0, IMPORT_LIMITS.maxAuthors);
}

/**
 * Parses BibTeX text into articles.
 *
 * Entries without a title are skipped: an article with nothing to match on
 * cannot be scored, and silently ranking it at zero would be misleading. The
 * count of skipped entries is returned so the UI can say so out loud.
 *
 * @param {string} text
 * @returns {{ articles: import('../domain/similarity.js').Article[], skipped: number }}
 */
export function parseBibtex(text) {
  const articles = [];
  let skipped = 0;

  // Split on @type{ boundaries. Anything before the first @ is a header/comment.
  const chunks = text.split(/@[a-zA-Z]+\s*\{/).slice(1);

  for (const chunk of chunks.slice(0, IMPORT_LIMITS.maxEntries)) {
    const citationKey = chunk.slice(0, chunk.indexOf(',')).trim();
    const title = safeString(cleanValue(readField(chunk, 'title')), IMPORT_LIMITS.titleChars);

    if (!title) {
      skipped += 1;
      continue;
    }

    const year = Number.parseInt(cleanValue(readField(chunk, 'year')), 10);

    articles.push({
      id: citationKey || `bib-${articles.length + 1}`,
      title,
      abstract: safeString(cleanValue(readField(chunk, 'abstract')), IMPORT_LIMITS.abstractChars),
      authors: parseAuthors(readField(chunk, 'author')),
      year: Number.isFinite(year) ? year : null,
      doi: safeString(cleanValue(readField(chunk, 'doi')), 200),
    });
  }

  skipped += Math.max(0, chunks.length - IMPORT_LIMITS.maxEntries);
  return { articles, skipped };
}
