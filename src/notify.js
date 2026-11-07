// Сповіщення «бос з'явиться через ~10–15 хв» з пінгом ролі конкретного боса (вибір ролей — Onboarding/Carl-bot).
// Запускається часто (кожні ~5 хв, зовнішній cron → workflow_dispatch). Повідомлення йде у канал через вебхук.
// Секрети: NOTIFY_WEBHOOK_URL, DISCORD_TOKEN (для ролей), GUILD_ID. Стан: .cache/notify/state.json (кеш Actions).
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import { CATEGORIES } from './bosses.js';
import { active, spawnsBetween } from './schedule.js';
import { EVENTS, nextOccurrences } from './events.js';
import { NAMES } from './world-bosses.js';
import { PAIRS, RIFT_MAP_ID, OUR_MAP_ID, MIN_GAP_MIN, MAX_GAP_MIN, WINDOW_MIN } from './rift-bosses.js';

const env = process.env;
const RIFT_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
const SHUGO = 'Shugo Festival';
const SIEGE_ROLE = env.SIEGE_ROLE || 'Soldier'; // на Artifact Siege пінгуємо всіх з цією роллю
const RIFT_LEAD_MIN = Number(env.RIFT_LEAD_MIN || 15);
const TZ = env.SERVER_TZ || 'Europe/Warsaw';
const DRY = env.DRY_RUN === '1';
const API = 'https://discord.com/api/v10';
const STATE_FILE = env.STATE_FILE || '.cache/notify/state.json';
const MIN_BEFORE = Number(env.NOTIFY_MIN || 2); // не пінгуємо, якщо лишилось менше (вже пізно)
const MAX_BEFORE = Number(env.NOTIFY_MAX || 15); // і не раніше ніж за стільки хвилин
const NOTMETER = env.NOTMETER_URL ||
  'https://raw.githubusercontent.com/Not4You-Dev/NotMeter-Cache/main/presence/notmeter-field-boss-public-ww-eu-expanded.json';
const sec = (ms) => Math.floor(ms / 1000);
const roleName = (boss) => `🔔 ${boss}`;

const now = (env.FAKE_NOW ? DateTime.fromISO(env.FAKE_NOW, { zone: TZ }) : DateTime.now().setZone(TZ));
const nowMs = now.toMillis();

