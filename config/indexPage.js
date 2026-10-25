/* global module, require */
const fs = require('fs');
const path = require('path');
const { baseStyle, footer } = require('./pageStyle');
const { trainerPage } = require('./trainerPage');
const { vocabPage } = require('./vocabPage');

const escape = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const apps = [
  ['Amazing Flash Cards', 'https://apps.apple.com/at/app/amazing-flash-cards/id1511674871', 'iOS'],
  ['Wordim', 'https://apps.apple.com/us/app/wordim-personal-vocabulary/id1662281843', 'iOS'],
  ['Plain Flashcards', 'https://apps.apple.com/at/app/plain-flashcards/id971833934', 'iOS'],
  ['Smart Repetition', 'https://apps.apple.com/us/app/smart-repetition/id1556865655', 'iOS'],
  ['Simple Anki', 'https://apps.apple.com/us/app/simple-anki/id1625870857', 'iOS'],
  ['Smart Repetition / memorycard', 'https://play.google.com/store/apps/details?id=com.kuraeva.memorycard', 'Android'],
];

const indexPage = (units, versions) => {
  const pdfs = versions.filter((v) => v.extension === 'pdf');
  const others = versions.filter((v) => v.extension !== 'pdf');
  const href = (version, file) => `${version.name}/${file}.${version.extension}`;

  const cards = units
    .map((file) => {
      const data = JSON.parse(fs.readFileSync(path.resolve('src', `${file}.json`), 'utf8'));
      const phrases = data.words.filter((w) => !w.example).length;
      return `
      <article class="card">
        <h2>${escape(data.name)}</h2>
        <p class="meta">${data.words.length - phrases} words · ${phrases} phrases</p>
        <div class="pdfs">
          ${pdfs
            .map((v, i) => `<a class="btn${i ? ' secondary' : ''}" href="${href(v, file)}">${escape(v.label)}</a>`)
            .join('\n          ')}
        </div>
        <a class="btn secondary practice" href="trainer.html?unit=${file}">Practice online</a>
        <a class="btn secondary practice" href="vocabulary.html#${file}">Word list</a>
        <p class="apps-label">Flashcard apps</p>
        <ul class="apps">
          ${others
            .map((v) => `<li><a href="${href(v, file)}" download>${escape(v.label)}</a></li>`)
            .join('\n          ')}
        </ul>
      </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MORE! 1 Vocabulary</title>
<meta name="description" content="English - German vocabulary from the book MORE! 1: printable worksheets and flashcard files for every unit.">
<style>
${baseStyle}
  main { max-width: 1080px; margin: 0 auto; padding: 40px 16px 64px; }
  header h1 { margin: 0 0 4px; font-size: 2rem; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--muted); }
  .book { margin-top: 12px; font-size: 0.875rem; color: var(--muted); }
  .grid {
    display: grid; gap: 16px; margin: 32px 0 48px;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px;
  }
  .card h2 { margin: 0; font-size: 1.125rem; }
  .meta { margin: 2px 0 16px; color: var(--muted); font-size: 0.875rem; }
  .pdfs { display: flex; gap: 8px; flex-wrap: wrap; }
  .pdfs .btn { flex: 1 1 auto; }
  .practice { margin-top: 8px; display: block; }
  .hero-cta { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
  .apps-label {
    margin: 20px 0 6px; font-size: 0.75rem; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--muted);
  }
  .apps { list-style: none; margin: 0; padding: 0; font-size: 0.875rem; }
  .apps li + li { margin-top: 2px; }
  section h2 { font-size: 1.25rem; margin: 0 0 8px; }
  section ul { padding-left: 20px; }
  @media print { .apps, .apps-label, .practice, .hero-cta, section { display: none; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>MORE! 1 Vocabulary</h1>
    <p>English – German vocabulary by unit: printable worksheets and files for flashcard apps.</p>
    <p class="book">Book: MORE! Workbook 1 · ISBN 978-3-7114-0001-7 · Helbling Verlagsgesellschaft mbH</p>
    <div class="hero-cta">
      <a class="btn" href="trainer.html">Open the vocabulary trainer</a>
      <a class="btn secondary" href="vocabulary.html">Word list (all units)</a>
    </div>
  </header>

  <div class="grid">
${cards}
  </div>

  <section>
    <h2>Worksheets</h2>
    <p>Each worksheet lists the German example sentences and phrases of a unit with space to write the English translation. The solutions sheet has the same layout, so answers are easy to check.</p>
  </section>

  <section>
    <h2>Flashcard apps</h2>
    <p>Download the file for your app and import it there:</p>
    <ul>
      ${apps.map(([name, url, os]) => `<li><a href="${url}">${escape(name)}</a> (${os})</li>`).join('\n      ')}
    </ul>
  </section>

${footer}
</main>
</body>
</html>
`;
};

class IndexPagePlugin {
  constructor({ units, versions }) {
    this.units = units;
    this.versions = versions;
  }

  apply(compiler) {
    const { RawSource } = compiler.webpack.sources;
    compiler.hooks.thisCompilation.tap('IndexPagePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'IndexPagePlugin', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        () => {
          compilation.emitAsset('index.html', new RawSource(indexPage(this.units, this.versions)));
          compilation.emitAsset('trainer.html', new RawSource(trainerPage(this.units)));
          compilation.emitAsset('vocabulary.html', new RawSource(vocabPage(this.units)));
        },
      );
    });
  }
}

module.exports = { IndexPagePlugin };
