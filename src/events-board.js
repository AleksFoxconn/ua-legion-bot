// Табло загальних івентів (Rift, Shugo, Dimensional Invasion, Artifact Siege) + події Discord.
// Секрети: EVENTS_WEBHOOK_URL (+EVENTS_BOARD_MESSAGE_ID); для подій Discord: DISCORD_TOKEN + GUILD_ID.
import { DateTime } from 'luxon';
import { EVENTS, nextOccurrences } from './events.js';
import { analyzeRift } from './rift-bosses.js';
import { CATEGORIES } from './bosses.js';
import { active, spawnsBetween } from './schedule.js';
import { NAMES } from './world-bosses.js';
import { line, more, updated } from './style.js';

const env = process.env;
const TZ = env.SERVER_TZ || 'Europe/Warsaw';
const DRY = env.DRY_RUN === '1';
const HOURS = Number(env.EVENTS_HOURS || 48);
const API = 'https://discord.com/api/v10';
const now = DateTime.now().setZone(TZ);
const ts = (dt) => Math.floor(dt.toMillis() / 1000);
const NOTMETER =
  env.NOTMETER_URL ||
  'https://raw.githubusercontent.com/Not4You-Dev/NotMeter-Cache/main/presence/notmeter-field-boss-public-ww-eu-expanded.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadNotMeter() {
  try {
    const r = await fetch(NOTMETER);
    if (!r.ok) throw new Error(`NotMeter ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn('NotMeter недоступний:', e.message);
    return null;
  }
}

function riftSection(data) {
  const rift = EVENTS.find((e) => e.id === 'rift');
  const open = nextOccurrences(rift, now, TZ, 1)[0];
  const res = analyzeRift(data, open.toMillis());
  if (!res.ok) return '';
  let text = `${line('⚔️', 'Rift-боси', open.toMillis(), now.toMillis())}\n`;
  if (res.opportunities.length) {
    text += `_Є можливість вбити боса спочатку у ріфт-світі, а потім у нашому (різниця понад 5 хв): ${res.opportunities.length}_`;
  } else if (!res.hasPairs) {
    text += '_порівняння босів Rift з нашим світом ще налаштовується_';
  } else {
    text += '_зараз немає босів з різницею понад 5 хв_';
  }
  return text;
}

async function call(url, opts = {}) {
  if (DRY) {
    console.log('[DRY]', opts.method || 'GET', url.replace(/\/webhooks\/.*/, '/webhooks/***'));
    if (opts.body) console.log(opts.body);
    return { ok: true, status: 200, json: async () => ({ id: 'dry' }), text: async () => '' };
  }
  return fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
}

function board(data) {
  const nowMs = now.toMillis();
  const blocks = EVENTS.map((ev) => {
    const next = nextOccurrences(ev, now, TZ).map((t) => t.toMillis());
    return [line(ev.emoji, ev.name, next[0], nowMs), more(next.slice(1), nowMs), `_${ev.note}_`]
      .filter(Boolean)
      .join('\n');
  });
  return {
    color: 0x9b59b6,
    title: '📅 Івенти — Global',
    description: [...blocks, riftSection(data)].filter(Boolean).join('\n\n') + `\n\n${updated(nowMs)}`,
  };
}

async function updateBoard(data) {
  const url = env.EVENTS_WEBHOOK_URL;
  if (!url) return console.log('Немає EVENTS_WEBHOOK_URL: табло пропущено');
  const body = JSON.stringify({ embeds: [board(data)] });
  const id = env.EVENTS_BOARD_MESSAGE_ID;
  if (id) {
    const r = await call(`${url}/messages/${id}`, { method: 'PATCH', body });
    if (r.ok) return console.log('Табло подій оновлено');
    console.warn('PATCH не вдався', r.status, '— створюю нове');
  }
  const r = await call(`${url}?wait=true`, { method: 'POST', body });
  if (!r.ok) throw new Error(`Вебхук: ${r.status}`);
  console.log(`::notice::Створено табло подій. Додай секрет EVENTS_BOARD_MESSAGE_ID=${(await r.json()).id}`);
}

// скільки найближчих подій кожного типу тримаємо в Discord (за замовчуванням 1)
// подія «світиться» лише SHOW_MIN хв після початку, потім Discord сам завершує її
const SHOW_MIN = Number(env.EVENT_SHOW_MIN || 2);
const QUOTA = { rift: 2, abyss: 2 };
const CATEGORY = CATEGORIES.abyss;

/** Кандидати на події Discord: { type, name, time, end, location, description }. */
function candidates(data) {
  const from = now.plus({ minutes: 5 });
  const to = now.plus({ hours: 168 });
  const out = [];
  for (const ev of EVENTS.filter((e) => e.discordEvent)) {
    for (const t of nextOccurrences(ev, from, TZ, 400).filter((x) => x <= to)) {
      out.push({ type: ev.id, name: `${ev.emoji} ${ev.name}`, time: t, minutes: ev.windowMin, location: 'Aion 2', description: ev.note });
    }
  }
  // боси Abyss з однаковим часом спавну — в одну подію
  const groups = new Map();
  for (const boss of active(CATEGORY).filter((b) => b.event !== false)) {
    for (const t of spawnsBetween(boss, from, to, TZ)) {
      const k = t.toMillis();
      if (!groups.has(k)) groups.set(k, { time: t, bosses: [] });
      groups.get(k).bosses.push(boss);
    }
  }
  for (const { time, bosses } of groups.values()) {
    out.push({
      type: 'abyss', name: `${CATEGORY.emoji} ${bosses.map((b) => b.name).join(', ')}`.slice(0, 100), time, minutes: 30,
      location: bosses[0].zone, description: bosses.map((b) => b.name).join('\n'),
    });
  }
  // Watcher Kaira (кожні 3 год): лише найближчий
  for (const boss of active(CATEGORY).filter((b) => b.event === false)) {
    for (const t of spawnsBetween(boss, from, to, TZ)) {
      out.push({ type: 'kaira', name: `${CATEGORY.emoji} ${boss.name}`, time: t, minutes: 30, location: boss.zone, description: boss.name });
    }
  }
  // світові боси Verteron (NotMeter): час спавну може змінитись після вбивства, подія тоді переcтворюється
  const srv = (data?.servers || []).find((s) => s.serverId === 1315);
  const map = (srv?.maps || []).find((m) => m.mapId === 1010);
  for (const e of map?.entries || []) {
    if (e.spawned || e.targetAt < from.toMillis() || e.targetAt > to.toMillis()) continue;
    out.push({
      type: 'world', name: `🌲 ${NAMES[e.bossCode] || e.bossCode}`.slice(0, 100),
      time: DateTime.fromMillis(Math.floor(e.targetAt / 60000) * 60000, { zone: TZ }), minutes: 15,
      location: 'Verteron', description: 'Світовий бос (дані NotMeter, час може змінитись)',
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Для кожного типу — найближчі QUOTA[type] (за замовчуванням 1) подій. */
function pickWanted(list) {
  const cnt = {};
  const out = [];
  for (const c of list) {
    cnt[c.type] = (cnt[c.type] || 0) + 1;
    if (cnt[c.type] <= (QUOTA[c.type] || 1)) out.push(c);
  }
  return out;
}

async function syncEvents(data) {
  const { DISCORD_TOKEN: token, GUILD_ID: guild } = env;
  if (!token || !guild) return console.log('Немає DISCORD_TOKEN/GUILD_ID: події Discord пропущено');
  const headers = { Authorization: `Bot ${token}` };
  const listRes = await call(`${API}/guilds/${guild}/scheduled-events`, { headers });
  if (!DRY && !listRes.ok) return console.warn(`Події пропущено: Discord ${listRes.status} (перевір токен/дозволи бота)`);
  const existing = DRY ? [] : await listRes.json();

  const all = candidates(data);
  const wanted = pickWanted(all);
  const key = (name, ms) => `${name}|${ms}`;
  const wantedKeys = new Set(wanted.map((c) => key(c.name, c.time.toMillis())));
  const allKeys = new Set(all.map((c) => key(c.name, c.time.toMillis())));
  const nowMs = now.toMillis();

  // видаляємо майбутні події бота, яких немає серед потрібних (більше ліміту або застарілі за розкладом)
  for (const e of existing) {
    const start = Date.parse(e.scheduled_start_time);
    const mine = allKeys.has(key(e.name, start)) || [...wantedKeys].some((k) => k.startsWith(`${e.name}|`)) || /^(🌀|🏰|⚔️|🩸|🏟️|🔄|🗓️|🌲|🎉|👾)/u.test(e.name);
    if (!mine || start < nowMs + 600000 || wantedKeys.has(key(e.name, start))) continue;
    if (DRY) { console.log('[DRY] видалив би', e.name, e.scheduled_start_time); continue; }
    let d = await call(`${API}/guilds/${guild}/scheduled-events/${e.id}`, { method: 'DELETE', headers });
    if (d.status === 429) {
      const wait = Math.min(((await d.json().catch(() => ({}))).retry_after || 5) + 1, 30);
      console.log(`Ліміт Discord, чекаю ${wait} с`);
      await sleep(wait * 1000);
      d = await call(`${API}/guilds/${guild}/scheduled-events/${e.id}`, { method: 'DELETE', headers });
    }
    console.log(d.ok ? 'Видалено:' : `Не видалено (${d.status}):`, e.name, e.scheduled_start_time);
    if (d.status === 429) break;
    await sleep(1500);
  }

  const have = new Set(existing.map((e) => key(e.name, Date.parse(e.scheduled_start_time))));
  // вирівнюємо тривалість уже створених подій (щоб теж закінчувались через SHOW_MIN хв)
  for (const e of existing) {
    const start = Date.parse(e.scheduled_start_time);
    if (!wantedKeys.has(key(e.name, start)) || start < nowMs) continue;
    const wantEnd = start + SHOW_MIN * 60000;
    if (e.scheduled_end_time && Date.parse(e.scheduled_end_time) === wantEnd) continue;
    if (DRY) { console.log('[DRY] скоротив би', e.name); continue; }
    let u = await call(`${API}/guilds/${guild}/scheduled-events/${e.id}`, { method: 'PATCH', headers, body: JSON.stringify({ scheduled_end_time: new Date(wantEnd).toISOString() }) });
    if (u.status === 429) {
      const wait = Math.min(((await u.json().catch(() => ({}))).retry_after || 5) + 1, 30);
      await sleep(wait * 1000);
      u = await call(`${API}/guilds/${guild}/scheduled-events/${e.id}`, { method: 'PATCH', headers, body: JSON.stringify({ scheduled_end_time: new Date(wantEnd).toISOString() }) });
    }
    console.log(u.ok ? 'Скорочено:' : `Не скорочено (${u.status}):`, e.name);
    await sleep(1200);
  }
  for (const c of wanted) {
    if (have.has(key(c.name, c.time.toMillis()))) continue;
    const body = JSON.stringify({
      name: c.name,
      scheduled_start_time: c.time.toUTC().toISO(),
      scheduled_end_time: c.time.plus({ minutes: SHOW_MIN }).toUTC().toISO(),
      privacy_level: 2,
      entity_type: 3,
      entity_metadata: { location: c.location },
      description: c.description,
    });
    let r = await call(`${API}/guilds/${guild}/scheduled-events`, { method: 'POST', headers, body });
    if (r.status === 429 && !DRY) {
      const wait = Math.min(((await r.json().catch(() => ({}))).retry_after || 10) + 1, 30);
      console.log(`Ліміт Discord, чекаю ${wait} с`);
      await sleep(wait * 1000);
      r = await call(`${API}/guilds/${guild}/scheduled-events`, { method: 'POST', headers, body });
    }
    if (!r.ok) {
      console.warn('Подію не створено:', c.name, r.status, DRY ? '' : await r.text());
      if (r.status === 403 || r.status === 429) return console.warn('Зупиняю створення подій (права бота / ліміт)');
    } else {
      console.log('Створено подію:', c.name, c.time.toFormat('ccc dd.MM HH:mm'));
      if (!DRY) await sleep(2000);
    }
  }
}

const nm = await loadNotMeter();
await updateBoard(nm);
await syncEvents(nm);
