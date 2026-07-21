import { execFileSync } from 'node:child_process';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(new URL('..', import.meta.url).pathname);
const docs = [
  { html: 'resume.html', pdf: 'docs/Russell-Dudek-Bytecubit-Resume.pdf', pages: 2, maxBottomWhitespaceIn: 0.78 },
  { html: 'cover-letter.html', pdf: 'docs/Russell-Dudek-Bytecubit-Cover-Letter.pdf', pages: 1, maxBottomWhitespaceIn: 0.82 },
  { html: 'interview-brief.html', pdf: 'docs/Russell-Dudek-Bytecubit-Candidate-Thesis-Brief.pdf', pages: 2, maxBottomWhitespaceIn: 0.86 },
  { html: '90-day-plan.html', pdf: 'docs/Russell-Dudek-Bytecubit-90-Day-Plan.pdf', pages: 2, maxBottomWhitespaceIn: 0.86 },
  { html: 'role-alignment.html', pdf: 'docs/Russell-Dudek-Bytecubit-Role-Alignment-Brief.pdf', pages: 1, maxBottomWhitespaceIn: 0.78 },
  { html: 'signal-twin-review.html', pdf: 'docs/Russell-Dudek-Bytecubit-Signal-Twin-Review.pdf', pages: 2, maxBottomWhitespaceIn: 0.86 }
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
  { file: 'interview-brief.html', phrase: 'Candidate Thesis Brief' },
  { file: 'document-layout.css', phrase: 'deliberate page use' }
];

const viewports = [
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 }
];

const prohibitedTerm = ['ma', 'ndate'].join('');
const failures = [];
const results = [];
const responsiveChecks = [];
const pageUse = [];
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

const browser = await chromium.launch({ headless: true });
try {
  for (const doc of docs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.emulateMedia({ media: 'print' });
    await page.goto(pathToFileURL(resolve(root, doc.html)).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const metrics = await page.evaluate(() => {
      const selectors = [
        'h1', 'h2', 'h3', 'p', 'li', 'td', 'th',
        '.doc-callout', '.data-point', '.alignment-item', '.success-item',
        '.signoff-box', '.compact-header', '.doc-header', '.letter-meta'
      ].join(',');
      return [...document.querySelectorAll('.sheet')].map((sheet, index) => {
        const pageRect = sheet.getBoundingClientRect();
        const elements = [...sheet.querySelectorAll(selectors)].filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !el.classList.contains('page-label');
        });
        const maxBottom = elements.reduce((value, el) => Math.max(value, el.getBoundingClientRect().bottom), pageRect.top);
        const unusedBottomPx = Math.max(0, pageRect.bottom - maxBottom);
        const fontSizes = elements
          .filter((el) => el.matches('p,li,td,th'))
          .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
          .filter(Number.isFinite);
        return {
          page: index + 1,
          pageHeightPx: pageRect.height,
          unusedBottomPx,
          unusedBottomIn: unusedBottomPx / 96,
          usedHeightRatio: pageRect.height ? (pageRect.height - unusedBottomPx) / pageRect.height : 0,
          minimumBodyFontPx: fontSizes.length ? Math.min(...fontSizes) : null
        };
      });
    });

    for (const metric of metrics) {
      pageUse.push({ route: doc.html, ...metric });
      if (metric.unusedBottomIn > doc.maxBottomWhitespaceIn) {
        failures.push(`${doc.html} page ${metric.page}: ${metric.unusedBottomIn.toFixed(2)}in unused at bottom; limit is ${doc.maxBottomWhitespaceIn.toFixed(2)}in`);
      }
      if (metric.minimumBodyFontPx !== null && metric.minimumBodyFontPx < 10.2) {
        failures.push(`${doc.html} page ${metric.page}: minimum body font ${metric.minimumBodyFontPx.toFixed(2)}px is below the professional threshold`);
      }
    }
    await page.close();
  }

  for (const viewport of viewports) {
    for (const route of ['index.html', ...docs.map((doc) => doc.html)]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      await page.goto(pathToFileURL(resolve(root, route)).href, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const overflow = Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
        const sheets = [...document.querySelectorAll('.sheet')].map((sheet) => {
          const rect = sheet.getBoundingClientRect();
          const descendants = [...sheet.querySelectorAll('*')];
          const deepestBottom = descendants.reduce((max, element) => Math.max(max, element.getBoundingClientRect().bottom), rect.top);
          return {
            content_overflow_bottom: Math.max(0, deepestBottom - rect.bottom),
            scroll_overflow: Math.max(0, sheet.scrollHeight - sheet.clientHeight)
          };
        });
        return { horizontal_overflow: Math.max(0, overflow), sheet_overflow: sheets };
      });
      const maxSheetOverflow = geometry.sheet_overflow.reduce(
        (max, item) => Math.max(max, item.content_overflow_bottom, item.scroll_overflow),
        0
      );
      responsiveChecks.push({ route, viewport: viewport.name, horizontal_overflow: geometry.horizontal_overflow, sheet_overflow: maxSheetOverflow });
      if (geometry.horizontal_overflow > 1) failures.push(`${route} at ${viewport.name}: horizontal overflow ${geometry.horizontal_overflow}px`);
      if (maxSheetOverflow > 2) failures.push(`${route} at ${viewport.name}: sheet content overflow ${maxSheetOverflow}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const normalized = searchableText.toLowerCase();
for (const phrase of rejectedPhrases) {
  if (normalized.includes(phrase.toLowerCase())) failures.push(`rejected candidate-facing phrase remains: “${phrase}”`);
}
if (new RegExp(`\\b${prohibitedTerm}\\b`, 'i').test(searchableText)) {
  failures.push('rejected terminology remains in candidate-facing HTML or PDF text');
}

const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.yml', '.yaml']);
const entries = await readdir(root, { recursive: true, withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile()) continue;
  const full = resolve(entry.parentPath ?? entry.path, entry.name);
  const rel = relative(root, full).replaceAll('\\', '/');
  if (rel.startsWith('.git/') || rel.startsWith('node_modules/') || rel.endsWith('.pdf')) continue;
  const ext = `.${entry.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!textExtensions.has(ext)) continue;
  const text = await readFile(full, 'utf8');
  if (new RegExp(`\\b${prohibitedTerm}\\b`, 'i').test(text)) failures.push(`${rel}: rejected terminology remains`);
}

const currentPdfs = (await readdir(resolve(root, 'docs'))).filter((name) => name.toLowerCase().endsWith('.pdf')).sort();
if (currentPdfs.length !== 6) failures.push(`expected 6 current PDFs, found ${currentPdfs.length}`);

const report = {
  status: failures.length === 0 ? 'passed' : 'failed',
  verified_at_utc: new Date().toISOString(),
  artifact_direction: 'candidate-first role alignment with deliberate page use',
  documents: results,
  page_use: pageUse,
  responsive_checks: responsiveChecks,
  retired_artifacts_absent: retiredPdfs,
  current_pdf_count: currentPdfs.length,
  rejected_phrase_matches: failures.filter((item) => item.startsWith('rejected candidate-facing phrase')),
  terminology_matches: failures.filter((item) => item.includes('rejected terminology')),
  failures
};

await writeFile(resolve(root, 'document-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Candidate document verification passed.');
