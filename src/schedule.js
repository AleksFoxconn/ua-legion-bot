import { DateTime } from 'luxon';

/** Найближчий спавн боса після `from` (DateTime). Повертає DateTime або null. */
export function nextSpawn(boss, from, tz) {
  const s = boss.schedule;
  if (!s) return null;
  const now = from.setZone(tz);

  if (s.type === 'interval') {
    // Слоти: startHour, startHour+N, ... протягом доби
    for (let day = 0; day <= 1; day++) {
      const base = now.startOf('day').plus({ days: day });
      for (let h = s.startHour % s.everyHours; h < 24; h += s.everyHours) {
        const t = base.set({ hour: h });
        if (t > now) return t;
      }
    }
    return null;
  }

  if (s.type === 'weekly') {
    const [hh, mm] = s.time.split(':').map(Number);
    for (let day = 0; day <= 7; day++) {
      const t = now.startOf('day').plus({ days: day }).set({ hour: hh, minute: mm });
      if (s.weekdays.includes(t.weekday) && t > now) return t;
    }
  }
  return null;
}

/** Усі спавни категорії в найближчі `windowMs`, згруповані за часом. */
export const active = (category) => category.bosses.filter((b) => b.enabled !== false);

export function upcoming(category, from, tz, windowMs) {
  const byTime = new Map();
  for (const boss of active(category)) {
    const t = nextSpawn(boss, from, tz);
    if (!t || t.toMillis() - from.toMillis() > windowMs) continue;
    const key = t.toMillis();
    if (!byTime.has(key)) byTime.set(key, { time: t, bosses: [] });
    byTime.get(key).bosses.push(boss);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/** Один найближчий спавн для кожного боса (для дошки розкладу). */
export function nextPerBoss(category, from, tz) {
  return active(category)
    .map((boss) => ({ boss, time: nextSpawn(boss, from, tz) }))
    .filter((x) => x.time)
    .sort((a, b) => a.time - b.time);
}

export const fromIso = (iso, tz) => DateTime.fromISO(iso, { zone: tz });

/** Усі спавни боса в (from, to]. */
export function spawnsBetween(boss, from, to, tz) {
  const out = [];
  let cur = from;
  for (let i = 0; i < 500; i++) {
    const t = nextSpawn(boss, cur, tz);
    if (!t || t > to) break;
    out.push(t);
    cur = t;
  }
  return out;
}
