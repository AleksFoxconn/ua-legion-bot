// Разово: #загальний і голосові — лише для Soldier; новий текстовий канал для Учасник.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const call = async (m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: H, body: b && JSON.stringify(b) });
  const t = await r.text();
  console.log(m, p.replace(/\d{10,}/g, (x) => '…' + x.slice(-4)), r.status, r.ok ? '' : t.slice(0, 200));
  try { return JSON.parse(t); } catch { return t; }
};
const roles = await call('GET', `/guilds/${guild}/roles`);
const id = (n) => roles.find((r) => r.name === n).id;
const [member, soldier, everyone] = [id('Учасник'), id('Soldier'), guild];
const chans = await call('GET', `/guilds/${guild}/channels`);
const VIEW = 1024n, CONNECT = 1n << 20n;
// 1) #загальний і голосові: Soldier замість Учасник
for (const c of chans.filter((x) => (x.type === 0 && x.name === 'загальний') || x.type === 2)) {
  const ow = c.permission_overwrites.find((o) => o.id === member);
  const allow = ow ? ow.allow : String(c.type === 2 ? VIEW | CONNECT : VIEW);
  await call('PUT', `/channels/${c.id}/permissions/${soldier}`, { type: 0, allow, deny: '0' });
  if (ow) await call('DELETE', `/channels/${c.id}/permissions/${member}`);
}
// 2) новий текстовий канал для Учасник (якщо ще немає)
const name = 'чат-учасників';
if (!chans.find((x) => x.name === name)) {
  const cat = chans.find((x) => x.type === 4 && x.name === 'Текстові канали');
  await call('POST', `/guilds/${guild}/channels`, {
    name, type: 0, parent_id: cat?.id, topic: 'Загальний чат для всіх учасників сервера',
    permission_overwrites: [
      { id: everyone, type: 0, allow: '0', deny: String(VIEW) },
      { id: member, type: 0, allow: String(VIEW), deny: '0' },
    ],
  });
} else console.log('канал вже є');
