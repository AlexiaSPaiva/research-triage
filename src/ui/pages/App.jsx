import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';

import { rankArticles } from '../../domain/similarity.js';
import { createProfile, profileToQuery, validateProfile } from '../../shared/researchProfile.js';
import MethodDisclaimer from '../../shared/MethodDisclaimer.jsx';
import { EmptyState, ExampleBanner, Section, SuiteFooter, icons } from '../../shared/layout.jsx';
import { exampleArticles, exampleProfile } from '../../domain/example.js';
import SuiteNav from '../../shared/SuiteNav.jsx';
import { downloadJson } from '../../services/fileIo.js';
import { loadJson, saveJson } from '../../services/storage.js';
import ArticleInput from '../components/ArticleInput.jsx';
import ProfileEditor from '../components/ProfileEditor.jsx';
import ResultsList from '../components/ResultsList.jsx';

const STORAGE_KEY = 'litpipe.research-triage.v1';

/** Reads persisted state, falling back to an empty session on anything unexpected. */
function loadSession() {
  const stored = loadJson(STORAGE_KEY, null);
  const validated = validateProfile(stored?.profile);
  return {
    profile: validated.ok ? validated.profile : createProfile(),
    articles: Array.isArray(stored?.articles) ? stored.articles : [],
  };
}

export default function App() {
  const [{ profile: initialProfile, articles: initialArticles }] = useState(loadSession);
  const [profile, setProfile] = useState(initialProfile);
  const [articles, setArticles] = useState(initialArticles);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    saveJson(STORAGE_KEY, { profile, articles });
  }, [profile, articles]);

  // Ranking is pure and fast (hundreds of abstracts score in milliseconds), so
  // it is recomputed from state rather than stored — there is no second copy of
  // the scores to fall out of date.
  const results = useMemo(
    () => rankArticles(profileToQuery(profile), articles),
    [profile, articles],
  );

  const addArticles = (incoming) => {
    setArticles((current) => {
      const seen = new Set(current.map((a) => a.id));
      // De-duplicate on id: importing the same export twice is a common slip.
      return [...current, ...incoming.filter((a) => !seen.has(a.id))];
    });
  };

  const removeArticle = (id) => {
    setArticles((current) => current.filter((a) => a.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const toggleSelected = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadExample = () => {
    setProfile(exampleProfile());
    setArticles(exampleArticles());
    setSelected(new Set());
  };

  const isEmpty = articles.length === 0 && !profile.topic.trim();

  /** The hand-off envelope: exactly what reading-versions imports. */
  const exportSelected = () => {
    const chosen = results.filter((result) => selected.has(result.article.id));
    downloadJson('litpipe-selection.json', {
      schemaVersion: 1,
      exportedBy: 'research-triage',
      profile,
      articles: chosen.map(({ article, score, topTerms }) => ({
        ...article,
        similarity: Number(score.toFixed(4)),
        topTerms,
      })),
    });
  };

  return (
    <>
      <SuiteNav
        current="triage"
        subtitle="Rank articles by lexical similarity to your research profile"
      />

      <Container maxWidth="lg" component="main" className="py-6 sm:py-8">
        <MethodDisclaimer
          title="What the percentage means — and what it does not"
          summary={
            <>
              It measures <strong>shared vocabulary</strong> with your profile, not scientific
              quality. Use it to decide what to read first, never to discard a paper unread.
            </>
          }
        >
          The score is the <strong>cosine similarity</strong> between the words of your research
          profile and the words of each article&apos;s title and abstract. It is not a judgement of
          scientific quality, methodology or importance, and it is not a prediction. An excellent,
          highly relevant paper will score low if it describes the same ideas in different words.
        </MethodDisclaimer>

        {isEmpty && (
          <ExampleBanner onLoad={loadExample}>
            See it work in one click: a sample research profile and six short, invented abstracts,
            ranked against it. You can clear them at any time.
          </ExampleBanner>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <ProfileEditor profile={profile} onChange={setProfile} step={1} />
          <ArticleInput onAdd={addArticles} step={2} />
        </div>

        <Section
          step={3}
          id="results-heading"
          title="Ranking"
          description={
            articles.length > 0
              ? `${articles.length} article${articles.length === 1 ? '' : 's'}, most similar first. Tick the ones to read and send them to stage 2.`
              : 'Your articles, ordered by how much vocabulary they share with the profile.'
          }
          className="mt-5"
          actions={
            articles.length > 0 && (
              <>
                <Button size="small" onClick={() => setArticles([])} color="inherit">
                  Clear all
                </Button>
                <Button
                  variant="contained"
                  onClick={exportSelected}
                  disabled={selected.size === 0}
                  // The button says what it does; the tooltip carries the detail.
                  title="Downloads a JSON file that stage 2, Reading Versions, imports directly"
                >
                  Send {selected.size} to Reading
                </Button>
              </>
            )
          }
        >
          {articles.length === 0 ? (
            <EmptyState icon={icons.ranking} title="No articles yet">
              Add articles in step 2 — paste a title and abstract, or import PDFs, BibTeX or CSV —
              and they will be ranked here.
            </EmptyState>
          ) : !profile.topic.trim() ? (
            <EmptyState icon={icons.document} title="Describe your research to score these">
              Fill in the research topic in step 1. The {articles.length} article
              {articles.length === 1 ? '' : 's'} you added will be ranked against it.
            </EmptyState>
          ) : (
            <ResultsList
              results={results}
              selected={selected}
              onToggle={toggleSelected}
              onRemove={removeArticle}
            />
          )}
        </Section>

        <SuiteFooter
          current="triage"
          note="Stage 1 of 3 · classical information retrieval (TF-IDF + cosine), no machine learning and no server · your data stays in this browser."
        />
      </Container>
    </>
  );
}
