// Разово: діагностика — хто такий новий користувач і що в #нові-учасники.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}` };
const get = async (p) => { const r = await fetch(API + p, { headers: H }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const roles = await get(`/guilds/${guild}/roles`);
const rn = Object.fromEntries(roles.map((r) => [r.id, r.name]));
const found = await get(`/guilds/${guild}/members/search?query=oleksandr_56468&limit=5`);
console.log('--- УЧАСНИК ---');
console.log(JSON.stringify(Array.isArray(found) ? found.map((m) => ({ user: m.user.username, id: m.user.id, joined: m.joined_at, roles: m.roles.map((i) => rn[i]), pending: m.pending })) : found));
const chans = await get(`/guilds/${guild}/channels`);
const ch = chans.find((c) => c.name === 'нові-учасники');
console.log('--- КАНАЛ ---', ch && ch.id, ch && ch.type);
const msgs = await get(`/channels/${ch.id}/messages?limit=15`);
console.log('--- ОСТАННІ ПОВІДОМЛЕННЯ ---');
if (Array.isArray(msgs)) for (const m of msgs.reverse()) console.log(m.timestamp, m.author.username, `[type ${m.type}]`, (m.content || (m.embeds[0] && (m.embeds[0].title || m.embeds[0].description)) || '').slice(0, 120));
else console.log(JSON.stringify(msgs));
