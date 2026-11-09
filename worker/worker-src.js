// Cloudflare Worker: обробляє кнопку «Перекласти» під постами оновлень (Discord Interactions).
// Змінні середовища: DISCORD_PUBLIC_KEY, DISCORD_APP_ID. Відповідь — ефемерна (бачить лише той, хто натиснув).
import { bbToMd, localizeTimes, cut } from '../src/steam-format.js';

const APP_ID_STEAM = '3393110';
const hex = (h) => Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)));

async function verify(req, body, pub) {
  const sig = req.headers.get('x-signature-ed25519');
  const ts = req.headers.get('x-signature-timestamp');
  if (!sig || !ts) return false;
  const data = new TextEncoder().encode(ts + body);
  for (const alg of ['Ed25519', 'NODE-ED25519']) {
    try {
      const key = await crypto.subtle.importKey('raw', hex(pub), alg === 'Ed25519' ? { name: 'Ed25519' } : { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' }, false, ['verify']);
      return await crypto.subtle.verify(alg === 'Ed25519' ? 'Ed25519' : 'NODE-ED25519', key, hex(sig), data);
    } catch { /* пробуємо наступний */ }
  }
  return false;
}

async function gtx(text) {
  const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uk&dt=t', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
    body: 'q=' + encodeURIComponent(text),
  });
  if (!r.ok) throw new Error('gtx HTTP ' + r.status);
  const j = await r.json();
  return j[0].map((x) => x[0]).join('');
}

// запасний варіант: модель перекладу Cloudflare Workers AI (потрібен binding "AI")
async function cfai(env, text) {
  if (!env.AI) throw new Error('немає binding AI');
  const src = /[а-яіїєґ]/i.test(text) ? 'ru' : 'en';
  const parts = [];
  let cur = '';
  for (const piece of text.split(/(?<=[.!?\n])\s*/)) {
    if ((cur + ' ' + piece).length > 500 && cur) { parts.push(cur); cur = piece; } else cur = cur ? cur + ' ' + piece : piece;
  }
  if (cur) parts.push(cur);
  const out = [];
  for (const part of parts) {
    if (!part.trim()) { out.push(part); continue; }
    const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text: part, source_lang: src, target_lang: 'uk' });
    out.push(r.translated_text);
  }
  return out.join(' ');
}

let useAi = false;
async function tr(env, text) {
  if (!useAi) {
    try { return await gtx(text); } catch (e) { console.log('gtx failed:', String(e)); if (!env.AI) throw e; useAi = true; }
  }
  return cfai(env, text);
}

async function translateMd(env, md) {
  // <t:..> і посилання не перекладаємо — підміняємо плейсхолдерами
  const keep = [];
  const prot = md.replace(/<t:\d+(?::[a-zA-Z])?>|\]\(https?:[^)]+\)/g, (m) => { keep.push(m); return ` ZQ${keep.length - 1}ZQ `; });
  const paras = prot.split('\n');
  const chunks = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n' + p).length > 1500 && cur) { chunks.push(cur); cur = p; } else cur = cur ? cur + '\n' + p : p;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) out.push(c.trim() ? await tr(env, c) : c);
  return out.join('\n').replace(/\s*ZQ\s*(\d+)\s*ZQ\s*/g, (_, i) => keep[Number(i)] ?? '');
}

async function followup(env, token, payload, first) {
  const base = `https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}`;
  const r = first
    ? await fetch(`${base}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    : await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, flags: 64 }) });
  if (!r.ok) console.log('followup', r.status, await r.text());
}

async function handleTranslate(env, token, gid) {
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID_STEAM}&count=40&maxlength=0&format=json`);
    const it = (await r.json()).appnews.newsitems.find((x) => String(x.gid) === gid);
    if (!it) return followup(env, token, { content: 'Не знайшов цей пост у Steam (він міг зникнути зі стрічки).' }, true);
    const md = localizeTimes(bbToMd(it.contents), it.date);
    useAi = false;
    const title = await tr(env, it.title);
    const body = await translateMd(env, md);
    const link = `https://steamcommunity.com/games/${APP_ID_STEAM}/announcements/detail/${it.gid}`;
    const text = cut(body, 3900);
    await followup(env, token, { embeds: [{ color: 0x3498db, title: `🇺🇦 ${title}`.slice(0, 250), url: link, description: text + '\n\n*Машинний переклад — за точністю дивись оригінал.*' }] }, true);
  } catch (e) {
    console.log('translate error:', String(e && e.message || e));
    await followup(env, token, { content: 'Не вдалося перекласти зараз. Спробуй ще раз трохи пізніше.' }, true);
  }
}

export default {
  async fetch(req, env, ctx) {
    if (req.method !== 'POST') return new Response('ua-legion translate worker');
    const body = await req.text();
    if (!(await verify(req, body, env.DISCORD_PUBLIC_KEY))) return new Response('bad signature', { status: 401 });
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({ type: 1 });
    if (i.type === 3 && String(i.data?.custom_id || '').startsWith('tr:')) {
      ctx.waitUntil(handleTranslate(env, i.token, i.data.custom_id.slice(3)));
      return Response.json({ type: 5, data: { flags: 64 } }); // «думає…», видима лише натиснувшому
    }
    return Response.json({ type: 4, data: { content: 'Невідома дія.', flags: 64 } });
  },
};
