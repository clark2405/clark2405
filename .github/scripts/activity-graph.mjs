// Generates activity-graph.svg from the GitHub contributions calendar.
// Usage: GITHUB_TOKEN=... USERNAME=clark2405 node .github/scripts/activity-graph.mjs
import { writeFileSync } from 'node:fs';

const USERNAME = process.env.USERNAME || 'clark2405';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const DAYS = 31;
const OUT = process.env.OUT || 'activity-graph.svg';

if (!TOKEN) throw new Error('GH_TOKEN or GITHUB_TOKEN is required');

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { login: USERNAME } }),
});
const json = await res.json();
if (json.errors || !json.data?.user) throw new Error(JSON.stringify(json.errors || json));

const days = json.data.user.contributionsCollection.contributionCalendar.weeks
  .flatMap((w) => w.contributionDays)
  .slice(-DAYS);

// Layout
const W = 820, H = 300;
const pad = { top: 56, right: 28, bottom: 44, left: 52 };
const cw = W - pad.left - pad.right;
const ch = H - pad.top - pad.bottom;

const counts = days.map((d) => d.contributionCount);
const total = counts.reduce((a, b) => a + b, 0);
const peak = Math.max(...counts);
const yMax = Math.max(4, Math.ceil(peak / 4) * 4);

const x = (i) => pad.left + (i / (days.length - 1)) * cw;
const y = (v) => pad.top + ch - (v / yMax) * ch;

const pts = days.map((d, i) => [x(i), y(d.contributionCount)]);
const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
const area = `${line} L${x(days.length - 1).toFixed(1)},${pad.top + ch} L${pad.left},${pad.top + ch} Z`;

const yTicks = [0, 1, 2, 3, 4].map((k) => (yMax / 4) * k);
const grid = yTicks
  .map((v) => `<line class="grid" x1="${pad.left}" x2="${W - pad.right}" y1="${y(v)}" y2="${y(v)}"/>
    <text class="axis" x="${pad.left - 10}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`)
  .join('\n    ');

const xLabels = days
  .map((d, i) => (i % 5 === 0 || i === days.length - 1)
    ? `<text class="axis" x="${x(i)}" y="${H - pad.bottom + 20}" text-anchor="middle">${d.date.slice(5).replace('-', '/')}</text>`
    : '')
  .filter(Boolean)
  .join('\n    ');

const points = pts
  .map(([px, py], i) => `<circle class="pt" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6"><title>${days[i].date}: ${counts[i]}</title></circle>`)
  .join('\n    ');

const range = `${days[0].date} → ${days[days.length - 1].date}`;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .title { font-family: 'Share Tech Mono', 'Courier New', Courier, monospace; font-size: 13px; letter-spacing: 2px; fill: #22d3ee; }
      .meta { font-family: 'Share Tech Mono', 'Courier New', Courier, monospace; font-size: 10px; letter-spacing: 1px; fill: #a0aec0; }
      .axis { font-family: 'Share Tech Mono', 'Courier New', Courier, monospace; font-size: 10px; fill: #a0aec0; }
      .grid { stroke: rgba(34, 211, 238, 0.12); stroke-width: 1; stroke-dasharray: 4 4; }
      .bracket { stroke: #22d3ee; stroke-width: 1.5; opacity: 0.8; }
      .line { stroke: #22d3ee; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
      .pt { fill: #ffffff; stroke: #22d3ee; stroke-width: 1.2; }
      .stop-a { stop-color: #22d3ee; stop-opacity: 0.35; }
      .stop-b { stop-color: #22d3ee; stop-opacity: 0; }
      .draw { stroke-dasharray: 3000; animation: draw 2.4s ease-out; }
      @keyframes draw { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
      @media (prefers-color-scheme: light) {
        .title { fill: #0891b2; }
        .meta, .axis { fill: #475569; }
        .grid { stroke: rgba(8, 145, 178, 0.18); }
        .bracket, .line { stroke: #0891b2; }
        .pt { fill: #0891b2; stroke: #0891b2; }
        .stop-a, .stop-b { stop-color: #0891b2; }
      }
    </style>
    <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="stop-a" stop-color="#22d3ee" stop-opacity="0.35"/>
      <stop offset="1" class="stop-b" stop-color="#22d3ee" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- HUD corner brackets -->
  <path class="bracket" d="M2 18 V2 H18"/>
  <path class="bracket" d="M${W - 18} 2 H${W - 2} V18"/>
  <path class="bracket" d="M2 ${H - 18} V${H - 2} H18"/>
  <path class="bracket" d="M${W - 18} ${H - 2} H${W - 2} V${H - 18}"/>

  <text class="title" x="${pad.left}" y="30">CONTRIBUTION ACTIVITY // LAST ${DAYS} DAYS</text>
  <text class="meta" x="${W - pad.right}" y="30" text-anchor="end">TOTAL ${total} · PEAK ${peak} · ${range}</text>

  <g>
    ${grid}
    ${xLabels}
  </g>
  <path d="${area}" fill="url(#fill)"/>
  <path class="line draw" d="${line}"/>
  <g>
    ${points}
  </g>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`Wrote ${OUT}: ${days.length} days, total ${total}, peak ${peak}`);
