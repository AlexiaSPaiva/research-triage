/**
 * The two ways articles get into the app: pasted by hand, or imported from a
 * reference-manager export (.bib / .csv).
 */
import { useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { parseBibtex } from '../../services/bibtex.js';
import { parseCsv } from '../../services/csv.js';
import { checkFile, IMPORT_LIMITS, safeString } from '../../services/importLimits.js';
import { readTextFile } from '../../services/fileIo.js';

/**
 * @param {{ onAdd: (articles: import('../../domain/similarity.js').Article[]) => void }} props
 */
export default function ArticleInput({ onAdd }) {
  const [tab, setTab] = useState(0);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [notice, setNotice] = useState(null);
  const fileInput = useRef(null);

  const addManual = (event) => {
    event.preventDefault();
    const cleanTitle = safeString(title, IMPORT_LIMITS.titleChars);
    if (!cleanTitle) {
      setNotice({ severity: 'error', text: 'A title is required.' });
      return;
    }
    onAdd([
      {
        id: `manual-${cleanTitle.slice(0, 40)}-${abstract.length}`,
        title: cleanTitle,
        abstract: safeString(abstract, IMPORT_LIMITS.abstractChars),
        authors: [],
        year: null,
        doi: '',
      },
    ]);
    setTitle('');
    setAbstract('');
    setNotice({ severity: 'success', text: 'Article added.' });
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const fileErrors = checkFile(file);
    if (fileErrors.length > 0) {
      setNotice({ severity: 'error', text: fileErrors.join(' ') });
      return;
    }

    try {
      const text = await readTextFile(file);
      const isCsv = /\.csv$/i.test(file.name);
      const result = isCsv ? parseCsv(text) : parseBibtex(text);

      if (isCsv && result.error) {
        setNotice({ severity: 'error', text: result.error });
        return;
      }
      if (result.articles.length === 0) {
        setNotice({
          severity: 'warning',
          text: 'No articles with a title were found in that file.',
        });
        return;
      }

      onAdd(result.articles);
      setNotice({
        severity: 'success',
        text:
          `Imported ${result.articles.length} article(s).` +
          (result.skipped > 0 ? ` ${result.skipped} entr(ies) skipped: no title.` : ''),
      });
    } catch (error) {
      setNotice({ severity: 'error', text: error.message });
    }
  };

  return (
    <Paper component="section" aria-labelledby="articles-heading" className="p-4 sm:p-6">
      <Typography id="articles-heading" variant="h2" component="h2" className="mb-1">
        Articles
      </Typography>
      <Typography variant="body2" color="text.secondary" className="mb-2">
        Titles and abstracts only. Nothing leaves your browser — there is no server.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        aria-label="How to add articles"
      >
        <Tab label="Paste one" id="tab-paste" aria-controls="panel-paste" />
        <Tab label="Import file" id="tab-file" aria-controls="panel-file" />
      </Tabs>

      {tab === 0 && (
        <form
          id="panel-paste"
          role="tabpanel"
          aria-labelledby="tab-paste"
          onSubmit={addManual}
          className="mt-4"
        >
          <TextField
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            fullWidth
            required
            inputProps={{ maxLength: IMPORT_LIMITS.titleChars }}
          />
          <TextField
            label="Abstract"
            value={abstract}
            onChange={(event) => setAbstract(event.target.value)}
            multiline
            minRows={4}
            fullWidth
            className="mt-3"
            inputProps={{ maxLength: IMPORT_LIMITS.abstractChars }}
          />
          <Button type="submit" variant="contained" className="mt-3">
            Add article
          </Button>
        </form>
      )}

      {tab === 1 && (
        <div id="panel-file" role="tabpanel" aria-labelledby="tab-file" className="mt-4">
          <Typography variant="body2" className="mb-3">
            BibTeX (<code>.bib</code>) or CSV exported from Zotero, Mendeley, PubMed or Google
            Scholar. Files are read locally and never uploaded.
          </Typography>
          <Button variant="contained" onClick={() => fileInput.current?.click()}>
            Choose file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".bib,.bibtex,.csv,text/csv,text/plain"
            onChange={handleFile}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {notice && (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} className="mt-4">
          {notice.text}
        </Alert>
      )}
    </Paper>
  );
}
