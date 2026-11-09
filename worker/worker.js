// src/steam-format.js
function bbToMd(src) {
  let s = String(src || "").replace(/[\u200b-\u200d\ufeff]/g, "");
  s = s.replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, "");
  s = s.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, "[$2]($1)");
  s = s.replace(/\[h[1-3]\]([\s\S]*?)\[\/h[1-3]\]/gi, (_, t) => `
**${t.replace(/\[\/?b\]/gi, "").trim()}**
`);
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "**$1**");
  s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "*$1*");
  s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "__$1__");
  s = s.replace(/\[strike\]([\s\S]*?)\[\/strike\]/gi, "~~$1~~");
  s = s.replace(/\[\*\]/g, "\n\u2022 ").replace(/\[\/\*\]/g, "");
  s = s.replace(/\[\/t[dh]\]/gi, " | ").replace(/\[\/tr\]/gi, "\n");
  s = s.replace(/\[\/p\]/gi, "\n").replace(/\[hr\]/gi, "\n");
  s = s.replace(/\[\/?(?:p|list|olist|table|tr|td|th|h\d|b|i|u|strike|hr|quote|code|spoiler|url|noparse|previewyoutube)(?:[= ][^\]]*)?\]/gi, "");
  s = s.replace(/\\\[/g, "[").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  s = s.split("\n").map((l) => l.replace(/\s*\|\s*$/, "").replace(/[ \t]+$/g, "")).filter((l, i, a) => !(l.trim() === "" && a[i - 1]?.trim() === "")).join("\n");
  return s.trim();
}
var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
var TZ_OFF = { PST: -8, PDT: -7, UTC: 0, GMT: 0, CET: 1, CEST: 2, KST: 9 };
var TZ = "PST|PDT|UTC|GMT|CET|CEST|KST";
var D = "([A-Z][a-z]{2,8})\\.?\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?";
function toTs(mon, day, year, hm, tz, postSec) {
  const m = MONTHS[mon.slice(0, 3).toLowerCase()];
  if (m === void 0 || !(tz in TZ_OFF)) return null;
  const [h, mi] = hm.split(":").map(Number);
  const post = new Date(postSec * 1e3);
  let y = year ? Number(year) : post.getUTCFullYear();
  const mk = (yy) => Date.UTC(yy, m, Number(day), h, mi) / 1e3 - TZ_OFF[tz] * 3600;
  let t = mk(y);
  if (!year && t < postSec - 150 * 86400) t = mk(y + 1);
  return t;
}
var fmt = (t) => `<t:${t}:F>`;
function localizeTimes(text, postSec) {
  const lines = String(text).split("\n");
  const out = [];
  let skipTz = false;
  for (const line of lines) {
    if (skipTz && new RegExp(`^\\s*(?:\u25A0\\s*)?(?:${TZ}):\\s*[A-Z]`).test(line)) continue;
    const rg = line.match(new RegExp(`^(\\s*(?:\u25A0\\s*)?)(${TZ}):\\s*${D}\\s+at\\s+(\\d{1,2}:\\d{2})\\s*[-\u2013]\\s*${D.replace(/\(\[A-Z\]/, "([A-Z]")}\\s+at\\s+(\\d{1,2}:\\d{2})\\s*$`));
    if (rg) {
      const [, pre, tz, m1, d1, y1, h1, m2, d2, y2, h2] = rg;
      const a = toTs(m1, d1, y1, h1, tz, postSec);
      const b = toTs(m2, d2, y2 || y1, h2, tz, postSec);
      if (a && b) {
        out.push(`${pre}${fmt(a)} \u2013 ${fmt(b)}`);
        skipTz = true;
        continue;
      }
    }
    skipTz = false;
    const rest = `(?:\\s*\\/\\s*(?:[A-Z][a-z]{2,8}\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?(?:,|\\s+at)?\\s*)?\\d{1,2}:\\d{2}\\s*(?:${TZ}))*`;
    const re = new RegExp(`${D}(?:,|\\s+at)?\\s*(?:from\\s+)?(\\d{1,2}:\\d{2})\\s*(${TZ})${rest}`, "g");
    out.push(line.replace(re, (all, mon, day, year, hm, tz) => {
      const t = toTs(mon, day, year, hm, tz, postSec);
      return t ? `${fmt(t)} (<t:${t}:R>)` : all;
    }));
  }
  return out.join("\n");
}
var cut = (s, n) => {
  if (s.length <= n) return s;
  const i = s.lastIndexOf("\n", n);
  return s.slice(0, i > n * 0.6 ? i : n).trimEnd() + "\n\u2026";
};

