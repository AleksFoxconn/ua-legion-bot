// Версія БЕЗ хостингу: запускається за розкладом (GitHub Actions), робить усе і завершується.
//  1) оновлює «дошку» в каналі через вебхук (мітки <t:..:R> самі відлічують час у Discord);
//  2) створює події Discord (Scheduled Events) на найближчі ~48 год: Discord сам сповіщає тих,
//     хто натиснув «Цікаво». Це замінює «пінг за 10 хвилин» без постійно ввімкненого бота.
import { DateTime } from 'luxon';
import { CATEGORIES } from './bosses.js';
import { active, nextPerBoss, spawnsBetween } from './schedule.js';
import { line, more, updated } from './style.js';

const env = process.env;
const TZ = env.SERVER_TZ;
const DRY = env.DRY_RUN === '1';
const HOURS = Number(env.EVENTS_HOURS || 48);
if (!TZ) throw new Error('Не задано SERVER_TZ');

const now = DateTime.now().setZone(TZ);
const ts = (dt) => Math.floor(dt.toMillis() / 1000);
const API = 'https://discord.com/api/v10';
const category = CATEGORIES.abyss;

async function call(url, opts = {}) {
  if (DRY) {
    console.log('[DRY]', opts.method || 'GET', url.replace(/\/webhooks\/.*/, '/webhooks/***'));
    if (opts.body) console.log(opts.body);
    return { ok: true, status: 200, json: async () => ({ id: 'dry' }) };
  }
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return res;
}

// ---------- 1. дошка ----------
function boardEmbed() {
  const nowMs = now.toMillis();
  const blocks = active(category).map((boss) => {
    const to = now.plus({ hours: HOURS });
    const next = spawnsBetween(boss, now, to, TZ).slice(0, 3).map((t) => t.toMillis());
    if (!next.length) return `⏳ **${boss.name}** — найближчим часом немає`;
    return [line('⏳', boss.name, next[0], nowMs), more(next.slice(1), nowMs)].filter(Boolean).join('\n');
  });
  return {
    color: 0x3498db,
    title: `${category.emoji} Abyss — боси`,
    description: blocks.join('\n\n') + `\n\n${updated(nowMs)}`,
  };
}

async function updateBoard() {
  const url = env.DISCORD_WEBHOOK_URL;
  if (!url) return console.log('Немає DISCORD_WEBHOOK_URL: дошку пропущено');
  const body = JSON.stringify({ embeds: [boardEmbed()] });
  const id = env.BOARD_MESSAGE_ID;
  if (id) {
    const r = await call(`${url}/messages/${id}`, { method: 'PATCH', body });
    if (r.ok) return console.log('Дошку оновлено');
    console.warn('Не вдалося редагувати дошку, статус', r.status, '— створюю нову');
  }
  const r = await call(`${url}?wait=true`, { method: 'POST', body });
  if (!r.ok) throw new Error(`Вебхук: ${r.status}`);
  const msg = await r.json();
  console.log(`::notice::Створено дошку. Додай секрет BOARD_MESSAGE_ID=${msg.id}, щоб надалі її редагувати`);
}

// ---------- 2. події Discord ----------
async function syncEvents() {
  const { DISCORD_TOKEN: token, GUILD_ID: guild } = env;
  if (!token || !guild) return console.log('Немає DISCORD_TOKEN/GUILD_ID: події пропущено');
  const headers = { Authorization: `Bot ${token}` };

  const listRes = await call(`${API}/guilds/${guild}/scheduled-events`, { headers });
  if (!DRY && !listRes.ok) return console.warn(`Події пропущено: Discord ${listRes.status} (перевір токен/дозволи бота)`);
  const existing = DRY ? [] : await listRes.json();
  const have = new Set(existing.map((e) => `${e.name}|${Date.parse(e.scheduled_start_time)}`));

  // групуємо боси з однаковим часом в одну подію
  const to = now.plus({ hours: HOURS });
  const groups = new Map();
  for (const boss of active(category).filter((b) => b.event !== false)) {
    for (const t of spawnsBetween(boss, now.plus({ minutes: 5 }), to, TZ)) {
      const k = t.toMillis();
      if (!groups.has(k)) groups.set(k, { time: t, bosses: [] });
      groups.get(k).bosses.push(boss);
    }
  }

  for (const { time, bosses } of [...groups.values()].sort((a, b) => a.time - b.time)) {
    const name = `${category.emoji} ${bosses.map((b) => b.name).join(', ')}`.slice(0, 100);
    if (have.has(`${name}|${time.toMillis()}`)) continue;
    const body = JSON.stringify({
      name,
      scheduled_start_time: time.toUTC().toISO(),
      scheduled_end_time: time.plus({ minutes: 30 }).toUTC().toISO(),
      privacy_level: 2,
      entity_type: 3,
      entity_metadata: { location: bosses[0].zone },
      description: bosses.map((b) => b.name).join('\n'),
    });
    const r = await call(`${API}/guilds/${guild}/scheduled-events`, { method: 'POST', headers, body });
    if (!r.ok) {
      console.warn('Подію не створено:', name, r.status, DRY ? '' : await r.text());
      if (r.status === 403 || r.status === 429) return console.warn('Зупиняю створення подій (права бота / ліміт)');
    } else {
      console.log('Створено подію:', name, time.toFormat('ccc dd.MM HH:mm'));
      if (!DRY) await new Promise((r2) => setTimeout(r2, 2000));
    }
  }
}

await updateBoard();
// події Discord тепер веде events-board.js (єдиний ліміт на кількість подій)