/** Усі «відстежувані» боси: { key, name, time(ms), where } у вікні [now+MIN, now+MAX]. */
async function dueBosses() {
  const from = now.plus({ minutes: MIN_BEFORE });
  const to = now.plus({ minutes: MAX_BEFORE });
  const out = [];
  // Abyss (за розкладом), включно з Watcher Kaira
  for (const boss of active(CATEGORIES.abyss)) {
    for (const t of spawnsBetween(boss, from, to, TZ)) out.push({ key: `${boss.id}|${t.toMillis()}`, name: boss.name, time: t.toMillis(), where: boss.zone });
  }
  // Івенти з окремими ролями: Shugo Festival (щогодини), Artifact Siege (чт/сб)
  for (const [id, where] of [['shugo', 'Verteron / Altgard'], ['siege', 'Chaotic Lower Reshanta']]) {
    const ev = EVENTS.find((e) => e.id === id);
    for (const t of nextOccurrences(ev, from.minus({ minutes: 1 }), TZ, 3)) {
      if (t > to) break;
      out.push({ key: `${id}|${t.toMillis()}`, name: ev.name, time: t.toMillis(), where, shugo: true, emoji: ev.emoji, ...(id === 'siege' ? { role: SIEGE_ROLE } : {}) });
    }
  }
  // Нагадування у вівторок о 12:00 (серверний час): завтра тижневий ресет, роль Soldier
  if (now.weekday === 2 && now.hour === 12 && now.minute < 15) {
    const reset = nextOccurrences(EVENTS.find((e) => e.id === 'weekly-reset'), now, TZ, 1)[0];
    if (reset) out.push({ key: `weekly-remind|${now.toISODate()}`, name: 'Тижневий ресет', time: reset.toMillis(), where: '', weekly: true, role: SIEGE_ROLE });
  }
  // світові боси Verteron (NotMeter)
  try {
    const r = await fetch(NOTMETER);
    if (!r.ok) throw new Error(`NotMeter ${r.status}`);
    const data = await r.json();
    const srv = (data.servers || []).find((s) => s.serverId === 1315);
    const map = (srv?.maps || []).find((m) => m.mapId === 1010);
    for (const e of map?.entries || []) {
      if (e.spawned || e.targetAt < from.toMillis() || e.targetAt > to.toMillis()) continue;
      const name = NAMES[e.bossCode] || `#${e.bossCode}`;
      const t = Math.floor(e.targetAt / 60000) * 60000;
      out.push({ key: `w${e.bossCode}|${t}`, name, time: t, where: 'Verteron' });
    }
    out.push(...riftOpportunities(srv));
  } catch (e) {
    console.warn('NotMeter недоступний:', e.message);
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Бос у ріфт-світі (Altgard) раніше за свого двійника у Verteron більш ніж на MIN_GAP_MIN → «спершу в ріфті, потім у нас». */
function riftOpportunities(srv) {
  const out = [];
  const maps = srv?.maps || [];
  const rift = (maps.find((m) => m.mapId === RIFT_MAP_ID)?.entries) || [];
  const ours = (maps.find((m) => m.mapId === OUR_MAP_ID)?.entries) || [];
  for (const p of PAIRS) {
    const r = rift.find((e) => e.bossCode === p.rift);
    const o = ours.find((e) => e.bossCode === p.ours);
    if (!r || !o || r.spawned || o.spawned) continue;
    const gap = (o.targetAt - r.targetAt) / 60000;
    if (gap <= MIN_GAP_MIN || gap >= MAX_GAP_MIN) continue; // пишемо лише коли різниця 5–30 хв
    // ріфт, у вікно якого потрапляє поява
    let open = null;
    const base = DateTime.fromMillis(r.targetAt, { zone: TZ }).startOf('day');
    for (const d of [-1, 0]) for (const h of RIFT_HOURS) {
      const c = base.plus({ days: d }).set({ hour: h }).toMillis();
      if (c <= r.targetAt && r.targetAt <= c + WINDOW_MIN * 60000) open = c;
    }
    if (open == null) continue;
    if (nowMs < open - RIFT_LEAD_MIN * 60000 || nowMs > r.targetAt) continue;
    const t = Math.floor(r.targetAt / 60000) * 60000;
    const oursT = Math.floor(o.targetAt / 60000) * 60000;
    out.push({ key: `rift${p.rift}|${t}`, name: p.name, time: t, where: `у ріфті (Altgard) о <t:${sec(t)}:t>, а в нашому світі (Verteron) о <t:${sec(oursT)}:t> (<t:${sec(oursT)}:R>)`, rift: true });
  }
  return out;
}

/** Усі імена босів, для яких мають існувати ролі. */
export const allBossNames = () => [...new Set([...active(CATEGORIES.abyss).map((b) => b.name), ...Object.values(NAMES)])];
export const allRoleNames = () => [...allBossNames().map(roleName), roleName(SHUGO)];

async function discord(method, url, body) {
  const r = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}

/** Знаходить/створює ролі «🔔 Boss». Повертає Map(name → id). */
async function ensureRoles(names, create) {
  const map = new Map();
  if (!env.DISCORD_TOKEN || !env.GUILD_ID) return map;
  const r = await discord('GET', `/guilds/${env.GUILD_ID}/roles`);
  if (!r.ok) { console.warn('Ролі недоступні:', r.status); return map; }
  const roles = await r.json();
  for (const role of roles) map.set(role.name, role.id);
  if (!create) return map;
  for (const n of names) {
    if (map.has(n)) continue;
    if (DRY) { console.log('[DRY] створив би роль', roleName(n)); continue; }
    let c = await discord('POST', `/guilds/${env.GUILD_ID}/roles`, { name: n, mentionable: true, permissions: '0' });
    if (c.status === 429) {
      const wait = ((await c.json()).retry_after || 3) * 1000 + 500;
      await new Promise((x) => setTimeout(x, wait));
      c = await discord('POST', `/guilds/${env.GUILD_ID}/roles`, { name: n, mentionable: true, permissions: '0' });
    }
    if (!c.ok) { console.warn('Роль не створено:', n, c.status, await c.text()); if (c.status === 403) break; continue; }
    map.set(n, (await c.json()).id);
    console.log('Створено роль', n);
    await new Promise((x) => setTimeout(x, 800));
  }
  return map;
}

/** Видаляє повідомлення, час появи яких уже настав. */
async function cleanup(st, url) {
  st.msgs = st.msgs || [];
  const keep = [];
  for (const m of st.msgs) {
    if (m.time > nowMs) { keep.push(m); continue; }
    if (DRY) { console.log('[DRY] видалив би повідомлення', m.id); continue; }
    const r = await fetch(`${url}/messages/${m.id}`, { method: 'DELETE' });
    if (r.ok || r.status === 404) console.log('Видалено повідомлення', m.id);
    else { console.warn('Не видалено', m.id, r.status); if (nowMs - m.time < 3600e3) keep.push(m); }
  }
  st.msgs = keep;
}

function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return { sent: {} }; } }
function saveState(st) {
  for (const k of Object.keys(st.sent)) if (st.sent[k] < nowMs - 6 * 3600e3) delete st.sent[k];
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(st));
}

