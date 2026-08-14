/**
 * TF-IDF vectors + cosine similarity. This is the core of research-triage, and
 * it is classical information retrieval — not machine learning, and not AI.
 *
 * ── How it works, in four steps ────────────────────────────────────────────
 * 1. Every article (title + abstract) is tokenised into terms.
 * 2. Each term gets a weight per document: how often it appears here (TF)
 *    multiplied by how rare it is across the whole set (IDF). A term appearing
 *    in every abstract is near-worthless for telling documents apart; a term
 *    appearing in three of two hundred is highly discriminative.
 * 3. Each document becomes a vector of those weights, scaled to unit length.
 * 4. The research profile is vectorised the same way, and similarity is the
 *    cosine of the angle between the two vectors: 1 = same direction, 0 = no
 *    shared vocabulary.
 *
 * The formulas match scikit-learn's TfidfVectorizer defaults (sublinear TF off,
 * smoothed IDF, L2 norm), so results are comparable with the Python ecosystem.
 *
 * ── What the number is NOT ─────────────────────────────────────────────────
 * A similarity score is a measure of shared vocabulary. It is not a judgement
 * of scientific merit, methodological quality or relevance of findings. An
 * excellent paper that describes the same idea in different words will score
 * low. This limitation is surfaced in the UI, not only here.
 */

import { tokenize } from './tokenize.js';

/**
 * @typedef {object} Article
 * @property {string} id
 * @property {string} title
 * @property {string} abstract
 * @property {string[]} [authors]
 * @property {number|null} [year]
 * @property {string} [doi]
 */

/**
 * @typedef {object} TermContribution
 * @property {string} term
 * @property {number} weight  Share of the final score this term accounts for, 0..1.
 */

/**
 * @typedef {object} ScoredArticle
 * @property {Article} article
 * @property {number} score      Cosine similarity, 0..1.
 * @property {TermContribution[]} topTerms
 */

/** The text of an article that takes part in matching. */
export function articleText(article) {
  return `${article.title ?? ''} ${article.abstract ?? ''}`;
}

/**
 * Counts terms in a document.
 *
 * @param {string[]} terms
 * @returns {Map<string, number>}
 */
export function termFrequency(terms) {
  const counts = new Map();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  return counts;
}

/**
 * Smoothed inverse document frequency, as in scikit-learn:
 *
 *   idf(t) = ln((1 + N) / (1 + df(t))) + 1
 *
 * The +1s ("smoothing") mean a term present in every document still gets a
 * weight of exactly 1 rather than 0, and a term absent from the corpus never
 * divides by zero.
 *
 * @param {Map<string, number>[]} documentTerms One term-count map per document.
 * @returns {Map<string, number>} term -> idf
 */
export function inverseDocumentFrequency(documentTerms) {
  const documentCount = documentTerms.length;
  const documentFrequency = new Map();

  for (const counts of documentTerms) {
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map();
  for (const [term, df] of documentFrequency) {
    idf.set(term, Math.log((1 + documentCount) / (1 + df)) + 1);
  }
  return idf;
}

/**
 * Builds an L2-normalised TF-IDF vector.
 *
 * Normalising to unit length is what makes a long review article comparable
 * with a short letter: without it, longer documents would score higher simply
 * for containing more words.
 *
 * Terms absent from `idf` are dropped. For the profile vector that means a word
 * the user typed which appears in no article contributes nothing — correct, as
 * it carries no information about how the articles differ.
 *
 * @param {Map<string, number>} counts
 * @param {Map<string, number>} idf
 * @returns {Map<string, number>} term -> normalised weight
 */
export function tfidfVector(counts, idf) {
  const raw = new Map();
  for (const [term, count] of counts) {
    const termIdf = idf.get(term);
    if (termIdf === undefined) continue;
    raw.set(term, count * termIdf);
  }

  let sumOfSquares = 0;
  for (const weight of raw.values()) sumOfSquares += weight * weight;
  const norm = Math.sqrt(sumOfSquares);
  if (norm === 0) return new Map();

  const normalised = new Map();
  for (const [term, weight] of raw) normalised.set(term, weight / norm);
  return normalised;
}

/**
 * Cosine similarity of two L2-normalised vectors.
 *
 * Because both vectors are already unit length, the cosine reduces to their dot
 * product — no division needed. TF-IDF weights are never negative, so the
 * result is always in [0, 1].
 *
 * Iterates over the smaller vector: the cost is the size of the smaller term
 * set, not of the vocabulary.
 *
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) dot += weight * other;
  }
  // Floating-point error can push a perfect match a hair above 1.
  return Math.min(1, dot);
}

/**
 * The per-term breakdown of a score, which is what makes the ranking auditable:
 * the user can see *which words* drove a match and judge whether the match is
 * meaningful or an artefact of shared jargon.
 *
 * Each term's contribution to the dot product is `query[t] * document[t]`, and
 * those contributions sum exactly to the score — so expressing them as shares
 * of the total is exact, not an approximation.
 *
 * @param {Map<string, number>} queryVector
 * @param {Map<string, number>} documentVector
 * @param {number} [limit]
 * @returns {TermContribution[]} Descending by weight.
 */
export function explainScore(queryVector, documentVector, limit = 5) {
  const contributions = [];
  let total = 0;

  for (const [term, weight] of queryVector) {
    const other = documentVector.get(term);
    if (other === undefined) continue;
    const contribution = weight * other;
    if (contribution <= 0) continue;
    contributions.push({ term, contribution });
    total += contribution;
  }

  if (total === 0) return [];

  return contributions
    .sort((x, y) => y.contribution - x.contribution)
    .slice(0, limit)
    .map(({ term, contribution }) => ({ term, weight: contribution / total }));
}

/**
 * Scores every article against the research profile query and ranks them.
 *
 * IDF is computed over the articles only, never including the query. The query
 * is a description of an interest, not a member of the collection being
 * described; letting it shift the document frequencies would make an article's
 * score depend on how verbose the user was.
 *
 * Ties are broken by title so the order is stable between runs — a ranking that
 * reshuffles on reload looks broken even when the numbers are identical.
 *
 * @param {string} query Usually `profileToQuery(profile)`.
 * @param {Article[]} articles
 * @param {{ topTermCount?: number }} [options]
 * @returns {ScoredArticle[]} Descending by score.
 */
export function rankArticles(query, articles, options = {}) {
  const { topTermCount = 5 } = options;
  if (!Array.isArray(articles) || articles.length === 0) return [];

  const documentTerms = articles.map((article) => termFrequency(tokenize(articleText(article))));
  const idf = inverseDocumentFrequency(documentTerms);

  const queryVector = tfidfVector(termFrequency(tokenize(query)), idf);

  return articles
    .map((article, index) => {
      const documentVector = tfidfVector(documentTerms[index], idf);
      return {
        article,
        score: cosineSimilarity(queryVector, documentVector),
        topTerms: explainScore(queryVector, documentVector, topTermCount),
      };
    })
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
}
