// Разово: діагностика реакцій і ієрархії ролей (нічого не змінює).
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}` };
const get = async (p) => (await fetch(API + p, { headers: H })).json();
const roles = (await get(`/guilds/${guild}/roles`)).sort((a, b) => b.position - a.position);
console.log('--- РОЛІ (зверху вниз) ---');
for (const r of roles) console.log(String(r.position).padStart(3), r.managed ? '[bot]' : '     ', r.name);
const chans = await get(`/guilds/${guild}/channels`);
const ch = chans.find((c) => c.name === 'вибір-сповіщень');
const msgs = await get(`/channels/${ch.id}/messages?limit=50`);
console.log('--- ПОВІДОМЛЕННЯ ---');
for (const m of msgs.reverse()) {
  const rx = (m.reactions || []).map((x) => `${x.emoji.name}×${x.count}${x.me ? '(bot)' : ''}`).join(' ');
  console.log(m.id, m.author.username, '|', m.content.split('\n')[0].slice(0, 50), '|', rx || 'БЕЗ РЕАКЦІЙ');
}
