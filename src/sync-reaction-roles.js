// Страховка для Carl-bot: звіряє реакції в #вибір-сповіщень з ролями і видає ті, що не видались.
// Роль для рядка "емодзі — Назва" — це "🔔 Назва". Нічого не забирає.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(API + path, { headers: H, ...opts });
    if (r.status === 429) { await sleep(((await r.json()).retry_after || 1) * 1000 + 100); continue; }
    return r;
  }
  throw new Error('rate limited: ' + path);
}
const me = await (await api('/users/@me')).json();
const roles = await (await api(`/guilds/${guild}/roles`)).json();
const roleByName = new Map(roles.map((r) => [r.name, r.id]));
const chans = await (await api(`/guilds/${guild}/channels`)).json();
const ch = chans.find((c) => c.name === 'вибір-сповіщень');
if (!ch) throw new Error('Канал не знайдено');
const msgs = await (await api(`/channels/${ch.id}/messages?limit=50`)).json();
let fixed = 0, failed = 0, checked = 0;
for (const m of msgs) {
  if (m.author.id !== me.id) continue;
  const map = new Map();
  for (const line of m.content.split('\n')) {
    const x = line.match(/^(\S+) — (.+)$/);
    if (x) map.set(x[1].replace(/️/g, ''), x[2].trim());
  }
  for (const rx of m.reactions || []) {
    const key = rx.emoji.name.replace(/️/g, '');
    const name = map.get(key);
    const roleId = name && roleByName.get(`🔔 ${name}`);
    if (!roleId) continue;
    let after = '';
    for (;;) {
      const r = await api(`/channels/${ch.id}/messages/${m.id}/reactions/${encodeURIComponent(rx.emoji.name)}?limit=100${after}`);
      const users = await r.json();
      if (!Array.isArray(users) || !users.length) break;
      for (const u of users) {
        if (u.bot) continue;
        const mem = await (await api(`/guilds/${guild}/members/${u.id}`)).json();
        if (!mem.roles) continue; // вийшов із сервера
        checked++;
        if (mem.roles.includes(roleId)) continue;
        const p = await api(`/guilds/${guild}/members/${u.id}/roles/${roleId}`, { method: 'PUT', headers: { ...H, 'X-Audit-Log-Reason': encodeURIComponent('reaction role sync') } });
        if (p.ok || p.status === 204) { fixed++; console.log(`ВИДАНО 🔔 ${name} → ${u.username}`); }
        else { failed++; console.log(`НЕ ВИЙШЛО 🔔 ${name} → ${u.username}: ${p.status} ${await p.text()}`); }
      }
      if (users.length < 100) break;
      after = `&after=${users[users.length - 1].id}`;
    }
  }
}
console.log(`Перевірено: ${checked}, видано: ${fixed}, помилок: ${failed}`);
if (failed) process.exit(1);
