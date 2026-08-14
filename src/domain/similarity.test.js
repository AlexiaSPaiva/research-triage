import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  explainScore,
  inverseDocumentFrequency,
  rankArticles,
  termFrequency,
  tfidfVector,
} from './similarity.js';
import { tokenize, normaliseSuffix } from './tokenize.js';

/** Shorthand for building an article without repeating boilerplate. */
const article = (id, title, abstract) => ({ id, title, abstract });

describe('tokenize', () => {
  it('lowercases, strips accents and drops stopwords', () => {
    expect(tokenize('The análise of Dementia')).toEqual(['analise', 'dementia']);
  });

  it('drops terms shorter than three characters', () => {
    expect(tokenize('a bc cognitive')).toEqual(['cognitive']);
  });

  it('returns an empty array for empty or non-string input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(null)).toEqual([]);
  });

  it('collapses plurals so singular and plural are one term', () => {
    expect(tokenize('dementias dementia')).toEqual(['dementia', 'dementia']);
  });

  it('leaves words that only look plural intact', () => {
    // "analysis" ends in -is and "status" in -us: neither is a plural.
    expect(normaliseSuffix('diagnosis')).toBe('diagnosis');
    expect(normaliseSuffix('status')).toBe('status');
    expect(normaliseSuffix('illness')).toBe('illness');
  });
});

describe('termFrequency', () => {
  it('counts repeated terms', () => {
    expect(termFrequency(['a', 'b', 'a'])).toEqual(
      new Map([
        ['a', 2],
        ['b', 1],
      ]),
    );
  });
});

describe('inverseDocumentFrequency', () => {
  it('gives a term present in every document the minimum weight of 1', () => {
    const docs = [new Map([['shared', 1]]), new Map([['shared', 3]])];
    // ln((1+2)/(1+2)) + 1 = ln(1) + 1 = 1
    expect(inverseDocumentFrequency(docs).get('shared')).toBeCloseTo(1, 10);
  });

  it('weights a rare term above a common one', () => {
    const docs = [
      new Map([
        ['common', 1],
        ['rare', 1],
      ]),
      new Map([['common', 1]]),
      new Map([['common', 1]]),
    ];
    const idf = inverseDocumentFrequency(docs);
    expect(idf.get('rare')).toBeGreaterThan(idf.get('common'));
  });
});

