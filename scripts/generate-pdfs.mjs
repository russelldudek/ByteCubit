import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const output = resolve(root, 'docs');
await mkdir(output, { recursive: true });

const documents = [
  ['resume.html', 'Russell-Dudek-Bytecubit-Resume.pdf'],
  ['cover-letter.html', 'Russell-Dudek-Bytecubit-Cover-Letter.pdf'],
  ['interview-brief.html', 'Russell-Dudek-Bytecubit-Candidate-Thesis-Brief.pdf'],
  ['90-day-plan.html', 'Russell-Dudek-Bytecubit-90-Day-Plan.pdf'],
  ['role-alignment.html', 'Russell-Dudek-Bytecubit-Role-Alignment-Brief.pdf'],
  ['signal-twin-review.html', 'Russell-Dudek-Bytecubit-Signal-Twin-Review.pdf']
];

const browser = await chromium.launch({ headless: true });
try {
  for (const [source, filename] of documents) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(pathToFileURL(resolve(root, source)).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: resolve(output, filename),
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await page.close();
  }
} finally {
  await browser.close();
}
