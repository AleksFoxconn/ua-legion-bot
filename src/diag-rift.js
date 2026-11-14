// Разово: що NotMeter показує для ріфт-світу (Altgard) на Kasaka.
const URL = 'https://raw.githubusercontent.com/Not4You-Dev/NotMeter-Cache/main/presence/notmeter-field-boss-public-ww-eu-expanded.json';
const d = await (await fetch(URL)).json();
console.log('ключі верхнього рівня:', Object.keys(d).join(', '), '· оновлено:', d.updatedAt || d.generatedAt || '?');
const srv = d.servers.find((s) => s.serverId === 1315);
console.log('сервер:', srv.serverId, srv.name || srv.serverName || '', '· мапи:', srv.maps.map((m) => `${m.mapId}${m.name ? '(' + m.name + ')' : ''}:${(m.entries || []).length}`).join(' '));
const fmt = (ms) => new Date(ms).toLocaleString('uk-UA', { timeZone: 'Europe/Warsaw', hour12: false });
const pairs = { 2400800: 'Gartua(rift)', 2400853: 'Dartan(rift?)', 2400854: 'Kashapa(rift?)', 2400855: 'Lagta(rift?)', 2101074: 'Gartua(our)', 2101120: 'Dartan(our)', 2101122: 'Kashapa(our)', 2101131: 'Lagta(our)' };
for (const m of srv.maps) {
  if (![1010, 1110].includes(m.mapId)) continue;
  console.log(`--- мапа ${m.mapId} ---`);
  for (const e of m.entries.sort((a, b) => a.targetAt - b.targetAt)) console.log(e.bossCode, pairs[e.bossCode] || '', fmt(e.targetAt), 'spawned=' + !!e.spawned, JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['bossCode', 'targetAt', 'spawned'].includes(k)))).slice(0, 120));
}
