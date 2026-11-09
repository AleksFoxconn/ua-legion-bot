// Чисті функції форматування Steam-постів (без process/fs) — спільні для Actions і Cloudflare Worker.
// ---------- Steam BBCode → Discord Markdown ----------
export function bbToMd(src) {
  let s = String(src || '').replace(/[\u200b-\u200d\ufeff]/g, '');
  s = s.replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, '');
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '[$2]($1)');
  s = s.replace(/\[h[1-3]\]([\s\S]*?)\[\/h[1-3]\]/gi, (_, t) => `\n**${t.replace(/\[\/?b\]/gi, '').trim()}**\n`);
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '**$1**');
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '*$1*');
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '__$1__');
  s = s.replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, '~~$1~~');
  s = s.replace(/\[\*\]/g, '\n• ').replace(/\[\/\*\]/g, '');
  s = s.replace(/\[\/t[dh]\]/gi, ' | ').replace(/\[\/tr\]/gi, '\n');
  s = s.replace(/\[\/p\]/gi, '\n').replace(/\[hr\]/gi, '\n');
  s = s.replace(/\[\/?(?:p|list|olist|table|tr|td|th|h\d|b|i|u|strike|hr|quote|code|spoiler|url|noparse|previewyoutube)(?:[= ][^\]]*)?\]/gi, '');
  s = s.replace(/\\\[/g, '[').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  s = s
    .split('\n')
    .map((l) => l.replace(/\s*\|\s*$/, '').replace(/[ \t]+$/g, ''))
    .filter((l, i, a) => !(l.trim() === '' && a[i - 1]?.trim() === ''))
    .join('\n');
  return s.trim();
}


// ---------- час → <t:...> (Discord показує кожному у його часовому поясі) ----------
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const TZ_OFF = { PST: -8, PDT: -7, UTC: 0, GMT: 0, CET: 1, CEST: 2, KST: 9 };
const TZ = 'PST|PDT|UTC|GMT|CET|CEST|KST';
const D = '([A-Z][a-z]{2,8})\\.?\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?';
function toTs(mon, day, year, hm, tz, postSec) {
  const m = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (m === undefined || !(tz in TZ_OFF)) return null;
  const [h, mi] = hm.split(':').map(Number);
  const post = new Date(postSec * 1000);
  let y = year ? Number(year) : post.getUTCFullYear();
  const mk = (yy) => Date.UTC(yy, m, Number(day), h, mi) / 1000 - TZ_OFF[tz] * 3600;
  let t = mk(y);
  if (!year && t < postSec - 150 * 86400) t = mk(y + 1); // дата без року, що вже «в минулому» → наступний рік
  return t;
}
const fmt = (t) => `<t:${t}:F>`;
export function localizeTimes(text, postSec) {
  const lines = String(text).split('\n');
  const out = [];
  let skipTz = false;
  for (const line of lines) {
    if (skipTz && new RegExp(`^\\s*(?:■\\s*)?(?:${TZ}):\\s*[A-Z]`).test(line)) continue; // дублікат в іншому поясі
    // діапазон: "PST: November 4, 2026 at 06:00 - November 17, 2026 at 23:59"
    const rg = line.match(new RegExp(`^(\\s*(?:■\\s*)?)(${TZ}):\\s*${D}\\s+at\\s+(\\d{1,2}:\\d{2})\\s*[-–]\\s*${D.replace(/\(\[A-Z\]/, '([A-Z]')}\\s+at\\s+(\\d{1,2}:\\d{2})\\s*$`));
    if (rg) {
      const [, pre, tz, m1, d1, y1, h1, m2, d2, y2, h2] = rg;
      const a = toTs(m1, d1, y1, h1, tz, postSec);
      const b = toTs(m2, d2, y2 || y1, h2, tz, postSec);
      if (a && b) { out.push(`${pre}${fmt(a)} – ${fmt(b)}`); skipTz = true; continue; }
    }
    skipTz = false;
    // одиночний час: "November 10, from 12:00 PST / 20:00 CET", "Nov 4, 00:00 PST / 09:00 CET"
    const rest = `(?:\\s*\\/\\s*(?:[A-Z][a-z]{2,8}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?(?:,|\\s+at)?\\s*)?\\d{1,2}:\\d{2}\\s*(?:${TZ}))*`;
    const re = new RegExp(`${D}(?:,|\\s+at)?\\s*(?:from\\s+)?(\\d{1,2}:\\d{2})\\s*(${TZ})${rest}`, 'g');
    out.push(line.replace(re, (all, mon, day, year, hm, tz) => {
      const t = toTs(mon, day, year, hm, tz, postSec);
      return t ? `${fmt(t)} (<t:${t}:R>)` : all;
    }));
  }
  return out.join('\n');
}

export const cut = (s, n) => {
  if (s.length <= n) return s;
  const i = s.lastIndexOf('\n', n);
  return s.slice(0, i > n * 0.6 ? i : n).trimEnd() + '\n…';
};

