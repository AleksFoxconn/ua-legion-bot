// Дані про босів. Час у розкладах — СЕРВЕРНИЙ (SERVER_TZ).
// weekdays: 1 = Пн ... 7 = Нд (luxon).
//
// Розклади взято зі сторінок aion2.gg, wikily.gg, allthings.how (листопад 2026).
// Global-клієнт має 5 Abyss-босів у Lower Reshanta. Боси Middle Reshanta є лише в KR/TW,
// тому вони тут вимкнені (enabled: false) до відкриття на EU/NA.
// Час Nahma на Global позначений як «provisional» (21:00); звір з грою.

export const CATEGORIES = {
  abyss: {
    id: 'abyss',
    title: 'Abyss (Reshanta)',
    emoji: '🌀',
    channelEnv: 'ABYSS_CHANNEL_ID',
    roleEnv: 'ABYSS_ROLE_ID',
    kind: 'scheduled', // бот сам знає час спавну
    bosses: [
      {
        id: 'watcher-kaira',
        name: 'Watcher Kaira',
        zone: 'Chaotic Lower Reshanta',
        level: 65,
        schedule: { type: 'interval', everyHours: 3, startHour: 1 }, // 01:00, 04:00 ... 22:00
        event: false, // 8 спавнів на добу: не створюємо події Discord, лише рядок у дошці
      },
      {
        id: 'guardian-lord-nahma',
        name: 'Guardian Lord Nahma',
        zone: 'Chaotic Lower Reshanta',
        level: 65,
        schedule: { type: 'weekly', weekdays: [5, 7], time: '21:00' },
      },
      {
        id: 'executor-tamasa',
        name: 'Executor Tamasa',
        zone: 'Chaotic Lower Reshanta',
        level: 65,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
      {
        id: 'executor-argo',
        name: 'Executor Argo',
        zone: 'Chaotic Lower Reshanta',
        level: 65,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
      {
        id: 'executor-kaira',
        name: 'Executor Kaira',
        zone: 'Chaotic Lower Reshanta',
        level: 65,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
      {
        id: 'enraged-guardian-lord-nahma',
        enabled: false, // лише KR/TW клієнт, на Global (EU/NA) ще не відкрито
        name: 'Enraged Guardian Lord Nahma',
        zone: 'Chaotic Middle Reshanta',
        level: 80,
        schedule: { type: 'weekly', weekdays: [5, 7], time: '21:00' },
      },
      {
        id: 'executioner-dramos',
        enabled: false, // лише KR/TW клієнт, на Global (EU/NA) ще не відкрито
        name: 'Executioner Dramos',
        zone: 'Chaotic Middle Reshanta',
        level: 80,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
      {
        id: 'turncoat-ducal',
        enabled: false, // лише KR/TW клієнт, на Global (EU/NA) ще не відкрито
        name: 'Turncoat Ducal',
        zone: 'Chaotic Middle Reshanta',
        level: 80,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
      {
        id: 'ravager-marakha',
        enabled: false, // лише KR/TW клієнт, на Global (EU/NA) ще не відкрито
        name: 'Ravager Marakha',
        zone: 'Chaotic Middle Reshanta',
        level: 80,
        schedule: { type: 'weekly', weekdays: [4, 6], time: '21:30' },
      },
    ],
  },

  // ЗАГОТОВКА: звичайні (польові) боси Verteron / Altgard.
  // У них немає розкладу: вони відроджуються через N годин ПІСЛЯ вбивства,
  // тож бот не може знати час сам. Етап 2: кнопка «Вбили» під постом -> таймер.
  // Поки що список порожній, бот цю категорію не постить.
  field: {
    id: 'field',
    title: 'Польові боси (Verteron / Altgard)',
    emoji: '🗺️',
    channelEnv: 'FIELD_CHANNEL_ID',
    roleEnv: 'FIELD_ROLE_ID',
    kind: 'respawn', // час залежить від вбивства
    bosses: [
      // Приклад формату (заповнимо з мапи на Kasaka):
      // { id: 'melted-danar', name: 'Melted Danar', zone: 'Verteron', respawnHours: 1 },
    ],
  },
};
