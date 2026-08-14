import { describe, it, expect } from 'vitest';
import { parseBibtex, readField, parseAuthors } from './bibtex.js';
import { parseCsv, parseCsvRows, mapColumns } from './csv.js';

describe('readField', () => {
  const entry = `key1,
    title = {Vascular dementia: a review},
    year = 2021,
    note = "quoted value"`;

  it('reads a brace-delimited field', () => {
    expect(readField(entry, 'title')).toBe('Vascular dementia: a review');
  });

  it('reads a quote-delimited field', () => {
    expect(readField(entry, 'note')).toBe('quoted value');
  });

  it('reads a bare value', () => {
    expect(readField(entry, 'year')).toBe('2021');
  });

  it('returns empty string for an absent field', () => {
    expect(readField(entry, 'abstract')).toBe('');
  });

  it('keeps nested braces intact instead of truncating', () => {
    const nested = `k, title = {Alzheimer{'}s disease in {ELSA}}, year = 2020`;
    expect(readField(nested, 'title')).toBe("Alzheimer{'}s disease in {ELSA}");
  });

  it('is case-insensitive on the field name', () => {
    expect(readField('k, TITLE = {Upper}', 'title')).toBe('Upper');
  });

  it('does not match a field name that is only a suffix of another', () => {
    // "booktitle" must not be mistaken for "title".
    expect(readField('k, booktitle = {Proceedings}', 'title')).toBe('');
  });
});

describe('parseAuthors', () => {
  it('splits on " and " and flips "Surname, Given"', () => {
    expect(parseAuthors('Smith, John and Doe, Jane')).toEqual(['John Smith', 'Jane Doe']);
  });

  it('leaves already-natural names alone', () => {
    expect(parseAuthors('John Smith')).toEqual(['John Smith']);
  });

  it('returns an empty array for an empty field', () => {
    expect(parseAuthors('')).toEqual([]);
  });
});

describe('parseBibtex', () => {
  const bib = `
@article{silva2021,
  title = {Cognitive decline in vascular dementia},
  abstract = {We examined executive function in a longitudinal cohort.},
  author = {Silva, Ana and Costa, Bruno},
  year = {2021},
  doi = {10.1000/abc}
}
@inproceedings{nolan2019,
  title = {Frontotemporal dementia phenotypes},
  year = {2019}
}
`;

  it('parses every entry with a title', () => {
    const { articles } = parseBibtex(bib);
    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe('Cognitive decline in vascular dementia');
    expect(articles[0].authors).toEqual(['Ana Silva', 'Bruno Costa']);
    expect(articles[0].year).toBe(2021);
    expect(articles[0].doi).toBe('10.1000/abc');
  });

  it('uses the citation key as id', () => {
    expect(parseBibtex(bib).articles[0].id).toBe('silva2021');
  });

  it('handles a missing abstract as empty, not undefined', () => {
    expect(parseBibtex(bib).articles[1].abstract).toBe('');
  });

  it('counts entries skipped for having no title', () => {
    const { articles, skipped } = parseBibtex('@article{x, year = {2020} }');
    expect(articles).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('returns nothing for text with no entries', () => {
    expect(parseBibtex('not bibtex at all').articles).toEqual([]);
  });

  it('does not throw on a truncated entry', () => {
    expect(() => parseBibtex('@article{x, title = {Unclosed')).not.toThrow();
  });
});

describe('parseCsvRows', () => {
  it('splits plain rows', () => {
    expect(parseCsvRows('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps a comma inside a quoted field', () => {
    expect(parseCsvRows('"Smith, John",2020')).toEqual([['Smith, John', '2020']]);
  });

  it('keeps a newline inside a quoted field', () => {
    expect(parseCsvRows('"line one\nline two",x')).toEqual([['line one\nline two', 'x']]);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsvRows('"she said ""yes""",x')).toEqual([['she said "yes"', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsvRows('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('does not emit a trailing empty row for a file ending in a newline', () => {
    expect(parseCsvRows('a,b\n')).toEqual([['a', 'b']]);
  });
});

describe('mapColumns', () => {
  it('recognises Zotero column names', () => {
    const mapping = mapColumns(['Key', 'Title', 'Abstract Note', 'Author', 'Publication Year']);
    expect(mapping.title).toBe(1);
    expect(mapping.abstract).toBe(2);
    expect(mapping.year).toBe(4);
  });

  it('reports -1 for a column that is absent', () => {
    expect(mapColumns(['Title']).doi).toBe(-1);
  });
});

describe('parseCsv', () => {
  it('parses a Zotero-style export', () => {
    const csv =
      'Title,Abstract Note,Author,Publication Year,DOI\n"Lewy body dementia","Visual hallucinations, early.","Silva, Ana; Costa, Bruno",2022,10.1/x';
    const { articles, error } = parseCsv(csv);
    expect(error).toBeNull();
    expect(articles).toHaveLength(1);
    expect(articles[0].abstract).toBe('Visual hallucinations, early.');
    expect(articles[0].authors).toEqual(['Silva, Ana', 'Costa, Bruno']);
    expect(articles[0].year).toBe(2022);
  });

  it('reports a missing title column instead of returning junk', () => {
    const { articles, error } = parseCsv('Foo,Bar\n1,2');
    expect(articles).toEqual([]);
    expect(error).toMatch(/no title column/i);
  });

  it('reports a header-only file', () => {
    expect(parseCsv('Title,Abstract').error).toMatch(/no data rows/i);
  });

  it('skips rows with an empty title and counts them', () => {
    const { articles, skipped } = parseCsv('Title,Abstract\n,orphan abstract\nReal title,text');
    expect(articles).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it('tolerates a row with fewer cells than the header', () => {
    const { articles } = parseCsv('Title,Abstract,DOI\nOnly a title');
    expect(articles[0].abstract).toBe('');
  });
});
