// Польові боси Verteron (Kasaka, EU) із відкритого кешу NotMeter (crowdsourced, неофіційні дані).
// Джерело: https://github.com/Not4You-Dev/NotMeter-Cache  ·  сайт: https://notmeter.com/?view=field-boss
// Один легкий запит на запуск. Вебхук: FIELD_WEBHOOK_URL (+ FIELD_BOARD_MESSAGE_ID для редагування).
import { line, updated } from './style.js';

const SRC =
  'https://raw.githubusercontent.com/Not4You-Dev/NotMeter-Cache/main/presence/notmeter-field-boss-public-ww-eu-expanded.json';
const SERVER_ID = Number(process.env.NOTMETER_SERVER_ID || 1315); // Kasaka
const MAP_ID = Number(process.env.NOTMETER_MAP_ID || 1010); // Verteron
const DRY = process.env.DRY_RUN === '1';

import { NAMES } from './world-bosses.js';

const res = await fetch(SRC, { headers: { 'User-Agent': 'ua-legion-boss-board (low-frequency)' } });
if (!res.ok) throw new Error(`NotMeter cache: ${res.status}`);
const data = await res.json();
const server = data.servers.find((s) => s.serverId === SERVER_ID);
const map = server?.maps.find((m) => m.mapId === MAP_ID);
if (!map) throw new Error('Немає даних для Kasaka/Verteron');

const nowMs = Date.now();
const rows = map.entries
  .map((e) => ({ name: NAMES[e.bossCode] || `#${e.bossCode}`, at: e.targetAt, spawned: !!e.spawned }))
  .sort((a, b) => Number(b.spawned) - Number(a.spawned) || a.at - b.at);

const up = rows.filter((r) => r.spawned || r.at <= nowMs).map((r) => `🟢 **${r.name}** — з'явився`);
const soon = rows.filter((r) => !r.spawned && r.at > nowMs).map((r) => line('⏳', r.name, r.at, nowMs));
const embed = {
  color: 0x2ecc71,
  title: '🌲 Світові боси — Verteron',
  description: [...up, ...soon].join('\n') + `\n\n${updated(nowMs)}`,
};
if (DRY) { console.log(JSON.stringify(embed, null, 1)); process.exit(0); }

const url = process.env.FIELD_WEBHOOK_URL;
if (!url) { console.log('Немає FIELD_WEBHOOK_URL'); process.exit(0); }
const body = JSON.stringify({ embeds: [embed] });
const headers = { 'Content-Type': 'application/json' };
const id = process.env.FIELD_BOARD_MESSAGE_ID;
if (id) {
  const r = await fetch(`${url}/messages/${id}`, { method: 'PATCH', headers, body });
  if (r.ok) { console.log('Табло оновлено'); process.exit(0); }
  console.warn('PATCH не вдався', r.status, '— створюю нове');
}
const r = await fetch(`${url}?wait=true`, { method: 'POST', headers, body });
if (!r.ok) throw new Error(`Вебхук: ${r.status}`);
console.log(`::notice::Створено табло. Додай секрет FIELD_BOARD_MESSAGE_ID=${(await r.json()).id}`);
