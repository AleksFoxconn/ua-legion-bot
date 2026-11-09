// Оновлення гри (патч-ноути, хотфікси, технічні роботи) зі Steam-новин AION 2 → канал #оновлення.
// Джерело: офіційні оголошення NC у Steam (appid 3393110), публічний API без ключа. Мова: оригінал (англ.).
// Вебхук: UPDATES_WEBHOOK_URL. Стан (що вже надіслано) зберігається у кеші GitHub Actions: STATE_FILE.
import fs from 'node:fs';
import path from 'node:path';
import { sec } from './style.js';

const env = process.env;
const APP_ID = env.STEAM_APP_ID || '3393110';
const DRY = env.DRY_RUN === '1';
const STATE_FILE = env.STATE_FILE || '.cache/steam/state.json';
const MAX_AGE_H = Number(env.UPDATES_MAX_AGE_H || 48); // нові пости старші за це не публікуємо
const MAX_POSTS = 5;
const FMT_V = 2; // версія оформлення постів (2 = час у місцевому поясі читача)
const URL_API = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=40&maxlength=0&format=json`;

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

const cut = (s, n) => {
  if (s.length <= n) return s;
  const i = s.lastIndexOf('\n', n);
  return s.slice(0, i > n * 0.6 ? i : n).trimEnd() + '\n…';
};

// ---------- відбір та типи ----------
const OTHER_REGION = /\((?:NAW|NAE|NA|SA|SAM|ASIA|JP|KR|LATAM)\)/i; // регіональні роботи не для EU
export function classify(it) {
  if (it.feedname !== 'steam_community_announcements') return null;
  const t = it.title || '';
  if (/account restriction/i.test(t)) return null;
  if (OTHER_REGION.test(t)) return null;
  if (/maintenance/i.test(t)) return 'maintenance';
  if (/patch notes|hotfix/i.test(t) || (it.tags || []).includes('patchnotes')) return 'patch';
  return null;
}
const isDone = (t) => /\(\s*completed\s*\)/i.test(t || '');

export function buildEmbed(it, kind) {
  const ts = it.date;
  let head = '';
  let color = 0x1abc9c;
  if (kind === 'maintenance') {
    const done = isDone(it.title);
    head = done ? '✅ **Технічні роботи завершено**\n\n' : '🛠 **Тривають (або заплановані) технічні роботи**\n\n';
    color = done ? 0x2ecc71 : 0xe67e22;
  }
  const link = `https://store.steampowered.com/news/app/${APP_ID}/view/${it.gid}`;
  const body = cut(localizeTimes(bbToMd(it.contents), ts), 3400);
  return {
    color,
    title: (kind === 'patch' ? '📝 ' : '🛠 ') + String(it.title || '').slice(0, 240),
    url: link,
    description: `${head}${body}\n\n[Читати в Steam](${link})\n🕒 Опубліковано <t:${ts}:f> (<t:${ts}:R>)`,
  };
}

// ---------- стан ----------
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { init: false, seen: {} }; }
}
function saveState(st) {
  const keys = Object.keys(st.seen);
  if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete st.seen[k];
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(st));
}

async function send(url, embed, mid) {
  const body = JSON.stringify({ embeds: [embed] });
  const headers = { 'Content-Type': 'application/json' };
  if (DRY) { console.log('[DRY]', mid ? 'PATCH' : 'POST', embed.title); console.log(embed.description.slice(0, 700)); return mid || 'dry'; }
  if (mid) {
    const r = await fetch(`${url}/messages/${mid}`, { method: 'PATCH', headers, body });
    if (r.ok) return mid;
    console.warn('PATCH не вдався', r.status);
  }
  const r = await fetch(`${url}?wait=true`, { method: 'POST', headers, body });
  if (!r.ok) throw new Error(`Вебхук: ${r.status} ${await r.text()}`);
  return (await r.json()).id;
}

async function main() {
  const url = env.UPDATES_WEBHOOK_URL;
  if (!url && !DRY) return console.log('Немає UPDATES_WEBHOOK_URL: оновлення гри пропущено');
  let data;
  if (env.STEAM_NEWS_FILE) data = JSON.parse(fs.readFileSync(env.STEAM_NEWS_FILE, 'utf8'));
  else {
    const r = await fetch(URL_API, { headers: { 'User-Agent': 'ua-legion-updates (low-frequency)' } });
    if (!r.ok) throw new Error(`Steam news: ${r.status}`);
    data = await r.json();
  }
  const items = (data.appnews?.newsitems || [])
    .map((it) => ({ it, kind: classify(it) }))
    .filter((x) => x.kind)
    .sort((a, b) => a.it.date - b.it.date); // від старих до нових
  const st = loadState();
  const nowS = Math.floor(Date.now() / 1000);
  let posts = 0;

  if (!st.init) {
    // перший запуск: старе вважаємо побаченим, публікуємо лише найновіший пост (щоб було видно, що працює)
    for (const { it } of items) st.seen[it.gid] = { done: isDone(it.title) };
    const last = items.at(-1);
    if (last) {
      const mid = await send(url, buildEmbed(last.it, last.kind));
      st.seen[last.it.gid] = { mid, done: isDone(last.it.title) };
      posts++;
    }
    st.init = true;
    saveState(st);
    return console.log(`Ініціалізовано, опубліковано ${posts}`);
  }

  for (const { it, kind } of items) {
    const rec = st.seen[it.gid];
    const done = isDone(it.title);
    if (!rec) {
      if (nowS - it.date > MAX_AGE_H * 3600) { st.seen[it.gid] = { done }; continue; }
      if (posts >= MAX_POSTS) continue;
      const mid = await send(url, buildEmbed(it, kind));
      st.seen[it.gid] = { mid, done, v: FMT_V };
      posts++;
      console.log('Опубліковано:', it.title);
    } else if (kind === 'maintenance' && rec.done !== done) {
      const mid = await send(url, buildEmbed(it, kind), rec.mid);
      st.seen[it.gid] = { mid, done, v: FMT_V };
      console.log('Оновлено статус робіт:', it.title);
    } else if (rec.mid && rec.v !== FMT_V && nowS - it.date <= MAX_AGE_H * 3600) {
      // новий формат оформлення (місцевий час) → оновлюємо свіжі вже надіслані пости
      const mid = await send(url, buildEmbed(it, kind), rec.mid);
      st.seen[it.gid] = { ...rec, mid, v: FMT_V };
      console.log('Переоформлено:', it.title);
    }
  }
  saveState(st);
  console.log(`Готово, нових повідомлень: ${posts}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
