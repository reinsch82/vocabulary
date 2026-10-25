/* global module */

// colors and base styles shared by index.html and trainer.html
const baseStyle = `
  :root {
    --bg: #f7f7f5; --surface: #ffffff; --text: #1d1d1b; --muted: #6b6b66;
    --border: #e2e2dd; --accent: #c2410c; --accent-text: #ffffff; --accent-soft: #fdeee6;
    --good: #15803d; --good-soft: #e3f4e8; --bad: #b91c1c; --bad-soft: #fbe6e6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #161615; --surface: #20201e; --text: #ececea; --muted: #a3a39d;
      --border: #34342f; --accent: #fb923c; --accent-text: #1d1d1b; --accent-soft: #3a2619;
      --good: #4ade80; --good-soft: #17301f; --bad: #f87171; --bad-soft: #3a1c1c;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  a { color: var(--accent); }
  .btn {
    display: inline-block; text-align: center; padding: 8px 12px; border-radius: 8px;
    background: var(--accent); color: var(--accent-text); text-decoration: none;
    font: inherit; font-weight: 600; font-size: 0.9375rem; border: 1px solid var(--accent);
    cursor: pointer;
  }
  .btn.secondary { background: transparent; color: var(--accent); }
  .btn:hover { filter: brightness(1.08); }
  .btn.secondary:hover { background: var(--accent-soft); filter: none; }
  footer { margin-top: 48px; font-size: 0.875rem; color: var(--muted); }
`;

const footer = `
  <footer>
    Vocabulary lists by Wolfgang Jungmayer (<a href="https://github.com/lemon3/vocabulary">lemon3/vocabulary</a>), MIT License.<br>
    German example sentences, worksheets and online trainer by Reinhold Degenfellner (<a href="https://github.com/reinsch82/vocabulary">reinsch82/vocabulary</a>).
  </footer>`;

module.exports = { baseStyle, footer };
