/* global module, require */
const fs = require('fs');
const path = require('path');
const { baseStyle, footer } = require('./pageStyle');

const escape = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// search, unit filter and hiding a language for self-testing
const script = `
const $ = (sel) => document.querySelector(sel);
const sections = [...document.querySelectorAll('section.unit')];

const norm = (str) => str.toLowerCase().replace(/[’‘]/g, "'");

const filter = () => {
  const q = norm($('#search').value.trim());
  const unit = $('#unit').value;
  let shown = 0;
  sections.forEach((section) => {
    const unitMatch = !unit || section.id === unit;
    let rows = 0;
    section.querySelectorAll('tbody tr').forEach((tr) => {
      const match = unitMatch && (!q || norm(tr.textContent).includes(q));
      tr.hidden = !match;
      if (match) rows++;
    });
    section.hidden = !rows;
    shown += rows;
  });
  $('#count').textContent = shown + (shown === 1 ? ' entry' : ' entries');
  $('#empty').hidden = shown > 0;
};

// "en" = English only (German hidden), "de" = Deutsch only (English hidden)
const SHOW_KEY = 'more1-wordlist-show';
const setShow = (show) => {
  document.body.classList.toggle('hide-de', show === 'en');
  document.body.classList.toggle('hide-en', show === 'de');
  document.querySelectorAll('tr.peek').forEach((tr) => tr.classList.remove('peek'));
  $('#tap-hint').hidden = show === 'both';
  try {
    localStorage.setItem(SHOW_KEY, show);
  } catch (e) {
    // storage blocked: the mode just isn't remembered
  }
};

$('#search').addEventListener('input', filter);
$('#unit').addEventListener('change', () => {
  history.replaceState(null, '', $('#unit').value ? '#' + $('#unit').value : location.pathname);
  filter();
  window.scrollTo(0, 0);
});
document.querySelectorAll('input[name=show]').forEach((input) =>
  input.addEventListener('change', () => setShow(input.value)),
);
// while one language is hidden, tapping a row shows it for that row
document.addEventListener('click', (e) => {
  const row = e.target.closest('tbody tr');
  if (row && (document.body.classList.contains('hide-en') || document.body.classList.contains('hide-de'))) {
    row.classList.toggle('peek');
  }
});

let saved = 'both';
try {
  saved = localStorage.getItem(SHOW_KEY) || 'both';
} catch (e) {
  // ignore
}
const savedInput = document.querySelector('input[name=show][value="' + saved + '"]');
if (savedInput) savedInput.checked = true;
setShow(savedInput ? saved : 'both');

const hash = location.hash.slice(1);
if (sections.some((s) => s.id === hash)) $('#unit').value = hash;
filter();
// the browser jumps to the #unit anchor after load; start at the top instead
if (hash) window.addEventListener('load', () => window.scrollTo(0, 0));
`;

