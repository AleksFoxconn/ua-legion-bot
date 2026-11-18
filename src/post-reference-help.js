// Разово: публікує в #довідник підказку по командах бота Aion 2 Database.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const API = 'https://discord.com/api/v10';
const H = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
const chans = await (await fetch(`${API}/guilds/${guild}/channels`, { headers: H })).json();
const ch = chans.find((c) => c.name === 'довідник');
if (!ch) throw new Error('Каналу #довідник нема');
const description = [
  'Пиши команди бота **Aion 2 Database** прямо тут: введи `/` і обери команду. Назву шукай англійською (як у грі), підказки з\'являться самі.',
  '',
  '**🔎 Пошук у базі**',
  '`/item` — предмет · `/itemset` — комплект предметів',
  '`/armor` — броня · `/accessory` — аксесуар',
  '`/skill` — вміння · `/title` — титул · `/achievement` — досягнення',
  '`/quest` — квест · `/recipe` — рецепт крафту',
  '`/npc` — NPC або монстр · `/pet` — улюбленець чи маунт',
  '`/dungeon` — підземелля',
  '',
  '**⏱ Події та боси**',
  '`/boss` — таймер появи світового боса й позначка на мапі',
  '`/events` — найближчі івенти, розломи та боси з відліком',
  '',
  '**🗺 Мапа й інструменти**',
  '`/map` — інтерактивна мапа',
  '`/database` — відкрити базу даних',
  '`/tools` — калькулятори, планувальники й трекери',
  '',
  '**ℹ️ Інше**',
  '`/help` — повний список команд бота',
  '',
  'Усі відповіді бота англійською: назви предметів і вмінь шукай так, як вони називаються в грі.',
].join('\n');
const r = await fetch(`${API}/channels/${ch.id}/messages`, { method: 'POST', headers: H, body: JSON.stringify({ embeds: [{ title: '📚 Довідник Aion 2: які команди є', description, color: 0x5865f2 }] }) });
console.log('API post', r.status, (await r.text()).slice(0, 150));
if (!r.ok) process.exit(1);
