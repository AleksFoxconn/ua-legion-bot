// Разово: що є у форумі гайдів (теги, гілки).
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10'; const H = { Authorization: `Bot ${token}` };
const g = async (p) => { const r = await fetch(API + p, { headers: H }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const chans = await g(`/guilds/${guild}/channels`);
const f = chans.find((c) => c.name.includes('гайди'));
console.log('API forum', f && f.id, f && f.type, JSON.stringify((f && f.available_tags || []).map((t) => t.name)), 'guideline:', (f && f.topic || '').slice(0, 200));
const act = await g(`/guilds/${guild}/threads/active`);
for (const t of (act.threads || []).filter((t) => t.parent_id === f.id)) console.log('API thread', t.id, t.name, 'msgs', t.message_count);
const arch = await g(`/channels/${f.id}/threads/archived/public?limit=50`);
for (const t of (arch.threads || [])) console.log('API archived', t.id, t.name);