const vocabPage = (units) => {
  const data = units.map((file) => {
    const json = JSON.parse(fs.readFileSync(path.resolve('src', `${file}.json`), 'utf8'));
    return { id: file, name: json.name, words: json.words };
  });

  const sections = data
    .map(
      (unit) => `
  <section class="unit" id="${unit.id}">
    <h2>${escape(unit.name)}</h2>
    <table>
      <thead><tr><th>English</th><th>Deutsch</th><th>Example</th><th>Beispiel</th></tr></thead>
      <tbody>
${unit.words
  .map(
    (w) =>
      `        <tr><td class="en word">${escape(w.en)}</td><td class="de word">${escape(w.de)}</td>` +
      `<td class="en ex">${escape(w.example)}</td><td class="de ex">${escape(w.example_de)}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
  </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MORE! 1 Word List</title>
<meta name="description" content="All MORE! 1 vocabulary and example sentences, English and German, by unit.">
<style>
${baseStyle}
  main { max-width: 1080px; margin: 0 auto; padding: 24px 16px 64px; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  h1 { margin: 0; font-size: 1.5rem; }
  .muted { color: var(--muted); font-size: 0.875rem; }
  .tools {
    position: sticky; top: 0; z-index: 1; background: var(--bg);
    display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center;
    padding: 12px 0; margin-top: 12px; border-bottom: 1px solid var(--border);
  }
  .tools input[type=search], .tools select {
    font: inherit; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
  }
  .tools input[type=search] { flex: 1 1 220px; min-width: 0; }
  .tools label { display: flex; gap: 6px; align-items: center; font-size: 0.875rem; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); }
  .seg label { position: relative; padding: 7px 12px; cursor: pointer; font-size: 0.875rem; }
  .seg label + label { border-left: 1px solid var(--border); }
  .seg input { position: absolute; opacity: 0; pointer-events: none; }
  .seg label:has(input:checked) { background: var(--accent); color: var(--accent-text); font-weight: 600; }
  .seg label:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: -2px; }
  #tap-hint { flex-basis: 100%; margin: 0; }
  #count { margin-left: auto; }
  h2 { font-size: 1.125rem; margin: 32px 0 8px; }
  section.unit { scroll-margin-top: 140px; } /* keep the heading clear of the sticky toolbar */
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  th { text-align: left; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--border); }
  td { padding: 8px 12px; border-top: 1px solid var(--border); vertical-align: top; white-space: pre-line; }
  td.word { font-weight: 600; }
  td.ex { color: var(--muted); font-style: italic; }
  th:nth-child(1), th:nth-child(2) { width: 22%; }
  /* self-test: blank out one language, tap a row to show it for that row */
  .hide-en tbody tr, .hide-de tbody tr { cursor: pointer; }
  .hide-en tr:not(.peek) td.en, .hide-de tr:not(.peek) td.de { color: transparent; }
  .hide-en tr:not(.peek) td.en:not(:empty), .hide-de tr:not(.peek) td.de:not(:empty) {
    background: repeating-linear-gradient(-45deg, var(--bg) 0 6px, var(--surface) 6px 12px);
  }
  #empty { margin-top: 32px; }
  @media (max-width: 700px) {
    thead { display: none; }
    table, tbody, tr, td { display: block; }
    tr { padding: 10px 12px; border-top: 1px solid var(--border); }
    tr:first-child { border-top: 0; }
    td { border: 0; padding: 0; }
    td.word { display: inline; }
    td.en.word::after { content: " – "; font-weight: 400; color: var(--muted); }
    td.ex { margin-top: 4px; font-size: 0.9375rem; }
    td.ex:empty { display: none; }
    .tools { position: static; }
    /* narrow screens: leave hidden content out instead of showing placeholders */
    .hide-en tr:not(.peek) td.en, .hide-de tr:not(.peek) td.de { display: none; }
    .hide-de tr:not(.peek) td.en.word::after { content: none; }
  }
  @media print {
    .tools, .top a, footer { display: none; }
    body { background: white; color: black; }
    table { border-radius: 0; }
    section { break-inside: auto; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
<main>
  <div class="top">
    <h1>MORE! 1 Word List</h1>
    <a href="./" class="muted">← All downloads</a>
  </div>

  <div class="tools">
    <input type="search" id="search" placeholder="Search English or Deutsch…" aria-label="Search">
    <select id="unit" aria-label="Unit">
      <option value="">All units</option>
      ${data.map((u) => `<option value="${u.id}">${escape(u.name)}</option>`).join('\n      ')}
    </select>
    <div class="seg" role="radiogroup" aria-label="Show">
      <label><input type="radio" name="show" value="both" checked>Both</label>
      <label><input type="radio" name="show" value="en">English only</label>
      <label><input type="radio" name="show" value="de">Deutsch only</label>
    </div>
    <span class="muted" id="count"></span>
    <p class="muted" id="tap-hint" hidden>Tap a row to show the translation.</p>
  </div>
${sections}
  <p class="muted" id="empty" hidden>Nothing found.</p>
${footer}
</main>
<script>${script}</script>
</body>
</html>
`;
};

module.exports = { vocabPage };