describe('cosineSimilarity', () => {
  const idf = new Map([
    ['alzheimer', 2],
    ['vascular', 2],
    ['dementia', 1],
  ]);

  it('is 1 for identical vectors', () => {
    const v = tfidfVector(new Map([['alzheimer', 2]]), idf);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('is 0 when no terms are shared', () => {
    const a = tfidfVector(new Map([['alzheimer', 1]]), idf);
    const b = tfidfVector(new Map([['vascular', 1]]), idf);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('is 0 against an empty vector', () => {
    const a = tfidfVector(new Map([['alzheimer', 1]]), idf);
    expect(cosineSimilarity(a, new Map())).toBe(0);
  });

  it('is symmetric', () => {
    const a = tfidfVector(
      new Map([
        ['alzheimer', 1],
        ['dementia', 2],
      ]),
      idf,
    );
    const b = tfidfVector(
      new Map([
        ['dementia', 1],
        ['vascular', 1],
      ]),
      idf,
    );
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('ignores document length: repeating a document does not change the score', () => {
    // Same vocabulary, three times the volume -> identical direction.
    const short = tfidfVector(termFrequency(tokenize('vascular dementia')), idf);
    const long = tfidfVector(
      termFrequency(tokenize('vascular dementia vascular dementia vascular dementia')),
      idf,
    );
    expect(cosineSimilarity(short, long)).toBeCloseTo(1, 10);
  });
});

describe('tfidfVector', () => {
  it('produces a unit-length vector', () => {
    const idf = new Map([
      ['a', 2],
      ['b', 3],
    ]);
    const v = tfidfVector(
      new Map([
        ['a', 2],
        ['b', 1],
      ]),
      idf,
    );
    const norm = Math.sqrt([...v.values()].reduce((sum, w) => sum + w * w, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it('drops terms with no IDF entry instead of throwing', () => {
    const v = tfidfVector(new Map([['unknown', 5]]), new Map());
    expect(v.size).toBe(0);
  });
});

describe('explainScore', () => {
  it('returns shares that sum to 1', () => {
    const idf = new Map([
      ['alzheimer', 2],
      ['dementia', 1.5],
    ]);
    const q = tfidfVector(
      new Map([
        ['alzheimer', 1],
        ['dementia', 1],
      ]),
      idf,
    );
    const terms = explainScore(q, q);
    const total = terms.reduce((sum, t) => sum + t.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('ranks the rarer shared term first', () => {
    const idf = new Map([
      ['alzheimer', 4],
      ['dementia', 1],
    ]);
    const counts = new Map([
      ['alzheimer', 1],
      ['dementia', 1],
    ]);
    const v = tfidfVector(counts, idf);
    expect(explainScore(v, v)[0].term).toBe('alzheimer');
  });

  it('returns an empty list when nothing is shared', () => {
    expect(explainScore(new Map([['a', 1]]), new Map([['b', 1]]))).toEqual([]);
  });
});

describe('rankArticles', () => {
  const articles = [
    article('1', 'Vascular dementia and white matter lesions', 'Cerebrovascular burden in ageing.'),
    article(
      '2',
      'Predicting Alzheimer disease from cognitive decline',
      'Episodic memory decline predicts Alzheimer diagnosis in a longitudinal cohort.',
    ),
    article('3', 'Coffee consumption in Italy', 'A survey of espresso preferences.'),
  ];

  it('ranks closely on-topic above loosely on-topic above unrelated', () => {
    // The query shares "alzheimer/cognitive/decline" with article 2 and only
    // "dementia" with article 1, and nothing at all with article 3.
    const ranked = rankArticles('Alzheimer disease dementia cognitive decline', articles);
    expect(ranked.map((r) => r.article.id)).toEqual(['2', '1', '3']);
  });

  it('scores an unrelated article at zero', () => {
    const ranked = rankArticles('Alzheimer disease cognitive decline', articles);
    const coffee = ranked.find((r) => r.article.id === '3');
    expect(coffee.score).toBe(0);
  });

  it('keeps every score inside [0, 1]', () => {
    for (const { score } of rankArticles('dementia cohort', articles)) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('explains why the top article matched', () => {
    const ranked = rankArticles('Alzheimer disease', articles);
    expect(ranked[0].topTerms.map((t) => t.term)).toContain('alzheimer');
  });

  it('returns every article, never a filtered subset', () => {
    expect(rankArticles('anything', articles)).toHaveLength(articles.length);
  });

  it('handles an empty query without throwing', () => {
    const ranked = rankArticles('', articles);
    expect(ranked).toHaveLength(articles.length);
    expect(ranked.every((r) => r.score === 0)).toBe(true);
  });

  it('returns an empty array for an empty or invalid corpus', () => {
    expect(rankArticles('dementia', [])).toEqual([]);
    expect(rankArticles('dementia', null)).toEqual([]);
  });

  it('is deterministic: identical input gives identical order', () => {
    const first = rankArticles('dementia cohort', articles).map((r) => r.article.id);
    const second = rankArticles('dementia cohort', articles).map((r) => r.article.id);
    expect(first).toEqual(second);
  });

  it('breaks score ties by title so the order is stable', () => {
    const tied = [
      article('b', 'Beta paper', 'identical text'),
      article('a', 'Alpha paper', 'identical text'),
    ];
    // Both share the same abstract vocabulary, so scores match; title decides.
    const ranked = rankArticles('identical text', tied);
    expect(ranked.map((r) => r.article.title)).toEqual(['Alpha paper', 'Beta paper']);
  });
});
