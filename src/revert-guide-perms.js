// Разово: повертає права #гайди-на-новачків до стану до моєї зміни (за журналом аудиту, інакше — прибирає мої дозволи).
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const call = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: H, body: b && JSON.stringify(b) }); const t = await r.text(); console.log(m, p.replace(/\d{10,}/g, (x) => '…' + x.slice(-4)), r.status, r.ok ? '' : t.slice(0, 160)); try { return JSON.parse(t); } catch { return t; } };
const roles = await call('GET', `/guilds/${guild}/roles`);
const soldier = roles.find((r) => r.name === 'Soldier').id;
const chans = await call('GET', `/guilds/${guild}/channels`);
const ch = chans.find((c) => c.name.includes('гайд'));
console.log('зараз:', JSON.stringify(ch.permission_overwrites));
const log = await call('GET', `/guilds/${guild}/audit-logs?limit=50`);
const ent = Array.isArray(log.audit_log_entries) ? log.audit_log_entries.filter((e) => e.target_id === ch.id || (e.options && e.options.channel_id === ch.id)) : [];
console.log('записів аудиту про канал:', ent.length);
for (const e of ent.slice(0, 8)) console.log(e.action_type, JSON.stringify(e.options), JSON.stringify(e.changes));
// прибираємо дозвіл Soldier, який додав я (read-only)
await call('DELETE', `/channels/${ch.id}/permissions/${soldier}`);
