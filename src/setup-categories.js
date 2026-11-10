// Разово: три розділи — Ролі та сповіщення / Легіон / Учасники — і перенесення каналів, до яких бот має доступ.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const call = async (m, p, b) => {
  const r = await fetch(API + p, { method: m, headers: H, body: b && JSON.stringify(b) });
  const t = await r.text();
  console.log(m, p.replace(/\d{10,}/g, (x) => '…' + x.slice(-4)), r.status, r.ok ? '' : t.slice(0, 160));
  try { return JSON.parse(t); } catch { return t; }
};
const roles = await call('GET', `/guilds/${guild}/roles`);
const id = (n) => roles.find((r) => r.name === n).id;
const [member, soldier] = [id('Учасник'), id('Soldier')];
let chans = await call('GET', `/guilds/${guild}/channels`);
const VIEW = '1024';
const hide = [{ id: guild, type: 0, allow: '0', deny: VIEW }];
const cats = [
  ['🔔 Ролі та сповіщення', [...hide, { id: soldier, type: 0, allow: VIEW, deny: '0' }], ['вибір-сповіщень', 'сповіщення', 'івенти', 'світові-боси', 'abyss-боси', 'оновлення']],
  ['⚔️ Легіон', [...hide, { id: soldier, type: 0, allow: VIEW, deny: '0' }], ['загальний', 'Загальний #1', 'Загальний #2']],
  ['👥 Учасники', [...hide, { id: member, type: 0, allow: VIEW, deny: '0' }], ['чат-учасників']],
];
for (const [name, ow, members] of cats) {
  let cat = chans.find((c) => c.type === 4 && c.name === name);
  if (!cat) cat = await call('POST', `/guilds/${guild}/channels`, { name, type: 4, permission_overwrites: ow });
  for (const n of members) {
    const c = chans.find((x) => x.name === n && x.type !== 4);
    if (!c) { console.log('нема каналу', n); continue; }
    if (c.parent_id === cat.id) continue;
    await call('PATCH', `/channels/${c.id}`, { parent_id: cat.id, lock_permissions: false });
  }
}
