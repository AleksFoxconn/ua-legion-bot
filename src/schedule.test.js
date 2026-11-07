import assert from 'node:assert/strict';
import { CATEGORIES } from './bosses.js';
import { nextSpawn, upcoming, fromIso } from './schedule.js';

const TZ = 'Asia/Seoul';
const boss = (id) => CATEGORIES.abyss.bosses.find((b) => b.id === id);

// 2026-11-06 — п'ятниця (weekday 5)
let t = nextSpawn(boss('watcher-kaira'), fromIso('2026-11-06T00:30:00', TZ), TZ);
assert.equal(t.toFormat('HH:mm'), '01:00');

t = nextSpawn(boss('watcher-kaira'), fromIso('2026-11-06T01:00:00', TZ), TZ);
assert.equal(t.toFormat('HH:mm'), '04:00', 'рівно 01:00 -> наступний слот 04:00');

t = nextSpawn(boss('watcher-kaira'), fromIso('2026-11-06T22:30:00', TZ), TZ);
assert.equal(t.toFormat('yyyy-MM-dd HH:mm'), '2026-11-07 01:00', 'після 22:00 -> 01:00 наступної доби');

t = nextSpawn(boss('guardian-lord-nahma'), fromIso('2026-11-06T10:00:00', TZ), TZ);
assert.equal(t.toFormat('yyyy-MM-dd HH:mm'), '2026-11-06 21:00', 'п’ятниця 21:00');

t = nextSpawn(boss('guardian-lord-nahma'), fromIso('2026-11-06T22:00:00', TZ), TZ);
assert.equal(t.toFormat('yyyy-MM-dd HH:mm'), '2026-11-08 21:00', 'після п’ятниці -> неділя');

t = nextSpawn(boss('executor-argo'), fromIso('2026-11-06T22:00:00', TZ), TZ);
assert.equal(t.toFormat('yyyy-MM-dd HH:mm'), '2026-11-07 21:30', 'субота 21:30');

// групування: усі Executors + Middle Reshanta в один час
const ev = upcoming(CATEGORIES.abyss, fromIso('2026-11-07T21:00:00', TZ), TZ, 45 * 60 * 1000);
assert.equal(ev.length, 1);
assert.equal(ev[0].bosses.length, 3, 'Tamasa, Argo, Kaira (Middle Reshanta вимкнено на Global)');

console.log('OK: schedule tests passed');
