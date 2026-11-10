// Разово: #гайд-для-новачків — Soldier лише читає, вищі ролі (адміни) пишуть.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: H, body: b && JSON.stringify(b) }); const t = await r.text(); console.log(m, p.replace(/\d{10,}/g, (x) => '…' + x.slice(-4)), r.status, r.ok ? '' : t.slice(0, 160)); try { return JSON.parse(t); } catch { return t; } };
const roles = await call('GET', `/guilds/${guild}/roles`);
const soldier = roles.find((r) => r.name === 'Soldier').id;
const chans = await call('GET', `/guilds/${guild}/channels`);
const ch = chans.find((c) => c.name.includes('гайд'));
if (!ch) throw new Error('Канал не знайдено; наявні: ' + chans.map((c) => c.name).join(', '));
console.log('канал:', ch.name, ch.id, 'type', ch.type);
const B = (n) => 1n << BigInt(n);
const allow = B(10) | B(16);                                  // перегляд + історія
const deny = B(11) | B(6) | B(35) | B(36) | B(38);            // писати, реакції, гілки
await call('PUT', `/channels/${ch.id}/permissions/${soldier}`, { type: 0, allow: String(allow), deny: String(deny) });
await call('PUT', `/channels/${ch.id}/permissions/${guild}`, { type: 0, allow: '0', deny: String(B(10)) });
