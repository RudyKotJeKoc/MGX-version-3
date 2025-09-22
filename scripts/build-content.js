/* eslint-disable no-console */
import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();
const contentDir = path.join(root, 'public', 'content');
const outDir = path.join(root, 'public', 'data');
const outFile = path.join(outDir, 'content_index.json');

async function safeRead(filePath) {
  try {
    const buf = await fs.readFile(filePath);
    return buf.toString('utf-8').trim();
  } catch {
    return '';
  }
}

function summarize(text, maxChars = 420) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= maxChars) return t;
  // Spróbuj uciąć po zdaniu/kropce
  const cut = t.slice(0, maxChars);
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastDot > 80 ? cut.slice(0, lastDot + 1) : cut) + ' …';
}

function lines(text, count = 5) {
  return (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, count);
}

async function ensureDir(p) {
  try {
    await fs.mkdir(p, { recursive: true });
  } catch {}
}

async function build() {
  const files = {
    hero_intro: 'wstep na strone.txt',
    motto: 'akt darowizny.txt',
    tldr_5_faktow: '5 faktow.txt',
    kluczowe_fakty: 'kluczowe fakty.txt',
    polana_klamstw: 'polana klamstw.txt',
    analiza_psychologiczna: 'analiza psychologiczna.txt',
    raport_analityczny: 'raport analityczny.txt',
    edukacja_prawna: 'sluzebnosc a dozywocie.txt',
    timeline1: 'kronika ósmego kręgu.txt',
    timeline2: 'spor o dom i darowizne.txt',
    timeline3: 'wojna o dom.txt',
  };

  const data = {};
  for (const [key, fname] of Object.entries(files)) {
    const txt = await safeRead(path.join(contentDir, fname));
    data[key] = {
      full: txt,
      snippet: summarize(txt),
      firstLines: lines(txt, 6),
    };
  }

  // Zbiorcza sekcja timeline/opowieści
  const timelineCombined = ['timeline1', 'timeline2', 'timeline3']
    .map((k, i) => {
      const title = `Źródło ${i + 1}`;
      const full = data[k]?.full || '';
      return full ? `# ${title}\n\n${full}` : '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n');

  data['timeline_combined'] = {
    full: timelineCombined,
    snippet: summarize(timelineCombined),
    firstLines: lines(timelineCombined, 8),
  };

  await ensureDir(outDir);
  await fs.writeFile(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), data }, null, 2), 'utf-8');
  console.log('✅ Generated', path.relative(root, outFile));
}

build().catch((err) => {
  console.error('❌ build-content failed:', err);
  process.exit(1);
});