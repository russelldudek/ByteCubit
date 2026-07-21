import { execFileSync } from 'node:child_process';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const docs = [
  { html: 'resume.html', pdf: 'docs/Russell-Dudek-Bytecubit-Resume.pdf', pages: 2 },
  { html: 'cover-letter.html', pdf: 'docs/Russell-Dudek-Bytecubit-Cover-Letter.pdf', pages: 1 },
  { html: 'interview-brief.html', pdf: 'docs/Russell-Dudek-Bytecubit-Candidate-Thesis-Brief.pdf', pages: 4 },
  { html: '90-day-plan.html', pdf: 'docs/Russell-Dudek-Bytecubit-90-Day-Plan.pdf', pages: 3 },
  { html: 'role-alignment.html', pdf: 'docs/Russell-Dudek-Bytecubit-Role-Alignment-Brief.pdf', pages: 2 },
  { html: 'signal-twin-review.html', pdf: 'docs/Russell-Dudek-Bytecubit-Signal-Twin-Review.pdf', pages: 2 }
];

const retiredPdfs = [
  'docs/Russell-Dudek-Bytecubit-Technical-Fit-Proof-Plan.pdf',
  'docs/Russell-Dudek-Bytecubit-Interview-Thesis-Brief.pdf'
];

const rejectedPhrases = [
  "See how I'd prove the fit",
  'Technical Fit & Proof Plan',
  'Bounded Technical Proof',
  'responsible hiring process should test',
  'Have you performed hands-on Ignition development/configuration?',
  'Application truth',
  'Do not proceed',
  'proposed working session',
  'working-session proposal'
];

const requiredPhrases = [
  { file: 'index.html', phrase: 'View role alignment' },
  { file: 'role-alignment.html', phrase: 'Role Alignment Brief' },
  { file: 'interview-brief.html', phrase: 'Candidate Thesis Brief' }
];

const failures = [];
const results = [];
let searchableText = '';

for (const doc of docs) {
  const htmlPath = resolve(root, doc.html);
  const pdfPath = resolve(root, doc.pdf);
  await access(htmlPath, constants.R_OK);
  await access(pdfPath, constants.R_OK);

  const pageInfo = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const pageMatch = pageInfo.match(/^Pages:\s+(\d+)$/m);
  const actualPages = pageMatch ? Number(pageMatch[1]) : null;
  if (actualPages !== doc.pages) {
    failures.push(`${doc.pdf}: expected ${doc.pages} pages, found ${actualPages ?? 'unknown'}`);
  }

  const html = await readFile(htmlPath, 'utf8');
  const pdfText = execFileSync('pdftotext', [pdfPath, '-'], { encoding: 'utf8' });
  searchableText += `\n${html}\n${pdfText}`;
  results.push({ html: doc.html, pdf: doc.pdf, expected_pages: doc.pages, actual_pages: actualPages });
}

for (const retired of retiredPdfs) {
  try {
    await access(resolve(root, retired), constants.F_OK);
    failures.push(`${retired}: retired PDF still exists`);
  } catch {
    // Expected: retired artifact is absent.
  }
}

for (const item of requiredPhrases) {
  const text = await readFile(resolve(root, item.file), 'utf8');
  if (!text.includes(item.phrase)) failures.push(`${item.file}: missing required phrase “${item.phrase}”`);
}

const normalized = searchableText.toLowerCase();
for (const phrase of rejectedPhrases) {
  if (normalized.includes(phrase.toLowerCase())) failures.push(`rejected candidate-facing phrase remains: “${phrase}”`);
}

const currentPdfs = (await readdir(resolve(root, 'docs'))).filter((name) => name.toLowerCase().endsWith('.pdf')).sort();
if (currentPdfs.length !== 6) failures.push(`expected 6 current PDFs, found ${currentPdfs.length}`);

const report = {
  status: failures.length === 0 ? 'passed' : 'failed',
  verified_at_utc: new Date().toISOString(),
  artifact_direction: 'candidate-first role alignment',
  documents: results,
  retired_artifacts_absent: retiredPdfs,
  current_pdf_count: currentPdfs.length,
  rejected_phrase_matches: failures.filter((item) => item.startsWith('rejected candidate-facing phrase')),
  failures
};

await writeFile(resolve(root, 'document-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Candidate document verification passed.');