// worker/worker-src.js
var APP_ID_STEAM = "3393110";
var hex = (h) => Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)));
async function verify(req, body, pub) {
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return false;
  const data = new TextEncoder().encode(ts + body);
  for (const alg of ["Ed25519", "NODE-ED25519"]) {
    try {
      const key = await crypto.subtle.importKey("raw", hex(pub), alg === "Ed25519" ? { name: "Ed25519" } : { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]);
      return await crypto.subtle.verify(alg === "Ed25519" ? "Ed25519" : "NODE-ED25519", key, hex(sig), data);
    } catch {
    }
  }
  return false;
}
async function gtx(text) {
  const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uk&dt=t", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
    body: "q=" + encodeURIComponent(text)
  });
  if (!r.ok) throw new Error("gtx HTTP " + r.status);
  const j = await r.json();
  return j[0].map((x) => x[0]).join("");
}
async function cfai(env, text) {
  if (!env.AI) throw new Error("\u043D\u0435\u043C\u0430\u0454 binding AI");
  const src = /[а-яіїєґ]/i.test(text) ? "ru" : "en";
  const parts = [];
  let cur = "";
  for (const piece of text.split(/(?<=[.!?\n])\s*/)) {
    if ((cur + " " + piece).length > 500 && cur) {
      parts.push(cur);
      cur = piece;
    } else cur = cur ? cur + " " + piece : piece;
  }
  if (cur) parts.push(cur);
  const out = [];
  for (const part of parts) {
    if (!part.trim()) {
      out.push(part);
      continue;
    }
    const r = await env.AI.run("@cf/meta/m2m100-1.2b", { text: part, source_lang: src, target_lang: "uk" });
    out.push(r.translated_text);
  }
  return out.join(" ");
}
var useAi = false;
async function tr(env, text) {
  if (!useAi) {
    try {
      return await gtx(text);
    } catch (e) {
      console.log("gtx failed:", String(e));
      if (!env.AI) throw e;
      useAi = true;
    }
  }
  return cfai(env, text);
}
async function translateMd(env, md) {
  const keep = [];
  const prot = md.replace(/<t:\d+(?::[a-zA-Z])?>|\]\(https?:[^)]+\)/g, (m) => {
    keep.push(m);
    return ` ZQ${keep.length - 1}ZQ `;
  });
  const paras = prot.split("\n");
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n" + p).length > 1500 && cur) {
      chunks.push(cur);
      cur = p;
    } else cur = cur ? cur + "\n" + p : p;
  }
  if (cur) chunks.push(cur);
  const out = [];
  for (const c of chunks) out.push(c.trim() ? await tr(env, c) : c);
  return out.join("\n").replace(/\s*ZQ\s*(\d+)\s*ZQ\s*/g, (_, i) => keep[Number(i)] ?? "");
}
async function followup(env, token, payload, first) {
  const base = `https://discord.com/api/v10/webhooks/${env.DISCORD_APP_ID}/${token}`;
  const r = first ? await fetch(`${base}/messages/@original`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) : await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, flags: 64 }) });
  if (!r.ok) console.log("followup", r.status, await r.text());
}
async function handleTranslate(env, token, gid) {
  try {
    const r = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${APP_ID_STEAM}&count=40&maxlength=0&format=json`);
    const it = (await r.json()).appnews.newsitems.find((x) => String(x.gid) === gid);
    if (!it) return followup(env, token, { content: "\u041D\u0435 \u0437\u043D\u0430\u0439\u0448\u043E\u0432 \u0446\u0435\u0439 \u043F\u043E\u0441\u0442 \u0443 Steam (\u0432\u0456\u043D \u043C\u0456\u0433 \u0437\u043D\u0438\u043A\u043D\u0443\u0442\u0438 \u0437\u0456 \u0441\u0442\u0440\u0456\u0447\u043A\u0438)." }, true);
    const md = localizeTimes(bbToMd(it.contents), it.date);
    useAi = false;
    const title = await tr(env, it.title);
    const body = await translateMd(env, md);
    const link = `https://steamcommunity.com/games/${APP_ID_STEAM}/announcements/detail/${it.gid}`;
    const text = cut(body, 3900);
    await followup(env, token, { embeds: [{ color: 3447003, title: `\u{1F1FA}\u{1F1E6} ${title}`.slice(0, 250), url: link, description: text + "\n\n*\u041C\u0430\u0448\u0438\u043D\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434 \u2014 \u0437\u0430 \u0442\u043E\u0447\u043D\u0456\u0441\u0442\u044E \u0434\u0438\u0432\u0438\u0441\u044C \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B.*" }] }, true);
  } catch (e) {
    console.log("translate error:", String(e && e.message || e));
    await followup(env, token, { content: "\u041D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0441\u0442\u0438 \u0437\u0430\u0440\u0430\u0437. \u0421\u043F\u0440\u043E\u0431\u0443\u0439 \u0449\u0435 \u0440\u0430\u0437 \u0442\u0440\u043E\u0445\u0438 \u043F\u0456\u0437\u043D\u0456\u0448\u0435." }, true);
  }
}
var worker_src_default = {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return new Response("ua-legion translate worker");
    const body = await req.text();
    if (!await verify(req, body, env.DISCORD_PUBLIC_KEY)) return new Response("bad signature", { status: 401 });
    const i = JSON.parse(body);
    if (i.type === 1) return Response.json({ type: 1 });
    if (i.type === 3 && String(i.data?.custom_id || "").startsWith("tr:")) {
      ctx.waitUntil(handleTranslate(env, i.token, i.data.custom_id.slice(3)));
      return Response.json({ type: 5, data: { flags: 64 } });
    }
    return Response.json({ type: 4, data: { content: "\u041D\u0435\u0432\u0456\u0434\u043E\u043C\u0430 \u0434\u0456\u044F.", flags: 64 } });
  }
};
export {
  worker_src_default as default
};
