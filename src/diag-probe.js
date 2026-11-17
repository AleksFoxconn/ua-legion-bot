const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const H = { Authorization: `Bot ${token}` };
const ids = { івенти: '1568028450113986600', 'світові-боси': '1568389638215696504', 'abyss-боси': '1568389742435893249', сповіщення: '1568674334850031636', 'чат-легіону': '1568026035478335679', 'загальний-чат': '1569653911411888188', логи: '1568367793240408104', 'для-нас': '1568686239404793856' };
for (const [n, id] of Object.entries(ids)) {
  const r = await fetch(`https://discord.com/api/v10/channels/${id}`, { headers: H });
  const j = await r.json();
  console.log('PROBE', n, r.status, r.ok ? `name=${j.name} parent=${j.parent_id} ow=${(j.permission_overwrites || []).length}` : JSON.stringify(j).slice(0, 80));
}
const all = await (await fetch(`https://discord.com/api/v10/guilds/${guild}/channels`, { headers: H })).json();
console.log('PROBE всього каналів у списку:', all.length);
