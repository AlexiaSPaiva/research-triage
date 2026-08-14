/**
 * The ranked list. Every row shows the score, the terms that produced it, and a
 * checkbox to carry the article forward into reading-versions (repo 2).
 */
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

/** Cosine similarity as a percentage string. */
export function formatScore(score) {
  return `${(score * 100).toFixed(1)}%`;
}

/**
 * @param {{
 *   results: import('../../domain/similarity.js').ScoredArticle[],
 *   selected: Set<string>,
 *   onToggle: (id: string) => void,
 *   onRemove: (id: string) => void,
 * }} props
 */
export default function ResultsList({ results, selected, onToggle, onRemove }) {
  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {results.map(({ article, score, topTerms }, index) => (
        <Paper key={article.id} component="article" className="p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={selected.has(article.id)}
              onChange={() => onToggle(article.id)}
              inputProps={{ 'aria-label': `Select "${article.title}" for export` }}
              className="mt-0.5"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Typography variant="subtitle1" component="h3" className="font-semibold">
                  <span className="mr-2 text-sm font-normal text-slate-500">#{index + 1}</span>
                  {article.title}
                </Typography>
                <Tooltip title="Cosine similarity between this article's text and your research profile. It measures shared vocabulary, not scientific quality.">
                  <Typography
                    component="span"
                    variant="h6"
                    className="tabular-nums"
                    aria-label={`Similarity ${formatScore(score)}`}
                  >
                    {formatScore(score)}
                  </Typography>
                </Tooltip>
              </div>

              <LinearProgress
                variant="determinate"
                value={Math.round(score * 100)}
                aria-hidden="true"
                className="mt-2"
              />

              {(article.authors?.length > 0 || article.year) && (
                <Typography variant="body2" color="text.secondary" className="mt-2">
                  {article.authors?.slice(0, 4).join(', ')}
                  {article.authors?.length > 4 ? ' et al.' : ''}
                  {article.year ? ` · ${article.year}` : ''}
                </Typography>
              )}

              {topTerms.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Typography variant="caption" color="text.secondary" className="mr-1">
                    Matched on:
                  </Typography>
                  {topTerms.map((term) => (
                    <Chip
                      key={term.term}
                      label={`${term.term} ${(term.weight * 100).toFixed(0)}%`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </div>
              ) : (
                <Typography variant="caption" color="text.secondary" className="mt-2 block">
                  No vocabulary shared with your profile. This does not mean the article is
                  irrelevant — it may describe the same idea in different words.
                </Typography>
              )}

              {article.abstract && (
                <Accordion disableGutters elevation={0} className="mt-2 border-0 bg-transparent">
                  <AccordionSummary className="px-0">
                    <Typography variant="body2" color="primary">
                      Show abstract
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails className="px-0">
                    <Typography variant="body2">{article.abstract}</Typography>
                  </AccordionDetails>
                </Accordion>
              )}
            </div>

            <IconButton
              aria-label={`Remove "${article.title}"`}
              onClick={() => onRemove(article.id)}
              size="small"
            >
              ✕
            </IconButton>
          </div>
        </Paper>
      ))}
    </div>
  );
}
