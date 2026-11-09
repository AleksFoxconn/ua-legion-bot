// Оновлення гри (патч-ноути, хотфікси, технічні роботи) зі Steam-новин AION 2 → канал #оновлення.
// Джерело: офіційні оголошення NC у Steam (appid 3393110), публічний API без ключа. Мова: оригінал (англ.).
// Вебхук: UPDATES_WEBHOOK_URL. Стан (що вже надіслано) зберігається у кеші GitHub Actions: STATE_FILE.
import fs from 'node:fs';
import path from 'node:path';
import { sec } from './style.js';
import { bbToMd, localizeTimes, cut } from './steam-format.js';
export { bbToMd, localizeTimes };

const env = process.env;
const APP_ID = env.STEAM_APP_ID || '3393110';
const DRY = env.DRY_RUN === '1';
const STATE_FILE = env.STATE_FILE || '.cache/steam/state.json';
const MAX_AGE_H = Number(env.UPDATES_MAX_AGE_H || 48); // нові пости старші за це не публікуємо
const MAX_POSTS = 5;
const FMT_V = 3; // версія оформлення постів (2 = час у місцевому поясі читача)
const URL_API = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID}&count=40&maxlength=0&format=json`;

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
  const link = `https://steamcommunity.com/games/${APP_ID}/announcements/detail/${it.gid}`;
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

// ---------- публікація: через бота (з кнопкою «Перекласти») або вебхук ----------
const BOT = env.TRANSLATE_BUTTON === '1' && env.DISCORD_TOKEN && env.GUILD_ID;
const DAPI = 'https://discord.com/api/v10';
const DH = { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' };
let chanId;
async function botChannel() {
  if (chanId) return chanId;
  const chans = await (await fetch(`${DAPI}/guilds/${env.GUILD_ID}/channels`, { headers: DH })).json();
  const c = chans.find((x) => x.name === (env.UPDATES_CHANNEL || 'оновлення'));
  if (!c) throw new Error('Канал оновлень не знайдено');
  return (chanId = c.id);
}
const buttons = (gid) => [{ type: 1, components: [{ type: 2, style: 2, label: 'Перекласти', emoji: { name: '🇺🇦' }, custom_id: `tr:${gid}` }] }];
// повертає { mid, via }; rec — попередній запис (якщо пост уже є)
async function publish(url, it, kind, rec) {
  const embed = buildEmbed(it, kind);
  if (!BOT || DRY) return { mid: await send(url, embed, rec?.mid), via: rec?.via || 'hook' };
  const ch = await botChannel();
  const payload = JSON.stringify({ embeds: [embed], components: buttons(it.gid) });
  if (rec?.mid && rec.via === 'bot') {
    const r = await fetch(`${DAPI}/channels/${ch}/messages/${rec.mid}`, { method: 'PATCH', headers: DH, body: payload });
    if (r.ok) return { mid: rec.mid, via: 'bot' };
    console.warn('PATCH ботом не вдався', r.status);
  }
  const r = await fetch(`${DAPI}/channels/${ch}/messages`, { method: 'POST', headers: DH, body: payload });
  if (!r.ok) throw new Error(`Бот не зміг написати: ${r.status} ${await r.text()}`);
  const mid = (await r.json()).id;
  if (rec?.mid && rec.via !== 'bot' && url) { // старий вебхук-пост прибираємо, щоб не було дубля
    const d = await fetch(`${url}/messages/${rec.mid}`, { method: 'DELETE' });
    console.log('старий вебхук-пост видалено:', d.status);
  }
  return { mid, via: 'bot' };
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
      const { mid, via } = await publish(url, last.it, last.kind);
      st.seen[last.it.gid] = { mid, via, done: isDone(last.it.title), v: FMT_V };
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
      const { mid, via } = await publish(url, it, kind);
      st.seen[it.gid] = { mid, via, done, v: FMT_V };
      posts++;
      console.log('Опубліковано:', it.title);
    } else if (kind === 'maintenance' && rec.done !== done) {
      const { mid, via } = await publish(url, it, kind, rec);
      st.seen[it.gid] = { mid, via, done, v: FMT_V };
      console.log('Оновлено статус робіт:', it.title);
    } else if (rec.mid && (rec.v !== FMT_V || (BOT && rec.via !== 'bot')) && nowS - it.date <= MAX_AGE_H * 3600) {
      // новий формат (місцевий час) або перехід на пости від бота з кнопкою → оновлюємо свіжі пости
      const { mid, via } = await publish(url, it, kind, rec);
      st.seen[it.gid] = { ...rec, mid, via, v: FMT_V };
      console.log('Переоформлено:', it.title);
    }
  }
  saveState(st);
  console.log(`Готово, нових повідомлень: ${posts}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
