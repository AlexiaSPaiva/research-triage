import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import MethodDisclaimer from '../../shared/MethodDisclaimer.jsx';
import SuiteNav from '../../shared/SuiteNav.jsx';

/**
 * App shell. The screens are added on top of this; what is here is what every
 * later version keeps: the suite header, and the methodological disclaimer that
 * has to be on screen next to any score this app shows.
 */
export default function App() {
  return (
    <>
      <SuiteNav
        current="triage"
        title="research-triage"
        subtitle="Rank articles by lexical similarity to your research profile"
      />

      <Container maxWidth="md" component="main" className="py-6">
        <MethodDisclaimer title="What the percentage means — and what it does not">
          Scores in this app are <strong>cosine similarity</strong> between the words of your
          research profile and the words of an article. They measure{' '}
          <strong>shared vocabulary</strong> — not scientific quality, not methodology, and not a
          prediction.
        </MethodDisclaimer>

        <Paper className="p-6 text-center">
          <Typography color="text.secondary">Screens are not wired up yet.</Typography>
        </Paper>
      </Container>
    </>
  );
}
