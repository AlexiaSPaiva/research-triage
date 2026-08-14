import { useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { rankArticles } from '../../domain/similarity.js';
import { createProfile, profileToQuery, validateProfile } from '../../shared/researchProfile.js';
import MethodDisclaimer from '../../shared/MethodDisclaimer.jsx';
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
        title="research-triage"
        subtitle="Rank articles by lexical similarity to your research profile"
      />

      <Container maxWidth="md" component="main" className="py-6">
        <MethodDisclaimer title="What the percentage means — and what it does not">
          The score is the <strong>cosine similarity</strong> between the words of your research
          profile and the words of each article&apos;s title and abstract. It measures{' '}
          <strong>shared vocabulary</strong>. It is not a judgement of scientific quality,
          methodology or importance, and it is not a prediction. An excellent, highly relevant paper
          will score low if it describes the same ideas in different words. Use the ranking to
          decide reading order, never to discard a paper unread.
        </MethodDisclaimer>

        <div className="flex flex-col gap-5">
          <ProfileEditor profile={profile} onChange={setProfile} />
          <ArticleInput onAdd={addArticles} />

          <section aria-labelledby="results-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Typography id="results-heading" variant="h2" component="h2">
                Ranking{' '}
                {articles.length > 0 && (
                  <Chip label={`${articles.length} article(s)`} size="small" className="ml-1" />
                )}
              </Typography>
              <Button
                variant="contained"
                onClick={exportSelected}
                disabled={selected.size === 0}
                aria-describedby="export-help"
              >
                Export {selected.size} selected → reading-versions
              </Button>
            </div>
            <Typography
              id="export-help"
              variant="caption"
              color="text.secondary"
              className="mb-3 block"
            >
              Exports a JSON file that reading-versions (stage 2) imports directly.
            </Typography>

            {articles.length === 0 ? (
              <Paper className="p-6 text-center">
                <Typography color="text.secondary">
                  Add or import articles above to see the ranking.
                </Typography>
              </Paper>
            ) : !profile.topic.trim() ? (
              <Paper className="p-6 text-center">
                <Typography color="text.secondary">
                  Fill in the research topic to score these articles.
                </Typography>
              </Paper>
            ) : (
              <ResultsList
                results={results}
                selected={selected}
                onToggle={toggleSelected}
                onRemove={removeArticle}
              />
            )}
          </section>
        </div>

        <Typography
          variant="caption"
          color="text.secondary"
          component="footer"
          className="mt-8 block"
        >
          Part 1 of 3 of litpipe · classical information retrieval (TF-IDF + cosine), no machine
          learning and no server · data stays in this browser ·{' '}
          <a href="https://github.com/AlexiaSPaiva/research-triage">source</a>
        </Typography>
      </Container>
    </>
  );
}
