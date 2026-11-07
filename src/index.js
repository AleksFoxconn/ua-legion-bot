import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, EmbedBuilder, GatewayIntentBits } from 'discord.js';
import { DateTime } from 'luxon';
import { CATEGORIES } from './bosses.js';
import { active, nextPerBoss, upcoming } from './schedule.js';

const TOKEN = process.env.DISCORD_TOKEN;
const TZ = process.env.SERVER_TZ;
const REMIND_MS = Number(process.env.REMIND_MINUTES || 10) * 60_000;
const TICK_MS = 30_000;
const GRACE_MS = 2 * 60_000; // скільки після спавну ще вважаємо «щойно»

if (!TZ) {
  console.error('Не задано SERVER_TZ (Europe/Berlin або Asia/Seoul). Дивись README: «Яка у Kasaka серверна година».');
  process.exit(1);
}
if (!TOKEN) {
  console.error('Немає DISCORD_TOKEN. Скопіюй .env.example у .env і заповни.');
  process.exit(1);
}

// ---- маленький стан на диску (щоб після перезапуску не дублювати пости) ----
const STATE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'state.json');
fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
let state = { sent: {}, boards: {} };
try {
  state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
} catch {}
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const ts = (dt) => Math.floor(dt.toMillis() / 1000);
const nameList = (bosses) => bosses.map((b) => `**${b.name}** (${b.zone}, ${b.level} lvl)`).join('\n');

async function getChannel(client, category) {
  const id = process.env[category.channelEnv];
  if (!id) return null;
  try {
    return await client.channels.fetch(id);
  } catch (e) {
    console.warn(`[${category.id}] не бачу канал ${id}: ${e.message}`);
    return null;
  }
}

async function postAlerts(client, category, now) {
  const channel = await getChannel(client, category);
  if (!channel) return;
  const roleId = process.env[category.roleEnv];
  const ping = roleId ? `<@&${roleId}> ` : '';

  const events = upcoming(category, now.minus({ milliseconds: GRACE_MS }), TZ, REMIND_MS + GRACE_MS);
  for (const ev of events) {
    const diff = ev.time.toMillis() - now.toMillis();
    const base = `${category.id}:${ev.time.toMillis()}`;

    if (diff > 0 && diff <= REMIND_MS && !state.sent[`${base}:remind`]) {
      state.sent[`${base}:remind`] = Date.now();
      await channel.send({
        content: `${ping}${category.emoji} Спавн <t:${ts(ev.time)}:R> (<t:${ts(ev.time)}:t>)`,
        embeds: [new EmbedBuilder().setColor(0xf1c40f).setDescription(nameList(ev.bosses))],
        allowedMentions: { roles: roleId ? [roleId] : [] },
      });
    } else if (diff <= 0 && diff > -GRACE_MS && !state.sent[`${base}:spawn`]) {
      state.sent[`${base}:spawn`] = Date.now();
      await channel.send({
        content: `${ping}${category.emoji} **Зараз з'являються!**`,
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription(nameList(ev.bosses))],
        allowedMentions: { roles: roleId ? [roleId] : [] },
      });
    }
  }
}

// Одне повідомлення-«дошка», яке бот редагує (не спамить новими)
async function updateBoard(client, category, now) {
  const channel = await getChannel(client, category);
  if (!channel) return;

  const rows = nextPerBoss(category, now, TZ).map(
    ({ boss, time }) => `<t:${ts(time)}:R> · <t:${ts(time)}:f> — **${boss.name}** _(${boss.zone})_`,
  );
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`${category.emoji} ${category.title}: найближчі спавни`)
    .setDescription(rows.join('\n') || 'Немає даних')
    .setFooter({ text: `Серверний час: ${TZ} · оновлюється автоматично` });

  const boardId = state.boards[category.id];
  if (boardId) {
    try {
      const msg = await channel.messages.fetch(boardId);
      await msg.edit({ embeds: [embed] });
      return;
    } catch {
      // повідомлення видалили — створимо нове
    }
  }
  const msg = await channel.send({ embeds: [embed] });
  state.boards[category.id] = msg.id;
  await msg.pin().catch(() => {});
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastBoard = 0;

async function tick() {
  const now = DateTime.now().setZone(TZ);
  for (const category of Object.values(CATEGORIES)) {
    if (category.kind !== 'scheduled' || !active(category).length) continue; // field — заготовка
    try {
      await postAlerts(client, category, now);
      if (Date.now() - lastBoard > 5 * 60_000) await updateBoard(client, category, now);
    } catch (e) {
      console.error(`[${category.id}]`, e);
    }
  }
  if (Date.now() - lastBoard > 5 * 60_000) lastBoard = Date.now();

  // чистимо старі записи (>2 діб)
  const cutoff = Date.now() - 2 * 24 * 3600_000;
  for (const [k, v] of Object.entries(state.sent)) if (v < cutoff) delete state.sent[k];
  saveState();
}

client.once('ready', () => {
  console.log(`Бот запущено як ${client.user.tag}, серверний час: ${TZ}`);
  tick();
  setInterval(tick, TICK_MS);
});

client.login(TOKEN);
