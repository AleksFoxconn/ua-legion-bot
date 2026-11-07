// Єдиний стиль усіх табло (Abyss, світові боси, івенти).
// Рядок:  ⏳ **Назва** — <відлік> · <час>     далі:  ↳ далі: <час> · <час>     підвал: 🕒 Оновлено …
// Усі час/відлік — теги Discord, тож кожен бачить свій місцевий час.
export const sec = (ms) => Math.floor(ms / 1000);

/** Час: сьогодні/найближчі 24 год — лише година, далі — дата та година. */
export const when = (ms, nowMs) => {
  const s = sec(ms);
  return ms - nowMs < 86400000 ? `<t:${s}:t>` : `<t:${s}:d> <t:${s}:t>`;
};

export const line = (icon, name, ms, nowMs) => `${icon} **${name}** — <t:${sec(ms)}:R> · ${when(ms, nowMs)}`;
export const more = (list, nowMs) => (list.length ? `↳ далі: ${list.map((ms) => when(ms, nowMs)).join(' · ')}` : '');
export const updated = (nowMs) => `🕒 Оновлено <t:${sec(nowMs)}:T> (<t:${sec(nowMs)}:R>)`;
