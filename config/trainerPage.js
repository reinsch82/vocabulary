/* global module, require */
const fs = require('fs');
const path = require('path');
const { baseStyle, footer } = require('./pageStyle');

// everything below runs in the browser; progress is kept in localStorage
const script = `
const UNITS = JSON.parse(document.getElementById('data').textContent);
const STORE_KEY = 'more1-trainer-v1';
const SESSION_SIZE = 20;
const MASTERED = 4; // box from which a card counts as learned
const INTERVALS = [0, 1, 2, 4, 8, 16]; // days until a card in box n is due again
const DAY = 24 * 60 * 60 * 1000;

const MODES = {
  'de-en': { label: 'Words: Deutsch → English', ask: 'de', answer: 'en', hint: 'example_de', answerLang: 'en' },
  'en-de': { label: 'Words: English → Deutsch', ask: 'en', answer: 'de', hint: 'example', answerLang: 'de', askLang: 'en' },
  'sent': { label: 'Sentences: Deutsch → English', ask: 'example_de', answer: 'example', answerLang: 'en' },
};

// --- storage ---------------------------------------------------------------
const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
};
const state = Object.assign({ progress: {}, settings: {} }, load());
const save = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    // private mode or storage full: training still works, it just isn't remembered
  }
};

// --- cards -----------------------------------------------------------------
const cardsFor = (unitIds, mode) => {
  const m = MODES[mode];
  const cards = [];
  UNITS.filter((u) => unitIds.includes(u.id)).forEach((u) => {
    u.words.forEach((w) => {
      if (!w[m.ask] || !w[m.answer]) return;
      cards.push({
        key: mode + '|' + u.id + '|' + w.en + '|' + w.de,
        unit: u.id,
        ask: w[m.ask],
        answer: w[m.answer],
        hint: m.hint ? w[m.hint] : '',
      });
    });
  });
  return cards;
};

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const stats = (cards) => {
  const s = { total: cards.length, mastered: 0, learning: 0, fresh: 0, due: 0 };
  const now = Date.now();
  cards.forEach((c) => {
    const p = state.progress[c.key];
    if (!p) { s.fresh++; s.due++; return; }
    if (p.box >= MASTERED) s.mastered++; else s.learning++;
    if (p.due <= now) s.due++;
  });
  return s;
};

// --- answer checking (typing mode) -----------------------------------------
const norm = (str) =>
  str.toLowerCase()
    .replace(/[’‘´\`]/g, "'")
    .replace(/[„“”"]/g, '')
    .replace(/[.!?,:;…–—-]+/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

const variants = (expected) => {
  const out = new Set([norm(expected)]);
  expected.split(/[;,]/).forEach((part) => {
    const p = part.trim();
    if (!p) return;
    out.add(norm(p));
    out.add(norm(p.replace(/\\([^)]*\\)/g, ''))); // without (…)
    out.add(norm(p.replace(/[()]/g, ''))); // with the (…) part
    out.add(norm(p.replace(/^to /i, ''))); // "to give" -> "give"
    out.add(norm(p.replace(/\\s*\\/\\s*/g, ' '))); // "boy / girl"
  });
  out.delete('');
  return out;
};

const isCorrect = (given, expected) => variants(expected).has(norm(given));

// --- speech ----------------------------------------------------------------
const canSpeak = 'speechSynthesis' in window;
const speak = (text, lang) => {
  if (!canSpeak) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'de' ? 'de-AT' : 'en-GB';
  speechSynthesis.speak(u);
};

// --- ui helpers ------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.flat().forEach((c) => node.append(c));
  return node;
};
const speakBtn = (text, lang) =>
  canSpeak
    ? el('button', { class: 'speak', title: 'Listen', 'aria-label': 'Listen', onclick: () => speak(text, lang) }, '🔊')
    : '';

const show = (id) => {
  document.querySelectorAll('[data-screen]').forEach((s) => (s.hidden = s.id !== id));
  window.scrollTo(0, 0);
};

// --- setup screen ----------------------------------------------------------
const settings = Object.assign({ units: [], mode: 'de-en', typing: false }, state.settings);
const urlUnit = new URLSearchParams(location.search).get('unit');
if (urlUnit && UNITS.some((u) => u.id === urlUnit)) settings.units = [urlUnit];
if (!settings.units.length) settings.units = [UNITS[0].id];

const renderSetup = () => {
  $('#mode').value = settings.mode;
  $('#typing').checked = settings.typing;
  const list = $('#units');
  list.replaceChildren();
  UNITS.forEach((u) => {
    const s = stats(cardsFor([u.id], settings.mode));
    if (!s.total) return;
    const pct = (n) => (100 * n) / s.total + '%';
    list.append(
      el('label', { class: 'unit' },
        el('input', {
          type: 'checkbox',
          value: u.id,
          ...(settings.units.includes(u.id) ? { checked: '' } : {}),
          onchange: (e) => {
            settings.units = e.target.checked
              ? [...settings.units, u.id]
              : settings.units.filter((id) => id !== u.id);
            updateStart();
          },
        }),
        el('span', { class: 'unit-body' },
          el('span', { class: 'unit-head' },
            el('strong', {}, u.name),
            el('span', { class: 'muted' }, s.mastered + ' / ' + s.total + ' learned · ' + s.due + ' due'),
          ),
          el('span', { class: 'bar', 'aria-hidden': 'true' },
            el('span', { class: 'bar-mastered', style: 'width:' + pct(s.mastered) }),
            el('span', { class: 'bar-learning', style: 'width:' + pct(s.learning) }),
          ),
        ),
      ),
    );
  });
  updateStart();
};

const updateStart = () => {
  const s = stats(cardsFor(settings.units, settings.mode));
  $('#start').disabled = !settings.units.length;
  $('#start-info').textContent = settings.units.length
    ? s.due + ' of ' + s.total + ' cards due'
    : 'Select at least one unit';
  state.settings = settings;
  save();
};

$('#mode').addEventListener('change', (e) => { settings.mode = e.target.value; renderSetup(); });
$('#typing').addEventListener('change', (e) => { settings.typing = e.target.checked; updateStart(); });
$('#all').addEventListener('click', () => { settings.units = UNITS.map((u) => u.id); renderSetup(); });
$('#none').addEventListener('click', () => { settings.units = []; renderSetup(); });
$('#reset').addEventListener('click', () => {
  if (!confirm('Delete all saved progress on this device?')) return;
  state.progress = {};
  save();
  renderSetup();
});

// --- session ---------------------------------------------------------------
let session = null;

const startSession = (anyway = false) => {
  const cards = cardsFor(settings.units, settings.mode);
  const now = Date.now();
  let queue;
  if (anyway) {
    queue = shuffle(cards).slice(0, SESSION_SIZE);
  } else {
    const due = cards.filter((c) => state.progress[c.key] && state.progress[c.key].due <= now);
    const fresh = cards.filter((c) => !state.progress[c.key]);
    queue = [...shuffle(due), ...shuffle(fresh)].slice(0, SESSION_SIZE);
  }
  if (!queue.length) {
    show('done');
    $('#done-title').textContent = 'All caught up!';
    $('#done-text').textContent = 'Nothing is due in the selected units right now. Come back later, or practise anyway.';
    return;
  }
  session = { queue, size: queue.length, right: 0, wrong: 0, seen: new Set() };
  show('session');
  nextCard();
};

const grade = (card, ok) => {
  const p = state.progress[card.key] || { box: 0 };
  // only the first answer in a session moves the card up
  if (ok && !session.seen.has(card.key)) {
    p.box = Math.min(p.box + 1, INTERVALS.length - 1);
    p.due = Date.now() + INTERVALS[p.box] * DAY;
    session.right++;
  } else if (!ok) {
    p.box = 1;
    p.due = Date.now();
    if (!session.seen.has(card.key)) session.wrong++;
    // ask again a few cards later
    session.queue.splice(Math.min(3, session.queue.length), 0, card);
  }
  session.seen.add(card.key);
  state.progress[card.key] = p;
  save();
};

const nextCard = () => {
  const card = session.queue.shift();
  if (!card) return finish();
  const m = MODES[settings.mode];
  const done = session.seen.size;
  $('#count').textContent = Math.min(done + 1, session.size) + ' / ' + session.size;
  $('#progress').style.width = (100 * done) / session.size + '%';

  const box = $('#card');
  box.replaceChildren(
    el('p', { class: 'ask' }, card.ask, m.askLang ? speakBtn(card.ask, m.askLang) : ''),
    card.hint ? el('p', { class: 'hint' }, card.hint) : '',
  );
  const actions = $('#actions');
  actions.replaceChildren();

  const reveal = (given) => {
    const ok = given === undefined ? null : isCorrect(given, card.answer);
    box.append(
      el('div', { class: 'answer' + (ok === true ? ' good' : ok === false ? ' bad' : '') },
        ok === null ? '' : el('p', { class: 'verdict' }, ok ? 'Correct!' : 'Not quite. The answer is:'),
        el('p', { class: 'answer-text' }, card.answer, speakBtn(card.answer, m.answerLang)),
      ),
    );
    if (m.answerLang === 'en') speak(card.answer, 'en');
    actions.replaceChildren();
    if (ok === null) {
      actions.append(
        el('button', { class: 'btn secondary', 'data-key': '1', onclick: () => { grade(card, false); nextCard(); } }, "Didn't know"),
        el('button', { class: 'btn', 'data-key': '2', onclick: () => { grade(card, true); nextCard(); } }, 'Knew it'),
      );
    } else if (ok) {
      grade(card, true);
      actions.append(el('button', { class: 'btn', 'data-key': 'Enter', onclick: nextCard }, 'Next'));
    } else {
      actions.append(
        el('button', { class: 'btn secondary', onclick: () => { grade(card, true); nextCard(); } }, 'I was right'),
        el('button', { class: 'btn', 'data-key': 'Enter', onclick: () => { grade(card, false); nextCard(); } }, 'Next'),
      );
    }
    // focus only in typing mode: there Enter moves on. In card mode a focused
    // button would also be "clicked" by the browser when Space is released.
    if (settings.typing) actions.querySelector('.btn:last-child').focus();
  };

  if (settings.typing) {
    const input = el('input', {
      type: 'text', class: 'type', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: 'Type the answer…', 'aria-label': 'Your answer',
    });
    const form = el('form', { class: 'type-form', onsubmit: (e) => {
      e.preventDefault();
      input.disabled = true;
      reveal(input.value);
    } }, input, el('button', { class: 'btn', type: 'submit' }, 'Check'));
    box.append(form);
    input.focus();
  } else {
    actions.append(el('button', { class: 'btn', 'data-key': ' ', onclick: () => reveal() }, 'Show answer'));
    if (document.activeElement) document.activeElement.blur();
  }
};

const finish = () => {
  show('done');
  $('#done-title').textContent = 'Round finished!';
  $('#done-text').textContent =
    session.right + ' right at the first try, ' + session.wrong + ' to practise again.';
};

// keyboard: space = show answer, 1 / 2 = didn't know / knew it, Enter = next
document.addEventListener('keydown', (e) => {
  if ($('#session').hidden || e.target.tagName === 'INPUT') return;
  const btn = [...document.querySelectorAll('#actions [data-key]')].find((b) => b.dataset.key === e.key);
  if (btn) { e.preventDefault(); btn.click(); }
});

$('#start').addEventListener('click', () => startSession());
$('#again').addEventListener('click', () => startSession());
$('#anyway').addEventListener('click', () => startSession(true));
$('#quit').addEventListener('click', () => { renderSetup(); show('setup'); });
$('#back').addEventListener('click', () => { renderSetup(); show('setup'); });

const modeSelect = $('#mode');
Object.entries(MODES).forEach(([k, m]) => modeSelect.append(el('option', { value: k }, m.label)));
renderSetup();
show('setup');
`;

