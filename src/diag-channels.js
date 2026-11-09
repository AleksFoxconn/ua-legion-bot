// Разово: список каналів із правами (нічого не змінює).
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}` };
const get = async (p) => (await fetch(API + p, { headers: H })).json();
const roles = await get(`/guilds/${guild}/roles`);
const rn = Object.fromEntries(roles.map((r) => [r.id, r.name]));
const VIEW = 1n << 10n, ADMIN = 1n << 3n, MANAGE_CH = 1n << 4n, MANAGE_ROLES = 1n << 28n;
console.log('--- РОЛІ З ПРАВАМИ ---');
for (const r of roles.sort((a, b) => b.position - a.position)) {
  if (r.name.startsWith('🔔')) continue;
  const p = BigInt(r.permissions);
  console.log(r.position, r.name, 'admin=' + !!(p & ADMIN), 'view=' + !!(p & VIEW), 'manageCh=' + !!(p & MANAGE_CH), 'manageRoles=' + !!(p & MANAGE_ROLES));
}
const chans = (await get(`/guilds/${guild}/channels`)).sort((a, b) => a.position - b.position);
const cat = Object.fromEntries(chans.filter((c) => c.type === 4).map((c) => [c.id, c.name]));
console.log('--- КАНАЛИ ---');
for (const c of chans) {
  const ow = (c.permission_overwrites || []).map((o) => `${o.type === 0 ? rn[o.id] || o.id : 'user:' + o.id}[allow=${o.allow},deny=${o.deny}]`).join(' ; ');
  console.log(`${c.id} type=${c.type} cat=${cat[c.parent_id] || '-'} #${c.name} | ${ow || 'без особливих прав'}`);
}
