/**
 * Text -> terms. The only place in the app that decides what counts as a word.
 *
 * Deliberately small and deliberately English-only: the corpus this tool was
 * written for (the ELSA cohort literature) is English. A different corpus needs
 * a different stopword list, and that is a known limitation, not a bug.
 */

/** Terms shorter than this carry little signal and add noise to the vectors. */
const MIN_TERM_LENGTH = 3;

/** Combining diacritical marks, stripped after NFD so "análise" === "analise". */
const COMBINING_MARKS = /[\u0300-\u036F]/g;

/**
 * Strips a plural suffix so "dementias" and "dementia" become the same term.
 *
 * This is NOT a stemmer. It is three suffix rules, chosen because plural/singular
 * mismatch is by far the most common reason a relevant abstract scores low in
 * this corpus. Real morphological stemming (Porter, Snowball) would need a
 * dependency and would not be explainable line by line; the trade-off is
 * documented under "Known limitations" in the README.
 *
 * @param {string} term
 * @returns {string}
 */
export function normaliseSuffix(term) {
  if (term.length <= 4) return term;
  if (term.endsWith('ies')) return `${term.slice(0, -3)}y`;
  if (term.endsWith('sses')) return term.slice(0, -2);
  if (term.endsWith('s') && !term.endsWith('ss') && !term.endsWith('is') && !term.endsWith('us')) {
    return term.slice(0, -1);
  }
  return term;
}

/**
 * Closed-class English words plus verbs that appear in nearly every abstract.
 * A term present in every document gets an IDF near zero anyway, so this list
 * is an optimisation and a readability aid more than a correctness fix.
 *
 * Stored already suffix-normalised, because tokenize() normalises before it
 * checks membership — otherwise "studies" would survive while "study" is dropped.
 */
export const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren as at be because been
   before being below between both but by can cannot could did do does doing done down during
   each few for from further had has have having he her here hers herself him himself his how
   however i if in into is it its itself just me more most my myself no nor not of off on once
   only or other others ought our ours ourselves out over own same she should so some such than
   that the their theirs them themselves then there these they this those through to too under
   until up very was we were what when where which while who whom why will with within would
   you your yours yourself yourselves
   study studies aim aims aimed objective objectives method methods result results conclusion
   conclusions background purpose using used use paper article research based show shown showed
   found finding findings suggest suggests data analysis analyses`
    .split(/\s+/)
    .filter(Boolean)
    .map(normaliseSuffix),
);

/**
 * @param {string} text
 * @returns {string[]} Terms in order of appearance; duplicates kept, so the
 *   caller can count term frequency.
 */
export function tokenize(text) {
  if (typeof text !== 'string' || text.length === 0) return [];

  return (
    text
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .toLowerCase()
      // Split on anything that is not a letter or digit. Hyphens split too, so
      // "cross-sectional" yields two terms — intended, it matches "sectional"
      // written separately elsewhere.
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= MIN_TERM_LENGTH)
      .map(normaliseSuffix)
      .filter((t) => t.length >= MIN_TERM_LENGTH && !STOPWORDS.has(t))
  );
}
