// Разове налаштування Onboarding: два питання з ролями босів («🔔 Boss»), без втрати наявних питань/каналів.
// Режим: APPLY=1 — застосувати; інакше лише показує, що буде зроблено.
import { CATEGORIES } from './bosses.js';
import { active } from './schedule.js';
import { NAMES } from './world-bosses.js';

const { DISCORD_TOKEN: token, GUILD_ID: guild, APPLY } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
if (!token || !guild) throw new Error('Немає DISCORD_TOKEN/GUILD_ID');

const rolesRes = await fetch(`${API}/guilds/${guild}/roles`, { headers: H });
if (!rolesRes.ok) throw new Error(`Ролі: ${rolesRes.status}`);
const roleId = new Map((await rolesRes.json()).map((r) => [r.name, r.id]));

const obRes = await fetch(`${API}/guilds/${guild}/onboarding`, { headers: H });
if (!obRes.ok) throw new Error(`Onboarding GET: ${obRes.status} ${await obRes.text()}`);
const ob = await obRes.json();
console.log('Поточний Onboarding: питань', ob.prompts?.length, '· каналів за замовчуванням', ob.default_channel_ids?.length, '· увімкнено', ob.enabled);
for (const p of ob.prompts || []) console.log(' -', p.title, `(${p.options?.length} відповідей)`);

let seq = 0n;
const sf = () => String(((BigInt(Date.now()) - 1420070400000n) << 22n) + (seq++));
const mkOptions = (names, where) => names.filter((n) => roleId.has(`🔔 ${n}`)).map((n) => ({
  id: sf(), title: n.slice(0, 50), description: where, role_ids: [roleId.get(`🔔 ${n}`)], channel_ids: [], emoji_name: '🔔',
}));
const TITLE_W = '🌲 Світові боси (Verteron) · 1/2: за ким стежити?';
const TITLE_W2 = '🌲 Світові боси (Verteron) · 2/2: за ким стежити?';
const TITLE_A = '🌀 Abyss-боси (Chaotic Lower Reshanta): за ким стежити?';
const world = mkOptions(Object.values(NAMES), 'Світовий бос · Verteron');
const abyss = mkOptions(active(CATEGORIES.abyss).map((b) => b.name), 'Abyss · Chaotic Lower Reshanta');
const TITLE_E = '🎉 Події: за чим стежити?';
const eventOpts = ['Shugo Festival'].filter((n) => roleId.has(`🔔 ${n}`)).map((n) => ({ id: sf(), title: n, description: 'Щогодини, Verteron/Altgard', role_ids: [roleId.get(`🔔 ${n}`)], channel_ids: [], emoji_name: '🎉' }));
const mk = (title, options) => ({ id: sf(), type: 0, title, single_select: false, required: false, in_onboarding: true, options });
const keep = (ob.prompts || []).filter((p) => p.title !== TITLE_W && p.title !== TITLE_W2 && p.title !== TITLE_E && p.title !== TITLE_A)
  .map((p) => ({ ...p, options: p.options.map((o) => ({ ...o, emoji_name: o.emoji?.name ?? o.emoji_name, emoji_id: o.emoji?.id ?? o.emoji_id })) }));
const prompts = [...keep, mk(TITLE_W, world.slice(0, 12)), mk(TITLE_W2, world.slice(12)), mk(TITLE_A, abyss), mk(TITLE_E, eventOpts)];
console.log(`Буде: ${keep.length} наявних + світові (${world.length}) + Abyss (${abyss.length})`);

if (APPLY !== '1') { console.log('Пробний режим, нічого не змінено (APPLY=1 для застосування)'); process.exit(0); }
const put = await fetch(`${API}/guilds/${guild}/onboarding`, {
  method: 'PUT', headers: H,
  body: JSON.stringify({ prompts, default_channel_ids: ob.default_channel_ids, enabled: ob.enabled, mode: ob.mode }),
});
console.log('PUT:', put.status, put.ok ? 'OK' : await put.text());
if (!put.ok) process.exit(1);
