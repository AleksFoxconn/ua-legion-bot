// Разово: канал #довідник (для Soldier) + мінімальні права бота Aion 2 Database лише там.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: H, body: b && JSON.stringify(b) }); const t = await r.text(); console.log('API', m, p.replace(/\d{10,}/g, (x) => '…' + x.slice(-4)), r.status, r.ok ? '' : t.slice(0, 200)); try { return JSON.parse(t); } catch { return t; } };
const roles = await call('GET', `/guilds/${guild}/roles`);
console.log('API ролі:', roles.map((r) => r.name).join(' | '));
const db = roles.find((r) => /aion 2 database/i.test(r.name));
if (!db) throw new Error('Бот ще не доданий (ролі Aion 2 Database немає)');
const soldier = roles.find((r) => r.name === 'Soldier').id;
const timer = roles.find((r) => r.name === 'UA Legion Timer').id;
const chans = await call('GET', `/guilds/${guild}/channels`);
const B = (n) => 1n << BigInt(n);
const VIEW = B(10), SEND = B(11), EMBED = B(14), ATTACH = B(15), HIST = B(16), APPCMD = B(31), REACT = B(6);
const botAllow = VIEW | SEND | EMBED | ATTACH | HIST | APPCMD;
const ow = [
  { id: guild, type: 0, allow: '0', deny: String(VIEW) },
  { id: soldier, type: 0, allow: String(VIEW | SEND | HIST | APPCMD | EMBED | REACT), deny: '0' },
  { id: timer, type: 0, allow: String(VIEW), deny: '0' },
  { id: db.id, type: 0, allow: String(botAllow), deny: '0' },
];
let ch = chans.find((c) => c.name === 'довідник');
if (!ch) {
  const cat = chans.find((c) => c.type === 4 && c.name.includes('Легіон'));
  ch = await call('POST', `/guilds/${guild}/channels`, { name: 'довідник', type: 0, parent_id: cat?.id, topic: 'Пошук предметів, умінь, квестів і рецептів: команди бота Aion 2 Database (/item, /skill, /recipe…)', permission_overwrites: ow });
} else for (const o of ow) await call('PUT', `/channels/${ch.id}/permissions/${o.id}`, { type: 0, allow: o.allow, deny: o.deny });
console.log('API готово:', ch.id);
