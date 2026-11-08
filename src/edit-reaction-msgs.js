// Разово: виправляє текст у двох повідомленнях про події в каналі вибору сповіщень.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const chans = await (await fetch(`${API}/guilds/${guild}/channels`, { headers: H })).json();
const ch = chans.find((c) => c.name === 'вибір-сповіщень');
if (!ch) throw new Error('Канал не знайдено');
const items = [
  ['1568703680549621761', '🎉 **Shugo Festival** (щогодини)', '🎉', 'Shugo Festival'],
  ['1568791189992382595', '🌀 **Spacetime Rift** (кожні 3 години)', '🌀', 'Spacetime Rift'],
];
for (const [id, title, em, name] of items) {
  const content = `${title}\nПостав реакцію, щоб отримувати пінги по цій події:\n\n${em} — ${name}`;
  const r = await fetch(`${API}/channels/${ch.id}/messages/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ content }) });
  console.log(id, r.status, r.ok ? 'OK' : await r.text());
}
