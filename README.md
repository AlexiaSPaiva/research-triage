# research-triage

[![CI](https://github.com/AlexiaSPaiva/research-triage/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexiaSPaiva/research-triage/actions/workflows/ci.yml)

**▶ Live app: https://alexiaspaiva.github.io/research-triage/**

Rank a pile of scientific articles by how much vocabulary they share with your research topic, so you can decide what to read first.

> **Stage 1 of 3 — litpipe**
> **screening (you are here)** → [reading](https://github.com/AlexiaSPaiva/reading-versions) → [author mapping](https://github.com/AlexiaSPaiva/author-mapping)

---

## The problem this solves

A literature search returns two hundred articles. Reading all of them in the order the database returned them wastes weeks, and reading only the first page biases the review toward whatever the search engine ranked highest.

I needed a way to put a large export from Zotero or PubMed into a defensible reading order, using a criterion I chose and can inspect — not a black box.

## What it does

- Takes a **research profile**: a free-text topic plus optional objectives.
- Takes articles by **pasting** title + abstract, or **importing** a `.bib` (BibTeX) or `.csv` export from Zotero, Mendeley, PubMed or Google Scholar.
- Scores every article by **cosine similarity between TF-IDF vectors** and ranks them.
- Shows, for each article, **which terms produced the score** — so the ranking is auditable rather than asserted.
- Exports the articles you tick as JSON, which is the input format of stage 2, [reading-versions](https://github.com/AlexiaSPaiva/reading-versions).

Everything runs in the browser. There is no server, no account and no upload.

## What the percentage is NOT

This matters more than any feature, so it is stated in the app's interface as well as here:

The score measures **shared vocabulary between two pieces of text**. It is not a measure of scientific quality, methodological rigour, novelty or importance, and it is not a prediction of anything. A superb, highly relevant paper will score low if it expresses the same ideas in different words — that is an inherent limitation of lexical matching, not a bug.

The ranking is a reading-order aid. It is not grounds to discard a paper unread.

## How the scoring works

Four steps, each of which I can explain and defend:

1. **Tokenise** — title and abstract are lowercased, stripped of accents, split into terms, and filtered against a stopword list. A three-rule plural normaliser makes `dementias` and `dementia` the same term.
2. **Weight** — each term gets `TF × IDF`: how often it occurs in this article, times how rare it is across the whole set. `idf(t) = ln((1 + N) / (1 + df(t))) + 1`, the smoothed form used by scikit-learn's `TfidfVectorizer`.
3. **Normalise** — each article becomes a vector scaled to unit length, so a long review is comparable with a short letter.
4. **Compare** — similarity is the cosine of the angle between the profile vector and the article vector. Both vectors are unit length and TF-IDF weights are never negative, so the result is always in `[0, 1]`.

The per-term breakdown shown in the UI is exact, not an approximation: each term's contribution to the dot product is `profile[t] × article[t]`, and those contributions sum to the score.

**This is classical information retrieval, from the 1970s.** It is not machine learning and not artificial intelligence, and this README will not call it either.

IDF is computed over the articles only, never including the profile text. The profile describes an interest; it is not a member of the collection being described, and letting it shift the document frequencies would make an article's score depend on how verbose the user was.

## Architecture decisions

| Decision | Why |
| --- | --- |
| **TF-IDF, not embeddings** | I have to be able to explain every line of the ranking logic in an interview. A cosine between TF-IDF vectors is arithmetic I can derive on a whiteboard; a similarity score returned by a paid embeddings API is a number I would have to take on faith. An optional embeddings mode is deliberately *not* implemented — it would be scope added before any measured need for it. |
| **No backend** | The tool operates on data the user already has, on their own machine. A server would add hosting, an auth surface, a privacy question about other people's unpublished abstracts, and a deployment to maintain — in exchange for nothing the user asked for. `localStorage` plus JSON export/import solves the real requirement, which is not losing work when switching machines. |
| **Hand-written `.bib` and `.csv` parsers** | Both are ~100 lines of code I can read end to end. A BibTeX dependency brings a parser whose failure modes I would be guessing at, for input formats I only need a fraction of. The limits of what these parsers accept are listed under *Known limitations* rather than hidden. |
| **MUI for components, Tailwind for layout** | Both are in the stack, and using both for the same job would mean two systems fighting over one element. So the boundary is explicit: MUI owns components (and brings keyboard and screen-reader behaviour I would otherwise write by hand), Tailwind owns spacing and layout. Tailwind's preflight is disabled so MUI's `CssBaseline` is the single reset. |
| **`shared/researchProfile.js` copied, not published** | The three apps share one contract. Publishing an npm package for three consumers I control myself would add versioning and release work to save copying forty lines. The file is byte-identical in all three repos on purpose. |
| **JSDoc types, not TypeScript** | Type information where it earns its place — the shared profile contract and the domain functions — without a build-time type layer over an app this size. Imported JSON is validated at runtime regardless, because a file the user picked cannot be trusted by any compiler. |
| **Ranking recomputed, never stored** | Scoring hundreds of abstracts takes milliseconds, so the ranking is derived from state with `useMemo`. Persisting scores would create a second copy that can silently disagree with the profile that produced it. |

## Known limitations

Honest list. Each of these is a consequence of a decision above, not an oversight.

- **Lexical only.** Synonyms, paraphrase and cross-language matching do not work. "Cognitive impairment" and "memory deficit" are unrelated terms to this algorithm.
- **English only.** The stopword list and the plural rules are English. A Portuguese corpus would need both replaced.
- **Not a stemmer.** Suffix handling is three plural rules. `predicting` and `prediction` remain different terms.
- **Small-corpus effect.** IDF is computed over the articles you loaded. With five articles, "rare" means "rare among those five", and scores shift as you add more. The ranking is comparative within one set, and percentages are not comparable across different sets.
- **BibTeX support is partial.** Reads `@`-entries with `title`, `abstract`, `author`, `year`, `doi`. Does not implement `@string` macros, `@preamble`, cross-references or `#` concatenation. Reference-manager exports do not use these; hand-maintained `.bib` files sometimes do.
- **Abstract required for a useful score.** An entry with only a title has very few terms, so its score is dominated by title words. Many older PubMed records have no abstract.
- **`localStorage` is per-browser.** Clearing site data deletes your session. Export to JSON before switching machines.
- **No UI tests.** Unit tests cover the domain logic (similarity, tokenising, parsing). The interface is verified by hand.

## Running locally

```bash
git clone https://github.com/AlexiaSPaiva/research-triage.git
cd research-triage
npm install
npm run dev      # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writing changes |

**Environment variables: none.** There are no external services, no API keys and no secrets in this project. `.env` is gitignored anyway, so an added local variable cannot be committed by accident.

## Project structure

The same layout in all three litpipe repos:

```
src/
  domain/      pure logic, no I/O and no React — this is what the tests cover
    similarity.js    TF-IDF, cosine, per-term explanation
    tokenize.js      text -> terms
  services/    I/O at the edges
    bibtex.js  csv.js  importLimits.js  fileIo.js  storage.js
  ui/
    components/      ProfileEditor, ArticleInput, ResultsList
    pages/App.jsx    state and composition
  shared/      identical across the three apps
    researchProfile.js  theme.js  SuiteNav.jsx  MethodDisclaimer.jsx
```

`domain/` importing nothing from `services/` or `ui/` is what makes the tests trivial: pure functions in, values out, no mocks.

## Tests

56 unit tests over the scoring logic and the file parsers, including the cases that would silently corrupt data if wrong: a comma inside a quoted CSV abstract, nested braces in a BibTeX title, `booktitle` not being mistaken for `title`, and document length not affecting the score.

```bash
npm test
```

## Security

- Every imported file is capped (5 MB, 5000 entries, per-field character limits) before parsing, so a large accidental export cannot freeze the tab.
- All user text is length-limited at the input boundary.
- No `eval`, no `dangerouslySetInnerHTML`, no network requests, no secrets.

---

## Resumo em português

Este é o **estágio 1 de 3** do litpipe, uma suíte de três ferramentas para revisão de literatura: **triagem → leitura → mapeamento de autores**.

O `research-triage` recebe uma lista de artigos (título + abstract, colados ou importados de `.bib`/`.csv`) e os ordena pela **similaridade de cosseno entre vetores TF-IDF** em relação ao tema da pesquisa que você digita. Para cada artigo, mostra **quais termos geraram a pontuação** — o resultado é auditável, não uma caixa-preta.

A porcentagem mede **vocabulário compartilhado entre dois textos**. Não é julgamento de qualidade científica, não é predição e não é inteligência artificial: é recuperação de informação clássica. Um artigo excelente pode pontuar baixo se descrever as mesmas ideias com outras palavras — limitação conhecida do método, listada em *Known limitations*.

Roda inteiramente no navegador, sem servidor e sem envio de dados.

---

Built by [Alexia Paiva](https://github.com/AlexiaSPaiva) for the literature review of an undergraduate research project on dementia etiologies (UFF, IANS lab).