async function main() {
  const url = env.NOTIFY_WEBHOOK_URL;
  if (!url && !DRY) return console.log('Немає NOTIFY_WEBHOOK_URL: сповіщення пропущено');
  const roles = await ensureRoles(allRoleNames(), env.ENSURE_ROLES !== '0');
  const st = loadState();
  if (url) await cleanup(st, url);
  const due = (await dueBosses()).filter((b) => !st.sent[b.key]);
  if (!due.length) { saveState(st); return console.log('Нових сповіщень немає'); }

  // боси з однаковим часом — в одне повідомлення
  const groups = new Map();
  for (const b of due) { const gk = b.rift ? `r${b.key}` : b.time; if (!groups.has(gk)) groups.set(gk, []); groups.get(gk).push(b); }
  for (const [, list] of groups) {
    const s = sec(list[0].time);
    const pings = list.map((b) => roles.get(b.role || roleName(b.name))).filter(Boolean);
    const names = list.map((b) => `**${b.name}**`).join(', ');
    const head = list[0].rift ? '🌀 Можна встигнути вбити і в ріфті, і в нашому світі:' : list[0].shugo ? list[0].emoji : '🔔';
    const content = list[0].weekly ? `${pings.map((id) => `<@&${id}>`).join(' ')}\n⏰ **Завтра тижневий ресет сервера** (<t:${s}:f>, <t:${s}:R>)!\nНе забудьте витратити всі квитки й ліміти в тижневих подіях.` : list[0].rift ? `${pings.map((id) => `<@&${id}>`).join(' ')}\n${head} ${names} — ${list[0].where}` : `${pings.map((id) => `<@&${id}>`).join(' ')}\n${head} ${names} — <t:${s}:R> (<t:${s}:t>) · ${list[0].where}`.trim();
    const body = { content, allowed_mentions: { roles: pings } };
    if (DRY) console.log('[DRY]', JSON.stringify(body));
    else {
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}wait=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { console.warn('Вебхук:', r.status, await r.text()); continue; }
      try { st.msgs.push({ id: (await r.json()).id, time: list[0].time }); } catch {}
    }
    for (const b of list) st.sent[b.key] = nowMs;
    console.log('Сповіщення:', names);
    await new Promise((x) => setTimeout(x, 700));
  }
  saveState(st);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