const trainerPage = (units) => {
  const data = units.map((file) => {
    const json = JSON.parse(fs.readFileSync(path.resolve('src', `${file}.json`), 'utf8'));
    return { id: file, name: json.name, words: json.words };
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MORE! 1 Trainer</title>
<meta name="description" content="Practise the MORE! 1 vocabulary online with flashcards and spaced repetition.">
<style>
${baseStyle}
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px 64px; }
  .top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  h1 { margin: 0; font-size: 1.5rem; }
  .muted { color: var(--muted); font-size: 0.875rem; }
  .panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px; margin-top: 20px;
  }
  .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .field > span, .units-head span { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
  select, .type {
    font: inherit; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
  }
  .check { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
  .units-head { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 8px; }
  .link { background: none; border: 0; padding: 0 0 0 12px; font: inherit; font-size: 0.875rem; color: var(--accent); cursor: pointer; }
  .unit { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid var(--border); cursor: pointer; }
  .unit input { width: 18px; height: 18px; accent-color: var(--accent); flex: none; }
  .unit-body { flex: 1; min-width: 0; }
  .unit-head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .bar { display: flex; height: 6px; margin-top: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
  .bar-mastered { background: var(--good); }
  .bar-learning { background: var(--accent); opacity: 0.6; }
  .start { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
  .btn:disabled { opacity: 0.4; cursor: default; filter: none; }
  .session-top { display: flex; justify-content: space-between; align-items: center; }
  .track { height: 4px; background: var(--border); border-radius: 2px; margin-top: 8px; overflow: hidden; }
  #progress { height: 100%; background: var(--accent); transition: width 0.2s; }
  #card { min-height: 220px; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .ask { font-size: 1.625rem; font-weight: 600; margin: 0; line-height: 1.3; white-space: pre-line; }
  .hint { color: var(--muted); margin: 10px 0 0; font-style: italic; white-space: pre-line; }
  .answer { margin-top: 20px; padding: 14px; border-radius: 10px; background: var(--accent-soft); }
  .answer.good { background: var(--good-soft); }
  .answer.bad { background: var(--bad-soft); }
  .verdict { margin: 0 0 4px; font-size: 0.875rem; font-weight: 600; }
  .good .verdict { color: var(--good); }
  .bad .verdict { color: var(--bad); }
  .answer-text { margin: 0; font-size: 1.375rem; font-weight: 600; white-space: pre-line; }
  .speak { background: none; border: 0; cursor: pointer; font-size: 1.1rem; padding: 0 0 0 6px; vertical-align: middle; }
  .type-form { display: flex; gap: 8px; margin-top: 20px; }
  .type { flex: 1; min-width: 0; font-size: 1.125rem; }
  #actions { display: flex; gap: 8px; margin-top: 16px; }
  #actions .btn { flex: 1; padding: 12px; }
  .keys { text-align: center; margin-top: 12px; }
  @media (hover: none) { .keys { display: none; } }
</style>
</head>
<body>
<main>
  <div class="top">
    <h1>MORE! 1 Trainer</h1>
    <a href="./" class="muted">← All downloads</a>
  </div>

  <section id="setup" data-screen hidden>
    <div class="panel">
      <label class="field"><span>What to practise</span><select id="mode"></select></label>
      <label class="check"><input type="checkbox" id="typing"> Type the answer instead of flipping cards</label>
      <div class="units-head">
        <span>Units</span>
        <span><button class="link" id="all" type="button">All</button><button class="link" id="none" type="button">None</button></span>
      </div>
      <div id="units"></div>
      <div class="start">
        <span class="muted" id="start-info"></span>
        <button class="btn" id="start">Start practising</button>
      </div>
    </div>
    <p class="muted">Cards you know come back after 1, 2, 4, 8 and 16 days; cards you don't know come back right away. Your progress is saved in this browser only.
      <button class="link" id="reset" type="button">Reset progress</button></p>
  </section>

  <section id="session" data-screen hidden>
    <div class="panel">
      <div class="session-top">
        <span class="muted" id="count"></span>
        <button class="link" id="quit" type="button">End round</button>
      </div>
      <div class="track"><div id="progress"></div></div>
      <div id="card"></div>
      <div id="actions"></div>
    </div>
    <p class="muted keys">Keyboard: Space shows the answer · 1 didn't know · 2 knew it · Enter next</p>
  </section>

  <section id="done" data-screen hidden>
    <div class="panel">
      <h2 id="done-title"></h2>
      <p id="done-text"></p>
      <div class="start">
        <button class="btn secondary" id="back">Choose units</button>
        <span>
          <button class="btn secondary" id="anyway">Practise anyway</button>
          <button class="btn" id="again">Next round</button>
        </span>
      </div>
    </div>
  </section>
${footer}
</main>
<script type="application/json" id="data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
<script>${script}</script>
</body>
</html>
`;
};

module.exports = { trainerPage };
