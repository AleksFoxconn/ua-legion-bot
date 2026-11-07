// Порівняння босів «ріфт-світу» (мапа іншої фракції, куди веде Spacetime Rift) з босами нашого світу.
// Ідея: якщо бос у ріфт-світі з'являється раніше за свого «двійника» у нашому світі більш ніж на MIN_GAP_MIN,
// то можна вбити його спочатку там, а потім у нашому світі.
//
// TODO (доробити пізніше):
//  1) Перевірити, що RIFT_MAP_ID справді є мапою ріфт-світу (зараз припущення: 1110 у даних NotMeter).
//  2) Заповнити PAIRS: які боси ріфт-світу відповідають босам нашого світу (bossCode з NotMeter).
//  3) Додати назви босів і вивести їх у табло (зараз навмисно пишемо лише факт можливості).
const env = process.env;

export const SERVER_ID = Number(env.SERVER_ID || 1315); // Kasaka (EU)
export const OUR_MAP_ID = Number(env.OUR_MAP_ID || 1010); // Verteron
export const RIFT_MAP_ID = Number(env.RIFT_MAP_ID || 1110); // припущення, див. TODO
export const MIN_GAP_MIN = Number(env.RIFT_MIN_GAP_MIN || 10);
export const WINDOW_MIN = Number(env.RIFT_WINDOW_MIN || 60); // скільки триває перебування у ріфт-світі

/** Пари босів: { rift: bossCode у ріфт-мапі, ours: bossCode у нашій мапі, name?: 'для логів' } */
export const PAIRS = [
  // Підтверджено: Eternal Gartua (Verteron, 2101074) ↔ Immortal Gartua (Altgard, 2400800), однакові таймери.
  // Silent Dartan / Soul Ruler Kashapa / High Commander Lagta теж мають копії в Altgard, але їхні коди в NotMeter не підтверджені.
  { rift: 2400800, ours: 2101074, name: 'Gartua' },
];
export const riftRoleName = (p) => `🔔 Rift: ${p.name}`;

const mapEntries = (data, mapId) => {
  const srv = (data?.servers || []).find((s) => s.serverId === SERVER_ID);
  const map = (srv?.maps || []).find((m) => m.mapId === mapId);
  return map?.entries || [];
};

/**
 * @param data  JSON NotMeter
 * @param openMs  коли відкривається Rift (мс)
 * @returns {{ ok: boolean, inWindow: number, hasPairs: boolean, opportunities: Array }}
 */
export function analyzeRift(data, openMs) {
  if (!data) return { ok: false, inWindow: 0, hasPairs: PAIRS.length > 0, opportunities: [] };
  const end = openMs + WINDOW_MIN * 60000;
  const rift = mapEntries(data, RIFT_MAP_ID).filter((e) => e.targetAt >= openMs && e.targetAt <= end);
  const ours = mapEntries(data, OUR_MAP_ID);
  const opportunities = [];
  for (const p of PAIRS) {
    const r = rift.find((e) => e.bossCode === p.rift);
    const o = ours.find((e) => e.bossCode === p.ours);
    if (!r || !o) continue;
    const gapMin = (o.targetAt - r.targetAt) / 60000;
    if (gapMin > MIN_GAP_MIN) opportunities.push({ ...p, riftAt: r.targetAt, ourAt: o.targetAt, gapMin });
  }
  return { ok: true, inWindow: rift.length, hasPairs: PAIRS.length > 0, opportunities };
}
