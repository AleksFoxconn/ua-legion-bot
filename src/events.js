// Розклад регулярних івентів Global. Серверний час = SERVER_TZ (перевірено в грі: збігається з Europe/Warsaw).
// Джерела: клієнт гри (metabot.gg), allthings.how, expcarry.com; офіційного календаря NC немає.
import { DateTime } from 'luxon';

export const EVENTS = [
  {
    id: 'rift', name: 'Spacetime Rift', emoji: '🌀', show: 3, windowMin: 10, discordEvent: true,
    hours: [2, 5, 8, 11, 14, 17, 20, 23], minute: 0, // перевірено в грі: ріфт о 17:00 серверного часу
    note: 'портал відкритий ~10 хв, 60 хв у ворожій локації, рівень 45+',
  },
  {
    id: 'shugo', discordEvent: true, name: 'Shugo Festival', emoji: '🎉', show: 3, windowMin: 5,
    minute: 0, note: 'щогодини, міні-ігри у Verteron/Altgard',
  },
  {
    id: 'invasion', discordEvent: true, name: 'Dimensional Invasion', emoji: '👾', show: 2, windowMin: 15,
    minute: 30, note: 'щогодини о :30, вхід ~3 хв',
  },
  {
    id: 'siege', name: 'Artifact Siege', emoji: '🏰', show: 2, windowMin: 30, discordEvent: true,
    weekdays: [4, 6], hours: [21], minute: 0, // luxon: 1=пн … 7=нд (чт, сб)
    note: 'Chaotic Lower Reshanta, попередження за 10 хв; боси-виконавці через 30 хв',
  },
  // Нижче — за даними сторонніх сайтів (aion2timers, allthings.how, metabot): для Global не підтверджено, дивись нотатки.
  {
    id: 'arena', discordEvent: true, name: 'Battlefield (10v10)', emoji: '🏟️', show: 2, windowMin: 180,
    hours: [11, 19], minute: 0,
    note: 'щодня 11:00–14:00 та 19:00–21:00 (за metabot/allthings; перший слот 3 год, другий 2 год)',
  },
  {
    id: 'daily-reset', discordEvent: true, name: 'Щоденний ресет', emoji: '🔄', show: 1, windowMin: 15, tz: 'UTC',
    hours: [7], minute: 0,
    note: 'квести, підземелля, ключі Shugo; 07:00 UTC за сторонніми сайтами — звір з «Daily recharge in» у грі',
  },
  {
    id: 'weekly-reset', discordEvent: true, name: 'Тижневий ресет', emoji: '🗓️', show: 1, windowMin: 15, tz: 'UTC',
    weekdays: [3], hours: [7], minute: 0,
    note: 'середа; скидаються тижневі ліміти (рейди, Ascension Trial, підземелля)',
  },
];

/** Найближчі `count` початків події після `from` (DateTime у зоні tz). */
export function nextOccurrences(ev, from, tz, count = ev.show || 3) {
  const out = [];
  tz = ev.tz || tz;
  const start = from.setZone(tz).startOf('day');
  for (let d = 0; d < 9 && out.length < count + 30; d++) {
    const day = start.plus({ days: d });
    if (ev.weekdays && !ev.weekdays.includes(day.weekday)) continue;
    const hours = ev.hours || Array.from({ length: 24 }, (_, i) => i);
    for (const h of hours) {
      const t = day.set({ hour: h, minute: ev.minute || 0, second: 0, millisecond: 0 });
      if (t > from) out.push(t);
    }
  }
  return out.sort((a, b) => a - b).slice(0, count);
}

export const _DateTime = DateTime;
