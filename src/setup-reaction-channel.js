// Разово: канал #вибір-босів + 3 повідомлення з реакціями (прив'язка реакцій до ролей — у Carl-bot).
import { CATEGORIES } from './bosses.js';
import { active } from './schedule.js';
import { NAMES } from './world-bosses.js';

const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, body) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(API + path, { method, headers: H, body: body && JSON.stringify(body) });
    if (r.status === 429) { await sleep(((await r.json()).retry_after || 2) * 1000 + 300); continue; }
    if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
  throw new Error('429 повтори вичерпано');
}
const EMOJI = ['🐺','🦅','🐻','🦂','🐍','🦇','🕷️','🐗','🦎','🐙','🦈','🐲','🔥','💀','⚔️','🛡️','🏹','🔮','👑','🌑','⭐','🌊','🍀','🪓'];
const chans = await call('GET', `/guilds/${guild}/channels`);
const ch = chans.find((c) => c.name === 'вибір-босів');
if (!ch) throw new Error('Канал #вибір-босів не знайдено');
console.log('Канал', ch.id);
const world = Object.values(NAMES);
const abyss = active(CATEGORIES.abyss).map((b) => b.name);
const groups = [
  ['🏰 **Artifact Siege** (чт/сб 21:00)', ['Artifact Siege'], ['🏰']],
];
for (const [title, names, em = EMOJI] of groups) {
  const lines = names.map((n, i) => `${em[i]} — ${n}`).join('\n');
  const msg = await call('POST', `/channels/${ch.id}/messages`, { content: `${title}\nПостав реакцію, щоб отримувати пінги по цьому босу:\n\n${lines}` });
  for (let i = 0; i < names.length; i++) { await call('PUT', `/channels/${ch.id}/messages/${msg.id}/reactions/${encodeURIComponent(em[i])}/@me`); await sleep(350); }
  console.log('MSG', msg.id, '|', names.map((n, i) => `${em[i]}=${n}`).join('; '));
}
