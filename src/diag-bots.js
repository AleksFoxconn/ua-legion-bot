// Разово: які боти є серед учасників сервера.
const { DISCORD_TOKEN: token, GUILD_ID: guild } = process.env;
const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/members?limit=1000`, { headers: { Authorization: `Bot ${token}` } });
const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
if (!Array.isArray(j)) console.log('ERR', r.status, String(t).slice(0, 200));
else for (const m of j.filter((m) => m.user.bot)) console.log('BOT', m.user.username, m.user.id, m.roles.join(','));
