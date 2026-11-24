/* Splendor Music: prototype v0.9.0 (24 Nov 2026: verified-only artists, dollar prices, artist tools, artist-edited credits; v0.8.0: privacy-first artist pages, plain words, For artists page, vinyl; v0.7.0: photo upload + crop, not-yet releases + asks, videos, industry-standard titles; v0.6.0: artist pages, lyrics, Haze + logo; v0.5.0: Playlists tab + briefs, brand fonts, Now Playing, back nav; v0.4.4: Vibrr listening copies, real album names, live Vibrr Radio station)
   Concept + product design: Lachlan Grant Splendor (Vibrr Music / Music Passport; X post 15 Sep 2026; the
   playlisting economy). "Mint on Vibrr. Listen, share and earn on Splendor Music."
   Data: public XPR Network chain data only: AtomicAssets (Vibrr's music schema "cxcmus"), Vibrr's split contract
   "vibrrsplit" (registered splits + every payout) via Hyperion, AtomicMarket resales, XPR profiles (eosio.proton).
   Read-only: no wallet keys, no payments. Every value from the chain is treated as untrusted text (escaped). */
"use strict";
const AA = "https://proton.api.atomicassets.io";
const API = AA + "/atomicassets/v1", MKT = AA + "/atomicmarket/v1";
const HYPERION = ["https://proton.protonuk.io", "https://proton.eosusa.io"];
const RPC = "https://proton.greymass.com";
const EXPLORER = "https://explorer.xprnetwork.org";
// XPR's own Pinata gateway (named in Vibrr's collection data) starts a WAV in ~1.5 s vs ~6 s on the public one
const GATEWAYS = ["https://proton.mypinata.cloud/ipfs/", "https://ipfs.filebase.io/ipfs/", "https://gateway.pinata.cloud/ipfs/", "https://dweb.link/ipfs/"];
const SCHEMA = "cxcmus", SPLITTER = "vibrrsplit";
// Vibrr Radio's public feed (read only; Vibrr opened it to this site on 24 Nov 2026): play counts, reactions, real album names
const VRADIO = "https://api.vibrr.ai/api/radio/tracks";
const VR = { ok: false, byId: new Map() };
const KYC = { checked: false, ok: new Set() };     // accounts whose owner passed XPR's identity check (KYC)
async function loadKyc(accounts) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  const res = await Promise.all([...accounts].map(acc => fetch(`${RPC}/v1/chain/get_table_rows`, { method: "POST", signal: ctl.signal,
      body: JSON.stringify({ json: true, code: "eosio.proton", scope: "eosio.proton", table: "usersinfo", lower_bound: acc, upper_bound: acc, limit: 1 }) })
    .then(r => r.json()).then(j => { const k = j.rows?.[0]?.kyc; if (Array.isArray(k) ? k.length : String(k || "").length > 2) KYC.ok.add(acc); return true; }).catch(() => false)));
  clearTimeout(timer); KYC.checked = res.some(Boolean);
}
/* prices in plain dollars: stablecoins are US dollars; other tokens show their dollar value when known */
const STABLE = new Set(["XUSDC", "XUSDT", "USDC", "USDT", "XUSD", "XMD"]), USD = {};
function money(n, sym) {
  n = +n || 0; sym = String(sym || "").toUpperCase();
  const usd = v => "US$" + (v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(2).replace(/\.00$/, ""));
  if (STABLE.has(sym)) return usd(n);
  if (USD[sym]) return "≈ " + usd(n * USD[sym]);
  return `${num(n)} ${sym}`;
}
fetch("https://proton.alcor.exchange/api/v2/tokens/xpr-eosio.token").then(r => r.json()).then(d => { if (+d.usd_price > 0) USD.XPR = +d.usd_price; }).catch(() => {});         // template id -> { plays, reacts, album, listen, track, released, asset }
const PIPE = { artist: 80, hops: 5 };              // example only: the artist opts in and sets the share (Vibrr is scoping it)
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)"];
const VIEWS = {};                                  // extra pages registered by radio.js / wallet.js
const OWN = new Set(), OFF = new Set();            // templates you own / songs saved on this device (filled by wallet.js)
const EMBED = new URLSearchParams(location.search).has("embed");

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = encodeURIComponent;
const view = () => $("#view");
function ipfs(cid, g = 0) {
  if (!cid) return ""; let s = String(cid).trim();
  if (/^https?:\/\//i.test(s)) return s;
  s = s.replace(/^ipfs:\/\//, "").replace(/^\/?ipfs\//, "");
  return /^[A-Za-z0-9]{20,}(\/[^\s"'<>]*)?$/.test(s) ? GATEWAYS[g] + s : "";
}
const fmt = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
                set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const plural = (n, w, ws = w + "s") => `${(+n).toLocaleString()} ${+n === 1 ? w : ws}`;
const date = ms => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  if (s < 86400 * 45) return Math.round(s / 86400) + "d ago";
  return date(ms);
}
function qty(q) { const m = String(q || "").match(/^([\d.]+)\s+([A-Z0-9]+)$/); return m ? { n: +m[1], sym: m[2] } : { n: 0, sym: "" }; }
const num = n => (+n).toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) < 10 ? 4 : 2 });
const isAcct = x => /^[a-z1-5.]{1,12}$/.test(String(x || ""));
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = s => decodeURIComponent(escape(atob(String(s).replace(/-/g, "+").replace(/_/g, "/"))));
const me = () => store.get("me", "") || "";
const vibrrUrl = t => `https://vibrr.ai/vibrr-market/template/${enc(t.collection)}/${enc(t.id)}`;   // each song's own page on Vibrr
const edition = t => t.max === 0 ? "Open edition" : t.max === 1 ? "1/1" : `Edition of ${t.max}`;
const relCollected = r => r.tracks.reduce((n, t) => n + (t.issued || 0), 0);
const songCount = a => a.releases.reduce((n, r) => n + r.tracks.length, 0);

/* ---------- data: every music template on XPR -> tracks -> releases -> artists ---------- */
let TRACKS = [], RELEASES = [], ARTISTS = [];
const byId = new Map(), relByKey = new Map(), LISTS = {};
const CHAIN = { splits: new Map(), collects: new Map(), resales: new Map(), tokens: new Map(), paused: false, ok: false, mktOk: false, ready: Promise.resolve() };

async function getJSON(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(r.status + " " + url);
  return (await r.json()).data;
}
const albumOk = a => { a = String(a || "").trim(); return !!a && a.length <= 40 && !/[.!?]\s/.test(a); };   // some artists put a blurb in "album"
function splitName(d) {
  const name = d.name || d.title || "Untitled";
  const parts = name.split(/\s+[—–-]\s+/);
  const album = String(d.album || "").trim();
  const title = parts.length > 1 ? parts.slice(1).join(" — ").trim() : (d.title && d.title !== name) ? d.title : name;
  // songs minted with Vibrr's new fields (track / released, from 24 Nov 2026) carry the REAL album title in "album"
  if ((d.track || d.released) && albumOk(album)) return { rel: album, title };
  if (parts.length > 1) return { rel: parts[0].trim(), title };
  return { rel: albumOk(album) ? album : name, title };
}
// "2026" / "2026-11" / "2026-11-24" -> "2026" / "Nov 2026" / "24 Nov 2026"
function relDate(s) {
  const m = String(s || "").trim().match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/); if (!m) return String(s || "").trim();
  if (!m[2]) return m[1];
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)));
  return dt.toLocaleDateString(undefined, m[3] ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" });
}
/* Vibrr Radio feed: best effort, never blocks the app for long (only this site's origin is allowed to read it) */
async function loadVibrrRadio() {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 5000);
  try {
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${VRADIO}?limit=100&page=${page}`, { signal: ctl.signal, credentials: "omit" }); if (!r.ok) break;
      const j = await r.json(), list = Array.isArray(j.tracks) ? j.tracks : [];
      for (const x of list) {
        const id = String(x.template_id || ""); if (!/^\d+$/.test(id)) continue;
        const rc = x.reaction_counts && typeof x.reaction_counts === "object" ? x.reaction_counts : {};
        // the feed lists each minted COPY (asset) on its own, so one song can appear more than once: add them up per song
        const v = VR.byId.get(id) || { plays: 0, reacts: 0, album: "", listen: "", track: null, released: "", asset: "" };
        v.plays += Math.max(0, +x.play_count || 0); v.reacts += Object.values(rc).reduce((n, k) => n + Math.max(0, +k || 0), 0);
        v.album ||= String(x.album_title || "").trim(); v.listen ||= String(x.preview_audio_url || "").trim();
        v.track ??= x.track_number ?? null; v.released ||= String(x.released || x.release_date || "").trim(); v.asset ||= String(x.asset_id || "");
        VR.byId.set(id, v);
      }
      VR.ok = VR.byId.size > 0;
      if (!list.length || page * (+j.limit || 100) >= (+j.total_count || 0)) break;
    }
  } catch {} finally { clearTimeout(timer); }
}
async function load() {
  const vr = loadVibrrRadio();                       // in parallel with the chain catalogue
  let page = 1, all = [];
  while (page < 20) {
    const d = await getJSON(`${API}/templates?schema_name=${SCHEMA}&limit=100&page=${page}&order=asc&sort=created`);
    all = all.concat(d); if (d.length < 100) break; page++;
  }
  await vr;
  // songs on Vibrr Radio minted under another schema (e.g. "music"): fetch them too, so the station plays everything Vibrr does
  const have = new Set(all.map(t => String(t.template_id))), extra = [...VR.byId.keys()].filter(id => !have.has(id)).slice(0, 100);
  if (extra.length) try { all = all.concat(await getJSON(`${API}/templates?ids=${extra.join(",")}&limit=100`)); } catch {}
  // only music released by identity-verified accounts: no imposters (if the check can't run, nothing is hidden)
  await loadKyc(new Set(all.map(t => t.collection?.author).filter(Boolean)));
  if (KYC.checked) all = all.filter(t => KYC.ok.has(t.collection?.author));
  for (const t of all) {
    const d = t.immutable_data || {};
    if (!d.audio) continue;                              // nothing to play
    const sn = splitName(d), c = t.collection || {}, collection = c.collection_name;
    const relTitle = sn.rel.trim(), key = collection + "~" + relTitle.toLowerCase();
    const tr = { id: String(t.template_id), collection, key, title: sn.title, release: relTitle,
                 artist: String(d.artist || "").trim() || c.name || collection, d, img: d.img || d.image, audio: d.audio,
                 listen: d.listen || VR.byId.get(String(t.template_id))?.listen || "",   // Vibrr's 256k AAC listening copy (master stays in audio)
                 schema: t.schema?.schema_name || SCHEMA,
                 max: +t.max_supply, issued: +t.issued_supply, created: +t.created_at_time,
                 author: c.author, fee: +c.market_fee || 0, colName: c.name || collection, minters: c.authorized_accounts || [] };
    TRACKS.push(tr); byId.set(tr.id, tr);
    if (!relByKey.has(key)) relByKey.set(key, { key, title: relTitle, artist: tr.artist, collection, img: tr.img, tracks: [], created: tr.created, d });
    const r = relByKey.get(key); r.tracks.push(tr); r.created = Math.max(r.created, tr.created);
  }
  for (const r of relByKey.values()) {   // collapse exact duplicate tracks inside a release (same title + same audio)
    r.raw = r.tracks.length;
    const seen = new Set(); r.tracks = r.tracks.filter(t => { const k = t.title.toLowerCase() + t.audio; if (seen.has(k)) return false; seen.add(k); return true; });
    // Vibrr's schema has a 'track' field: when artists fill it, play in that order (otherwise mint order)
    const tn = t => { const n = parseInt(String(t.d.track ?? "").replace(/[^0-9]/g, ""), 10); return n > 0 ? n : 1e9; };
    if (r.tracks.some(t => tn(t) < 1e9)) r.tracks.sort((x, y) => tn(x) - tn(y) || x.created - y.created);
    const rel = r.tracks.map(t => String(t.d.released || "").trim() || VR.byId.get(t.id)?.released || "").find(Boolean); if (rel) r.released = rel;
    // older songs can't be changed on chain: Vibrr Radio returns their real album name, so use it when the feed agrees
    const al = [...new Set(r.tracks.map(t => VR.byId.get(t.id)?.album).filter(albumOk))];
    if (al.length === 1 && al[0] !== r.title) { r.title = al[0]; r.tracks.forEach(t => t.release = al[0]); r.renamed = true; }
  }
  // a renamed release can now share its title with a sibling in the same collection: merge them into ONE release
  // (the old key keeps working: it points at the merged release)
  const byTitle = new Map();
  for (const [k, r] of [...relByKey]) {
    const tk = r.collection + "~" + r.title.toLowerCase(), keep = byTitle.get(tk);
    if (!keep) { byTitle.set(tk, r); continue; }
    if (keep === r) continue;
    r.tracks.forEach(t => { t.key = keep.key; t.release = keep.title; keep.tracks.push(t); });
    keep.tracks.sort((x, y) => x.created - y.created);
    keep.created = Math.max(keep.created, r.created); keep.raw += r.raw; keep.released ||= r.released;
    relByKey.set(k, keep);
  }
  // tidy: the same recordings minted again by the same artist in another collection (matching ISRCs) show as ONE release.
  // Keep the cleaner mint (fewer duplicate templates), then the newer one. The other stays reachable from the Passport.
  const rels = [...new Set(relByKey.values())], isrcOf = r => new Set(r.tracks.map(t => String(t.d.isrc || "").trim().toUpperCase()).filter(Boolean));
  for (let i = 0; i < rels.length; i++) for (let j = i + 1; j < rels.length; j++) {
    const a = rels[i], b = rels[j];
    if (a.hidden || b.hidden || a.artist.toLowerCase() !== b.artist.toLowerCase()) continue;
    const A = isrcOf(a), B = isrcOf(b); if (!A.size || !B.size) continue;
    if ([...A].filter(x => B.has(x)).length < Math.min(A.size, B.size) / 2) continue;
    const da = a.raw - a.tracks.length, db = b.raw - b.tracks.length;
    const [keep, drop] = da !== db ? (da < db ? [a, b] : [b, a]) : (a.created >= b.created ? [a, b] : [b, a]);
    drop.hidden = true; drop.dupOf = keep.key;
  }
  for (const r of rels) if (r.hidden) r.tracks.forEach(t => t.hidden = true);
  RELEASES = rels.filter(r => !r.hidden).sort((a, b) => b.created - a.created);
  TRACKS = RELEASES.flatMap(r => r.tracks);              // every playable song once (all templates stay in byId for Passports)
  const am = new Map();
  for (const r of RELEASES) {
    if (!am.has(r.artist)) am.set(r.artist, { name: r.artist, releases: [], img: r.img, accounts: new Set(), collected: 0, verified: false });
    const a = am.get(r.artist); a.releases.push(r);
    r.tracks.forEach(t => { if (t.author) a.accounts.add(t.author); if (KYC.ok.has(t.author)) a.verified = true; a.collected += t.issued || 0; });
  }
  ARTISTS = [...am.values()].sort((a, b) => songCount(b) - songCount(a));
}

/* Vibrr's split contract: registered splits + every primary collect and its payouts (same transaction). */
async function loadLedger() {
  let acts = null;
  for (const h of HYPERION) {
    try { const r = await fetch(`${h}/v2/history/get_actions?account=${SPLITTER}&limit=1000&sort=asc`); if (r.ok) { acts = (await r.json()).actions || []; break; } } catch {}
  }
  if (acts) {
    CHAIN.ok = true; const trx = new Map(), seen = new Set();
    for (const a of acts) {
      if (seen.has(a.global_sequence)) continue; seen.add(a.global_sequence);
      const act = a.act || {}, d = act.data || {}, time = Date.parse(a["@timestamp"] + "Z");
      if (act.account === SPLITTER && act.name === "regsplit")
        CHAIN.splits.set(String(d.template_id), { artist: d.artist, collection: d.collection, royalty_bps: +d.royalty_bps || 0, wallets: d.wallets || [], bps: (d.bps || []).map(Number), time });
      else if (act.account === SPLITTER && act.name === "rmsplit") CHAIN.splits.delete(String(d.template_id));
      else if (act.account === SPLITTER && act.name === "regtoken") { const [p, s] = String(d.sym || "").split(","); if (s) CHAIN.tokens.set(s, { precision: +p, contract: d.contract }); }
      else if (act.account === SPLITTER && act.name === "setpaused") CHAIN.paused = !!d.paused;
      else if (act.name === "transfer" && (d.to === SPLITTER || d.from === SPLITTER)) {
        if (!trx.has(a.trx_id)) trx.set(a.trx_id, { trx: a.trx_id, time, ins: [], outs: [] });
        const g = trx.get(a.trx_id), incoming = d.to === SPLITTER;
        (incoming ? g.ins : g.outs).push({ acc: incoming ? d.from : d.to, q: qty(d.quantity), memo: String(d.memo || "") });
      }
    }
    for (const g of trx.values()) {
      const pay = g.ins.find(x => /^mint,\d+/.test(x.memo)); if (!pay) continue;
      const tid = pay.memo.split(",")[1];
      if (!CHAIN.collects.has(tid)) CHAIN.collects.set(tid, []);
      CHAIN.collects.get(tid).push({ trx: g.trx, time: g.time, buyer: pay.acc, paid: pay.q, outs: g.outs });
    }
  }
  try {
    for (let page = 1; page < 6; page++) {
      const d = await getJSON(`${MKT}/sales?state=3&schema_name=${SCHEMA}&limit=100&page=${page}&sort=updated&order=desc`);
      for (const s of d) {
        const pr = s.price || {}, amount = +pr.amount / 10 ** (+pr.token_precision || 0);
        for (const a of s.assets || []) {
          const tid = String(a.template?.template_id);
          if (!CHAIN.resales.has(tid)) CHAIN.resales.set(tid, []);
          CHAIN.resales.get(tid).push({ time: +s.updated_at_time, seller: s.seller, buyer: s.buyer, amount, sym: pr.token_symbol,
            fee: +(s.collection?.market_fee ?? 0), market: s.maker_marketplace, mint: a.template_mint, bundle: (s.assets || []).length });
        }
      }
      if (d.length < 100) break;
    }
    CHAIN.mktOk = true;
  } catch {}
}

/* XPR profiles (display name, avatar, verified) from eosio.proton */
const PROFILES = new Map();
function avatarSrc(b) {
  if (!b || typeof b !== "string") return "";
  const s = b.replace(/\s/g, ""); if (!/^[A-Za-z0-9+/=]+$/.test(s)) return "";
  const mime = s.startsWith("iVBOR") ? "image/png" : s.startsWith("R0lG") ? "image/gif" : s.startsWith("UklG") ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${s}`;
}
function profile(acc) {
  if (!isAcct(acc)) return Promise.resolve({ acc });
  if (!PROFILES.has(acc)) PROFILES.set(acc, fetch(`${RPC}/v1/chain/get_table_rows`, { method: "POST",
      body: JSON.stringify({ json: true, code: "eosio.proton", scope: "eosio.proton", table: "usersinfo", lower_bound: acc, upper_bound: acc, limit: 1 }) })
    .then(r => r.json()).then(j => { const r = j.rows?.[0]; return r && r.acc === acc ? { acc, name: String(r.name || ""), avatar: avatarSrc(r.avatar), verified: !!r.verified || (Array.isArray(r.kyc) && r.kyc.length > 0), kyc: Array.isArray(r.kyc) ? r.kyc.length : 0 } : { acc }; })
    .catch(() => ({ acc })));
  return PROFILES.get(acc);
}
const av = (acc, cls = "") => `<span class="av ${cls}" data-av="${esc(acc)}" style="--h:${hue(acc)}">${esc(String(acc || "?")[0].toUpperCase())}</span>`;
function hydrate(root = document) {
  $$("[data-av]:not([data-done])", root).slice(0, 60).forEach(el => {
    el.dataset.done = 1;
    profile(el.dataset.av).then(p => { if (p.avatar) el.innerHTML = `<img src="${esc(p.avatar)}" alt="">`; });
  });
  $$("[data-pname]:not([data-done])", root).forEach(el => {
    el.dataset.done = 1;
    profile(el.dataset.pname).then(p => { if (p.name) el.textContent = p.name; if (p.verified && el.dataset.tick !== undefined) el.insertAdjacentHTML("beforeend", `<span class="tick" title="KYC-verified XPR account">✓</span>`); });
  });
}
const acctLink = (acc, cls = "") => `<a class="${cls}" href="#/u/${enc(acc)}">${esc(acc)}</a>`;
const supChip = (acc, extra = "") => `<a class="sup" href="#/u/${enc(acc)}">${av(acc)}${esc(acc)}${extra}</a>`;

/* ---------- library store: playlists + liked songs (this browser for now) ---------- */
const likes = () => store.get("likes", []).map(String);
const isLiked = id => likes().includes(String(id));
const PL = {
  all() {
    let p = store.get("pl2", null);
    if (!p) { p = store.get("playlists", []).map(o => ({ id: uid(), name: String(o.name || "Playlist"), desc: "", ids: [...new Set((o.ids || []).map(String))], created: Date.now(), updated: Date.now() })); store.set("pl2", p); }
    return p;
  },
  save(p) { store.set("pl2", p); },
  get(id) { return id === "liked" ? { id: "liked", name: "Liked Songs", ids: likes(), liked: true } : PL.all().find(x => x.id === id); },
  create(name, ids = [], extra = {}) {
    const p = PL.all(), pl = { id: uid(), name: String(name).slice(0, 80), desc: "", ids: [...new Set(ids.map(String))], created: Date.now(), updated: Date.now(), ...extra };
    p.unshift(pl); PL.save(p); return pl;
  },
  update(id, fn) {
    if (id === "liked") { const pl = { ids: likes() }; fn(pl); store.set("likes", pl.ids); return; }
    const p = PL.all(), pl = p.find(x => x.id === id); if (!pl) return; fn(pl); pl.updated = Date.now(); PL.save(p);
  },
  remove(id) { PL.save(PL.all().filter(x => x.id !== id)); }
};
function toggleLike(id) {
  id = String(id); const t = byId.get(id); let l = likes();
  if (l.includes(id)) { l = l.filter(x => x !== id); toast("Removed from Liked Songs"); }
  else { l.unshift(id); toast(`Added “${t ? t.title : "song"}” to Liked Songs`); }
  store.set("likes", l); refreshHearts();
  if (location.hash === "#/pl/liked") route(true);
}
function refreshHearts() { $$("[data-like]").forEach(b => b.classList.toggle("on", isLiked(b.dataset.like))); }
function mosaic(ids, cls = "mosaic") {
  const imgs = [...new Set(ids.map(id => byId.get(String(id))?.img).filter(Boolean))].slice(0, 4);
  if (!imgs.length) return `<div class="${cls} empty">♪</div>`;
  if (imgs.length < 4) return `<div class="${cls}"><img src="${esc(ipfs(imgs[0]))}" alt=""></div>`;
  return `<div class="${cls} four">${imgs.map(i => `<img src="${esc(ipfs(i))}" alt="">`).join("")}</div>`;
}
const art = t => OFF.has(t.id) && navigator.serviceWorker?.controller ? `offline/art/${t.id}` : ipfs(t.img);
const recentTracks = () => store.get("recent", []).map(id => byId.get(String(id))).filter(Boolean);

/* ---------- player ---------- */
const P = { queue: [], i: -1, audio: null, g: 0, m: false, tok: 0, blob: "", ctx: "", cur() { return this.queue[this.i]; } };
// stream Vibrr's listening copy when the song has one (starts faster, far less data); the master WAV is the fallback
const srcOf = (t, g = 0, master = false) => ipfs((!master && t.listen) || t.audio, g);
function playQueue(tracks, start = 0, ctx = "") { tracks = tracks.filter(Boolean); if (!tracks.length) return; P.queue = tracks.slice(); P.ctx = ctx; P.i = Math.max(0, Math.min(start, tracks.length - 1)); loadTrack(); }
function shuffled(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function loadTrack() {
  const t = P.cur(); if (!t) return;
  P.g = 0; P.m = false; const tok = ++P.tok;
  if (P.blob) { URL.revokeObjectURL(P.blob); P.blob = ""; }
  const start = u => { if (tok !== P.tok) return; P.audio.src = u; P.audio.play().catch(() => {}); };
  // a song you saved offline plays from this device (served by the app itself); everything else streams from IPFS
  if (OFF.has(t.id) && navigator.serviceWorker?.controller) start(new URL(`offline/audio/${t.id}`, location.href).href);
  else if (OFF.has(t.id) && typeof offlineUrl === "function") offlineUrl(t.id).then(u => { if (u && tok === P.tok) { P.blob = u; start(u); } else start(srcOf(t, 0)); });
  else start(srcOf(t, 0));
  $("#p-title").textContent = t.title; $("#p-title").href = "#/passport/" + enc(t.id);
  $("#p-artist").textContent = `${t.artist} · ${P.ctx || t.release}`;
  if (typeof updateCollectBtn === "function") updateCollectBtn(t);
  $("#p-art").src = art(t); $("#p-pass").href = "#/passport/" + enc(t.id);
  $("#p-like").dataset.like = t.id; $("#p-save").dataset.save = t.id;
  const rec = store.get("recent", []).map(String).filter(x => x !== t.id); rec.unshift(t.id); store.set("recent", rec.slice(0, 50));
  markPlaying(); refreshHearts(); npRender();
}
function markPlaying() { const id = P.cur()?.id || ""; $$(".trk").forEach(el => el.classList.toggle("playing", el.dataset.id === id)); }
function initPlayer() {
  const a = P.audio = $("#audio");
  a.volume = 0.85;
  a.addEventListener("play", () => { $("#p-play").innerHTML = "&#10074;&#10074;"; document.body.classList.add("is-playing"); });
  a.addEventListener("pause", () => { $("#p-play").innerHTML = "&#9654;"; document.body.classList.remove("is-playing"); });
  a.addEventListener("error", () => {
    const t = P.cur(); if (!t || !a.src) return;
    if (a.src.startsWith("blob:") || a.src.includes("/offline/audio/")) { a.src = srcOf(t, 0); a.play().catch(() => {}); return; }
    // next gateway for the same file; once they're all tried (or it's a fixed URL), fall back from the listening copy to the master
    const next = P.g < GATEWAYS.length - 1 ? srcOf(t, P.g + 1, P.m) : "";
    if (next && next !== a.src) { P.g++; a.src = next; a.play().catch(() => {}); }
    else if (!P.m && t.listen) { P.m = true; P.g = 0; a.src = srcOf(t, 0, true); a.play().catch(() => {}); }
  });
  a.addEventListener("timeupdate", () => { $("#p-cur").textContent = fmt(a.currentTime); $("#p-dur").textContent = fmt(a.duration); if (a.duration) $("#p-seek").value = 1000 * a.currentTime / a.duration; });
  a.addEventListener("ended", () => { if (P.i < P.queue.length - 1) { P.i++; loadTrack(); } });
  $("#p-play").onclick = () => { if (!P.cur()) { if (RELEASES[0]) playQueue(RELEASES[0].tracks); return; } if (a.paused) a.play().catch(() => {}); else a.pause(); };
  $("#p-next").onclick = () => { if (P.i < P.queue.length - 1) { P.i++; loadTrack(); } };
  $("#p-prev").onclick = () => { if (a.currentTime > 4 || P.i <= 0) a.currentTime = 0; else { P.i--; loadTrack(); } };
  $("#p-seek").oninput = e => { if (a.duration) a.currentTime = a.duration * e.target.value / 1000; };
  $("#p-vol").oninput = e => a.volume = e.target.value / 100;
  a.addEventListener("play", npRender); a.addEventListener("pause", npRender); a.addEventListener("timeupdate", npTime);
}

/* ---------- Now Playing: the full-screen player (tap the artwork; Back, Esc or the arrow closes it) ---------- */
const NP = { open: false, view: "queue" };
const cssUrl = u => `url("${String(u || "").replace(/["\\\n\r]/g, encodeURIComponent)}")`;
function npRender() {
  if (!NP.open) return;
  const t = P.cur(), a = P.audio;
  $("#np").classList.toggle("paused", !t || a.paused);
  $("#np-play").innerHTML = a.paused ? "&#9654;" : "&#10074;&#10074;";
  if (!t) return;
  const src = $("#p-art").src || ipfs(t.img);
  if ($("#np-art").src !== src) { $("#np-art").src = src; $("#np-bg").style.backgroundImage = cssUrl(src); }
  $("#np-title").textContent = t.title; $("#np-title").href = "#/passport/" + enc(t.id);
  $("#np-artist").textContent = `${t.artist} · ${t.release}`; $("#np-artist").href = "#/release/" + enc(t.key);
  $("#np-ctx").textContent = P.ctx || t.release || "Now playing";
  $("#np-pass").href = "#/passport/" + enc(t.id);
  $("#np-like").dataset.like = t.id; $("#np-save").dataset.save = t.id;
  $$(".np-tabs [data-npv]").forEach(b => b.classList.toggle("on", b.dataset.npv === NP.view));
  if (NP.view === "lyrics") {
    const L = lyricsOf(t);
    $("#np-queue").innerHTML = L.lyrics ? `<div class="np-lyrics">${L.lyrics.split(/\n/).map(l => l.trim() ? `<p>${esc(l)}</p>` : `<p class="gap"></p>`).join("")}</div>${L.story ? `<div class="np-story"><b>The story behind the song</b>${esc(L.story)}</div>` : ""}`
      : `<div class="small" style="color:rgba(255,255,255,.65)">No lyrics for “${esc(t.title)}” yet. When ${esc(t.artist)} adds them, they appear here.</div>`;
    refreshHearts(); return;
  }
  const up = P.queue.slice(P.i + 1, P.i + 40);
  $("#np-queue").innerHTML = up.length ? up.map((x, k) => `<button class="np-qi" data-npq="${P.i + 1 + k}"><img src="${esc(ipfs(x.img))}" alt=""><span><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span></button>`).join("")
    : `<div class="small" style="color:rgba(255,255,255,.6)">Nothing queued after this song.</div>`;
  refreshHearts();
}
function npTime() {
  if (!NP.open) return; const a = P.audio;
  $("#np-cur").textContent = fmt(a.currentTime); $("#np-dur").textContent = fmt(a.duration);
  if (a.duration && !NP.seeking) $("#np-seek").value = 1000 * a.currentTime / a.duration;
}
function npOpen() {
  if (NP.open || !P.cur()) return;
  NP.open = true; $("#np").hidden = false; document.body.classList.add("np-open");
  history.pushState({ np: 1 }, "", location.href);                     // so the phone's Back gesture closes it
  npRender(); npTime();
}
function npClose(fromPop) {
  if (!NP.open) return;
  NP.open = false; $("#np").hidden = true; document.body.classList.remove("np-open");
  if (!fromPop && history.state?.np) history.back();
}
function initNP() {
  $("#p-open").onclick = npOpen;
  // phones: tapping the mini player opens Now Playing (like Apple Music); desktop keeps the title link
  $(".p-meta").addEventListener("click", e => { if (matchMedia("(max-width:820px)").matches && P.cur()) { e.preventDefault(); npOpen(); } });
  $("#np-close").onclick = () => npClose();
  $$(".np-tabs [data-npv]").forEach(b => b.onclick = () => { NP.view = b.dataset.npv; npRender(); });
  $("#np-play").onclick = () => $("#p-play").click();
  $("#np-prev").onclick = () => $("#p-prev").click();
  $("#np-next").onclick = () => $("#p-next").click();
  const sk = $("#np-seek");
  sk.oninput = () => { NP.seeking = true; const a = P.audio; if (a.duration) a.currentTime = a.duration * sk.value / 1000; };
  sk.onchange = () => NP.seeking = false;
  $("#np").addEventListener("click", e => {
    const q = e.target.closest("[data-npq]"); if (q) { P.i = +q.dataset.npq; loadTrack(); return; }
    const l = e.target.closest("a[href^='#/']"); if (!l) return;
    // a link inside Now Playing: swap the Now Playing history entry for the page, so Back stays clean
    e.preventDefault(); const href = l.getAttribute("href");
    NP.open = false; $("#np").hidden = true; document.body.classList.remove("np-open");
    if (history.state?.np) { history.replaceState(null, "", href); route(); } else location.hash = href;
  });
  window.addEventListener("popstate", () => { if (NP.open && !history.state?.np) npClose(true); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && NP.open && !$(".modal-bg")) npClose(); });
  // Back goes exactly where its label says (our own trail, not the browser's raw history)
  $("#back-btn").onclick = () => { const prev = NAV.stack[NAV.stack.length - 2]; if (prev) { NAV.restore = true; location.hash = prev.h; } else history.back(); };
}

/* ---------- shared UI ---------- */
function toast(msg, act) {
  $(".toast")?.remove();
  const n = document.createElement("div"); n.className = "toast";
  n.innerHTML = `<span>${esc(msg)}</span>${act ? `<button>${esc(act.label)}</button>` : ""}`;
  if (act) n.querySelector("button").onclick = () => { act.fn(); n.remove(); };
  document.body.append(n); setTimeout(() => n.remove(), act ? 6000 : 2600);
}
function copy(text, msg = "Copied") { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg)).catch(() => toast(text)); }
/* share anywhere: link, socials, and an embeddable player for any website */
function shareModal(title, url, note = "") {
  const embedUrl = url.replace(/^([^#?]*)(\?[^#]*)?(#.*)?$/, (m, base, q, h) => `${base}?embed=1${h || ""}`);
  const code = `<iframe src="${embedUrl}" width="100%" height="460" style="border:0;border-radius:16px" allow="autoplay" loading="lazy" title="${title.replace(/"/g, "'")}"></iframe>`;
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const m = modal(`<div class="m-head"><div><h3>Share</h3><div class="muted small">${esc(title)}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      ${note ? `<div class="note" style="margin:0">${note}</div>` : ""}
      <div class="share-row"><input readonly value="${esc(url)}"><button class="btn sm" id="sh-copy">Copy link</button></div>
      <div class="share-btns">
        <a class="btn ghost sm" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}">X</a>
        <a class="btn ghost sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}">Facebook</a>
        <a class="btn ghost sm" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(title + " " + url)}">WhatsApp</a>
        <a class="btn ghost sm" target="_blank" rel="noopener" href="https://t.me/share/url?url=${enc(url)}&text=${enc(title)}">Telegram</a>
      </div>
      <label>Embed a player on your website<textarea readonly rows="3" class="mono" style="font-size:12px">${esc(code)}</textarea></label>
      <div class="actions" style="margin:0"><button class="btn ghost sm" id="sh-embed">Copy embed code</button><a class="btn ghost sm" target="_blank" rel="noopener" href="${esc(embedUrl)}">Preview the player ↗</a></div>
      ${local ? `<p class="muted small" style="margin:0">Running on this Mac for now: links and embeds work for other people once Splendor Music is online (the hosting step).</p>` : ""}
    </div>`, "wide");
  $("#sh-copy", m).onclick = () => copy(url, "Link copied");
  $("#sh-embed", m).onclick = () => copy(code, "Embed code copied");
}
let MODAL_DIRTY = false;
function modal(inner, cls = "") {
  closeModal();
  const m = document.createElement("div"); m.className = "modal-bg";
  m.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${inner}</div>`;
  m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-mclose]")) closeModal(); });
  document.body.append(m); return m;
}
function closeModal() {
  const m = $(".modal-bg"); if (!m) return; m.remove();
  if (MODAL_DIRTY) { MODAL_DIRTY = false; route(true); }
}
const notFound = () => view().innerHTML = `<div class="empty-state"><b>Not found</b><a href="#/">Back to Discover</a></div>`;

const relCard = r => `<a class="card" href="#/release/${enc(r.key)}"><div class="art"><img loading="lazy" src="${esc(ipfs(r.img))}" alt=""><button class="fab" data-playrel="${esc(r.key)}" title="Play ${esc(r.title)}">&#9654;</button></div><div class="c"><div class="t">${esc(r.title)}</div><div class="a">${esc(r.artist)} · ${plural(r.tracks.length, "track")}</div></div></a>`;
const plCard = p => `<a class="card" href="#/pl/${enc(p.id)}"><div class="art">${p.liked ? `<div class="mosaic liked">&#9829;</div>` : mosaic(p.ids)}${p.ids.length ? `<button class="fab" data-playpl="${esc(p.id)}" title="Play">&#9654;</button>` : ""}</div><div class="c"><div class="t">${esc(p.name)}</div><div class="a">${p.liked ? "Collection" : "Playlist"} · ${plural(p.ids.length, "song")}${p.curator ? ` · by ${esc(p.curator)}` : ""}</div></div></a>`;
const artistCard = a => `<a class="card artist-card" href="#/artist/${enc(a.name)}"><img loading="lazy" src="${esc((typeof profileOf === "function" && imgUrl(profileOf(a.name).avatar)) || ipfs(a.img))}" alt=""><div class="c"><div class="t">${esc(a.name)}${a.verified ? `<span class="vtick" title="ID-verified artist">✓</span>` : ""}</div><div class="a">${plural(songCount(a), "song")} · ${a.collected.toLocaleString()} collected</div></div></a>`;

/* one track row: number/play, title + artist, release or meta, like / save / Passport (/ remove) */
function trackRow(t, i, o = {}) {
  return `<div class="trk${P.cur()?.id === t.id ? " playing" : ""}" data-id="${esc(t.id)}"${o.drag ? ` draggable="true" data-idx="${i}"` : ""}>
    <span class="n"><span class="num">${i + 1}</span><button class="rowplay" data-play="${i}" title="Play">&#9654;</button></span>
    <span class="ti">${o.thumb ? `<img class="th" loading="lazy" src="${esc(art(t))}" alt="">` : ""}<span><button class="tt" data-play="${i}">${esc(t.title)}${lyricsOf(t).lyrics ? `<span class="lyr-badge" title="Lyrics">LYRICS</span>` : ""}</button>${o.artist ? `<a class="sub" href="#/artist/${enc(t.artist)}">${esc(t.artist)}</a>` : ""}</span></span>
    ${o.release ? `<a class="rel muted" href="#/release/${enc(t.key)}">${esc(t.release)}</a>` : `<span class="rel muted mono">${o.meta ? esc(o.meta(t)) : ""}</span>`}
    <span class="acts">${o.extra || ""}
      ${OWN.has(t.id) ? `<button class="ic off${OFF.has(t.id) ? " on" : ""}" data-offline="${esc(t.id)}" title="${OFF.has(t.id) ? "Saved offline (click to remove)" : "You own this: save offline"}">⤓</button>` : ""}
      <button class="ic like${isLiked(t.id) ? " on" : ""}" data-like="${esc(t.id)}" title="Like">&#9829;</button>
      <button class="ic" data-save="${esc(t.id)}" title="Save to playlist">+</button>
      <a class="ic pass" href="#/passport/${enc(t.id)}" title="Music Passport">Passport</a>
      ${o.remove ? `<button class="ic" data-remove="${i}" title="Remove from this playlist">&#10005;</button>` : ""}
    </span></div>`;
}
const listHead = (third = "Release") => `<div class="list-head"><span>#</span><span>Title</span><span>${third}</span><span></span></div>`;

/* ---------- Save to playlist (Spotify / YouTube style) ---------- */
function saveTo(tracks, label) {
  tracks = tracks.filter(Boolean); if (!tracks.length) return;
  const ids = tracks.map(t => t.id);
  label = label || (tracks.length === 1 ? `“${tracks[0].title}” · ${tracks[0].artist}` : plural(tracks.length, "song"));
  const m = modal(`<div class="m-head"><div><h3>Save to…</h3><div class="muted small">${esc(label)}</div></div><button class="x" data-mclose title="Close">&times;</button></div>
    <div class="m-list" id="m-list"></div>
    <div class="m-new" id="m-new"></div>
    <div class="m-foot"><button class="btn" data-mclose>Done</button></div>`);
  const render = () => {
    const lists = [PL.get("liked"), ...PL.all()];
    $("#m-list", m).innerHTML = lists.map(p => {
      const have = ids.filter(i => p.ids.includes(i)).length, st = have === 0 ? "" : have === ids.length ? "all" : "some";
      return `<button class="m-row" data-pid="${esc(p.id)}">${p.liked ? `<div class="mosaic sm liked">&#9829;</div>` : mosaic(p.ids, "mosaic sm")}
        <span class="m-name"><b>${esc(p.name)}</b><span class="muted">${p.liked ? "Liked Songs" : "Playlist"} · ${plural(p.ids.length, "song")}</span></span><span class="check ${st}"></span></button>`;
    }).join("");
    $$("[data-pid]", m).forEach(b => b.onclick = () => toggle(b.dataset.pid));
  };
  const toggle = pid => {
    const p = PL.get(pid), all = ids.every(i => p.ids.includes(i));
    PL.update(pid, pl => { pl.ids = all ? pl.ids.filter(i => !ids.includes(i)) : (pid === "liked" ? [...ids.filter(i => !pl.ids.includes(i)), ...pl.ids] : [...pl.ids, ...ids.filter(i => !pl.ids.includes(i))]); });
    MODAL_DIRTY = true; toast(all ? `Removed from ${p.name}` : `Saved to ${p.name}`); render(); refreshHearts();
  };
  const newBtn = () => {
    $("#m-new", m).innerHTML = `<button class="m-newbtn" id="m-newbtn"><span class="plus">+</span>New playlist</button>`;
    $("#m-newbtn", m).onclick = () => {
      $("#m-new", m).innerHTML = `<div class="m-create"><input id="m-name" maxlength="80" placeholder="Playlist name"><input id="m-desc" maxlength="200" placeholder="Description (optional)">
        <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost sm" id="m-cancel">Cancel</button><button class="btn sm" id="m-create">Create</button></div></div>`;
      const n = $("#m-name", m); n.focus();
      const make = () => { const v = n.value.trim(); if (!v) { n.focus(); return; } const pl = PL.create(v, ids, { desc: $("#m-desc", m).value.trim() }); MODAL_DIRTY = true; toast(`Created “${pl.name}” and saved`); render(); newBtn(); };
      $("#m-create", m).onclick = make; $("#m-cancel", m).onclick = newBtn;
      n.onkeydown = $("#m-desc", m).onkeydown = e => { if (e.key === "Enter") make(); };
    };
  };
  render(); newBtn();
}

/* ---------- account (prototype: type your XPR account; live version = WebAuth sign-in) ---------- */
function renderMe() {
  const b = $("#me-btn"), m = me(), v = typeof verified === "function" && verified();
  b.className = "me-chip" + (m ? "" : " empty");
  b.innerHTML = m ? `${av(m)}<span>${esc(m)}</span>${v ? `<span class="tick" title="Signed in with WebAuth">✓</span>` : ""}` : "Sign in";
  hydrate(b);
}
function accountMenu() {
  const cur = me(), v = typeof verified === "function" && verified();
  const m = modal(`<div class="m-head"><div><h3>${cur ? esc(cur) : "Sign in"}</h3><div class="muted small">${v ? "Signed in with WebAuth ✓" : cur ? "Viewing as this account (not verified)" : "Your Library, Corner, collection and share links follow your XPR account."}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      ${v ? "" : `<button class="btn big" id="wa-in" style="justify-content:center">Sign in with WebAuth</button><div class="err" id="wa-err"></div>`}
      <details${cur && !v ? " open" : ""}><summary class="muted small" style="cursor:pointer">Or just look around as an account (no signing)</summary>
        <div style="display:flex;gap:8px;margin-top:10px"><input id="me-in" placeholder="e.g. splendor" value="${esc(cur)}" maxlength="12" autocomplete="off" spellcheck="false"><button class="btn ghost" id="me-save">View</button></div>
        <div class="err" id="me-err"></div></details>
    </div>
    <div class="m-foot">${cur ? `<a class="btn ghost" href="#/u/${enc(cur)}" data-mclose>Open My Corner</a><button class="btn ghost" id="me-out">Sign out</button>` : ""}<button class="btn ghost" data-mclose>Close</button></div>`);
  const inp = $("#me-in", m);
  const save = () => {
    const val = inp.value.trim().toLowerCase();
    if (!isAcct(val)) { $("#me-err", m).textContent = "XPR accounts are 1–12 characters: a–z, 1–5 and dots."; return; }
    store.set("me", val); renderMe(); if (typeof loadOwned === "function") loadOwned(); MODAL_DIRTY = true; closeModal(); toast(`Viewing as ${val}`);
  };
  $("#me-save", m).onclick = save; inp.onkeydown = e => { if (e.key === "Enter") save(); };
  if ($("#wa-in", m)) $("#wa-in", m).onclick = async () => {
    const b = $("#wa-in", m); b.disabled = true; b.textContent = "Opening WebAuth…";
    try { const s = await waConnect(false); if (!s) throw new Error("Sign-in was cancelled."); MODAL_DIRTY = true; closeModal(); toast(`Signed in as ${me()} ✓`); }
    catch (e) { b.disabled = false; b.textContent = "Sign in with WebAuth"; $("#wa-err", m).textContent = String(e?.message || e).slice(0, 200); }
  };
  if (cur) $("#me-out", m).onclick = async () => { if (typeof waLogout === "function") await waLogout(); store.set("me", ""); OWN.clear(); renderMe(); MODAL_DIRTY = true; closeModal(); };
}

/* ---------- Discover ---------- */
function home() {
  const minted = TRACKS.reduce((n, t) => n + (t.issued || 0), 0);
  const recRels = [...new Set(recentTracks().map(t => t.key))].map(k => relByKey.get(k)).filter(Boolean).slice(0, 6);
  const most = RELEASES.slice().sort((a, b) => relCollected(b) - relCollected(a)).slice(0, 6);
  const rising = ARTISTS.slice().sort((a, b) => a.collected - b.collected).slice(0, 6);
  const gc = new Map();
  TRACKS.forEach(t => String(t.d.genre || "").split(/[|,/]/).map(g => g.trim()).filter(g => g && g.length < 24).forEach(g => gc.set(g, (gc.get(g) || 0) + 1)));
  const genres = [...gc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(x => x[0]);
  view().innerHTML = `
    <section class="hero"><div class="eyebrow">Splendor Music</div>
      <h1>Hear it. Own it. Pass it on.</h1>
      <p class="hero-sub">Music you keep, from artists you pay directly.</p>
      <div class="verified-line"><span>✓</span> Every artist here is ID-verified. No imposters, no fakes.</div>
      <p>Every song comes with its Music Passport: who made it, who owns it, who gets paid. Artists release on Vibrr, you listen here, and when you share it, everyone who helped earns.</p>
      <div class="stats"><div class="stat"><b>${RELEASES.length}</b><span>releases</span></div><div class="stat"><b>${TRACKS.length}</b><span>songs</span></div><div class="stat"><b>${ARTISTS.length}</b><span>artists</span></div><div class="stat"><b>${minted.toLocaleString()}</b><span>copies collected</span></div></div></section>
    ${recRels.length ? `<div class="row-head"><h2>Jump back in</h2></div><div class="grid">${recRels.map(relCard).join("")}</div>` : ""}
    <div class="row-head"><h2>Latest releases</h2><span class="muted">${plural(RELEASES.length, "release")}</span></div>
    <div class="chips" id="genres"><button class="chip on" data-g="">All</button>${genres.map(g => `<button class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
    <div class="grid" id="latest">${RELEASES.map(relCard).join("")}</div>
    <div class="two" style="margin-top:34px">
      <div><h2>Most collected</h2>${most.map((r, i) => `<a class="rank-row" href="#/release/${enc(r.key)}"><span class="k">${i + 1}</span><img loading="lazy" src="${esc(ipfs(r.img))}" alt=""><span><b>${esc(r.title)}</b><br><span class="muted small">${esc(r.artist)}</span></span><span class="muted small">${plural(relCollected(r), "copy", "copies")}</span></a>`).join("")}</div>
      <div><h2>Just collected</h2><div id="feed"><span class="muted">Loading…</span></div></div>
    </div>
    <div class="row-head"><h2>Artists to discover</h2><a class="muted" href="#/artists">All artists</a></div>
    <div class="grid">${rising.map(artistCard).join("")}</div>
    ${typeof radioStations === "function" ? `<div class="row-head"><h2>Splendor Radio</h2><a class="muted" href="#/radio">Free listening →</a></div><div class="grid">${radioStations().slice(0, 4).map(stationCard).join("")}</div>` : ""}
    <a class="econ-banner" href="#/playlists"><div><div class="eyebrow">For curators</div><h2>Good taste pays</h2><div class="muted">Build playlists, answer the weekly brief, and earn when listeners collect the songs you found.</div></div><span class="btn">Become a curator</span></a>
    <div class="foot">Splendor Music · concept and product design by Lachlan Grant Splendor · live data from the XPR Network · <a href="#/trust" style="color:var(--accent)">Trust &amp; safety</a></div>`;
  $$("#genres [data-g]").forEach(b => b.onclick = () => {
    $$("#genres .chip").forEach(c => c.classList.toggle("on", c === b));
    const g = b.dataset.g.toLowerCase();
    $("#latest").innerHTML = RELEASES.filter(r => !g || r.tracks.some(t => String(t.d.genre || "").toLowerCase().split(/[|,/]/).map(x => x.trim()).includes(g))).map(relCard).join("");
  });
  feed($("#feed"));
}
async function feed(el) {
  try {
    const d = await getJSON(`${API}/assets?schema_name=${SCHEMA}&sort=minted&order=desc&limit=60`);
    const seen = new Set(), rows = [];
    for (const a of d) {
      const t = byId.get(String(a.template?.template_id)), k = a.owner + "|" + (t && t.id);
      if (!t || !a.owner || seen.has(k)) continue; seen.add(k); rows.push({ a, t }); if (rows.length >= 7) break;
    }
    if (!el.isConnected) return;
    el.innerHTML = rows.map(({ a, t }) => `<div class="feed-row">${av(a.owner, "md")}<div>${artistNameFor(a.owner) ? `<a href="#/artist/${enc(artistNameFor(a.owner))}">${esc(artistNameFor(a.owner))}</a>` : acctLink(a.owner)} collected <a href="#/passport/${enc(t.id)}"><b>${esc(t.title)}</b></a><br><span class="muted small">${esc(t.artist)} · #${esc(a.template_mint)} · ${ago(+a.minted_at_time)}</span></div><img src="${esc(ipfs(t.img))}" alt=""></div>`).join("") || `<span class="muted">No collects yet.</span>`;
    hydrate(el);
  } catch { if (el.isConnected) el.innerHTML = `<span class="muted">Couldn't reach the chain right now.</span>`; }
}

function search(q) {
  const f = q.toLowerCase();
  const songs = TRACKS.filter(t => (t.title + " " + t.artist + " " + t.release).toLowerCase().includes(f)).slice(0, 30);
  const rels = RELEASES.filter(r => (r.title + " " + r.artist).toLowerCase().includes(f));
  const arts = ARTISTS.filter(a => a.name.toLowerCase().includes(f));
  LISTS.search = songs;
  view().innerHTML = `<h1>Results for “${esc(q)}”</h1>
    ${arts.length ? `<div class="row-head"><h2>Artists</h2></div><div class="grid">${arts.slice(0, 6).map(artistCard).join("")}</div>` : ""}
    <div class="row-head"><h2>Songs</h2><span class="muted">${plural(songs.length, "song")}</span></div>
    ${songs.length ? `${listHead()}<div class="tracks" data-list="search">${songs.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1 })).join("")}</div>` : `<p class="muted">No songs match.</p>`}
    ${rels.length ? `<div class="row-head"><h2>Releases</h2></div><div class="grid">${rels.map(relCard).join("")}</div>` : ""}`;
}

function artists() {
  view().innerHTML = `<div class="row-head" style="margin-top:0"><h1 style="margin:0">Artists</h1><span class="muted">${ARTISTS.length} artists</span></div>
    <div class="grid">${ARTISTS.map(artistCard).join("")}</div>
    <a class="artist-door" href="#/for-artists" style="margin-top:34px"><span><b>Are you an artist?</b> Your page here is free, forever: music, lyrics, videos and links, and you get paid the moment a fan collects.</span><span class="btn sm">See how</span></a>`;
}
/* ---------- artist profiles: profiles.js + the artist's own edits on this device ---------- */
function profileOf(name) {
  const base = (typeof ARTIST_PROFILES !== "undefined" && ARTIST_PROFILES[name]) || {}, mine = store.get("profile:" + name, null) || {};
  return { ...base, ...mine, links: { ...(base.links || {}), ...(mine.links || {}) }, lyrics: { ...(base.lyrics || {}), ...(mine.lyrics || {}) },
           stories: { ...(base.stories || {}), ...(mine.stories || {}) }, releaseDates: { ...(base.releaseDates || {}), ...(mine.releaseDates || {}) } };
}
const imgUrl = s => !s ? "" : /^(img|icons)\/[\w./-]+$/.test(s) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : ipfs(s);   // our asset, an upload, an IPFS CID or an https image
const safeHref = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
function lyricsOf(t) { const p = profileOf(t.artist); return { lyrics: String(p.lyrics?.[t.id] || t.d.lyrics || "").trim(), story: String(p.stories?.[t.id] || "").trim() }; }
// credits: what the artist wrote here for this song, else for its whole release, else what was minted
const parseCreditLines = txt => String(txt || "").split(/\n/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^([^:]{1,40}):\s*(.+)$/); return m ? { role: m[1].trim(), who: m[2].trim() } : { role: "Credit", who: l }; });
function creditsOf(t) { const p = profileOf(t.artist), own = p.credits?.[t.id] || p.albumCredits?.[t.release]; return own ? parseCreditLines(own) : parseCredits(t.d.credits); }
const creditText = t => creditsOf(t).map(c => `${c.role}: ${c.who}`).join("\n");
const artistOf = t => ARTISTS.find(a => a.name === t.artist);
const isArtistOwner = a => { const m = me(); return !!(m && a && a.accounts.has(m)); };
const relDateOf = r => String(r.released || profileOf(r.artist).releaseDates?.[r.title] || new Date(r.created).toISOString().slice(0, 10));
const relDateKnown = r => !!(r.released || profileOf(r.artist).releaseDates?.[r.title]);
const relYear = r => relDateKnown(r) ? relDateOf(r).slice(0, 4) : `minted ${relDateOf(r).slice(0, 4)}`;
const relKind = r => r.tracks.length >= 7 ? "Album" : r.tracks.length >= 4 ? "EP" : "Single";
const follows = () => store.get("follows", []);
const genresOf = a => new Set(a.releases.flatMap(r => r.tracks).flatMap(t => String(t.d.genre || "").toLowerCase().split(/[|,/]/).map(x => x.trim()).filter(Boolean)));
const LINK_ICON = { spotify: "♫", apple: "♪", bandcamp: "◗", youtube: "▶", instagram: "◎", facebook: "f", x: "𝕏", tiktok: "♪", website: "↗", soundcloud: "☁", telegram: "✈", vibrr: "◆" };
const linkPills = links => links.map(([k, u]) => `<a class="lpill" target="_blank" rel="noopener" href="${esc(u)}"><span>${LINK_ICON[k] || "↗"}</span>${esc((typeof LINK_NAMES !== "undefined" && LINK_NAMES[k]) || k)}</a>`).join("");

function artist(name) {
  const a = ARTISTS.find(x => x.name === name); if (!a) return notFound();
  const p = profileOf(a.name), all = a.releases.flatMap(r => r.tracks); LISTS.artist = all;
  const plays = t => VR.byId.get(t.id)?.plays || 0, vrPlays = all.reduce((n, t) => n + plays(t), 0);
  const popular = all.slice().sort((x, y) => (plays(y) + 4 * (y.issued || 0)) - (plays(x) + 4 * (x.issued || 0))).slice(0, 10); LISTS.popular = popular;
  const popMeta = t => [plays(t) ? plural(plays(t), "play") : "", t.issued ? `${t.issued} collected` : ""].filter(Boolean).join(" · ");
  const rels = a.releases.slice().sort((x, y) => relDateOf(y).localeCompare(relDateOf(x)));
  const pickRel = p.pick?.release && a.releases.find(r => r.title.toLowerCase() === String(p.pick.release).toLowerCase());
  const owner = isArtistOwner(a), fol = follows().includes(a.name);
  const banner = imgUrl(p.banner), avatar = imgUrl(p.avatar) || ipfs(a.img);
  const links = Object.entries(p.links || {}).map(([k, u]) => [k, safeHref(u)]).filter(([, u]) => u);
  const g = genresOf(a), fans = ARTISTS.filter(x => x !== a && [...genresOf(x)].some(y => g.has(y))).slice(0, 6);
  const norm = x => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""), here = new Set(a.releases.map(r => norm(r.title)));
  const photos = photoList(p);
  const notYet = (p.notYet || []).filter(e => e && e.title && !here.has(norm(e.title)));   // once it's minted here, it drops off
  const asks = store.get("asks", []), askKey = e => a.name + "|" + e.title;
  const videos = (p.videos || []).map(v => ({ id: String(v.id || "").match(/^[\w-]{11}$/)?.[0], title: String(v.title || ""), kind: String(v.kind || "") })).filter(v => v.id).slice(0, 24);
  const vidCard = v => `<button class="vid" data-yt="${esc(v.id)}" title="${esc(v.title)}"><img loading="lazy" src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt=""><span class="vplay">&#9654;</span><span class="vt">${esc(v.title)}${v.kind ? `<small>${esc(v.kind)}</small>` : ""}</span></button>`;
  const social = links.filter(([k]) => !(typeof STREAMING !== "undefined" ? STREAMING : []).includes(k)), streaming = links.filter(([k]) => (typeof STREAMING !== "undefined" ? STREAMING : []).includes(k));
  const card = (r, label) => `<a class="pick-card" href="#/release/${enc(r.key)}"><img src="${esc(ipfs(r.img))}" alt=""><span><span class="eyebrow">${label}</span><b>${esc(r.title)}</b><small>${relKind(r)} · ${esc(relYear(r))} · ${plural(r.tracks.length, "song")}</small>${label === "Artist Pick" && p.pick?.note ? `<em>“${esc(p.pick.note)}”</em>` : ""}</span></a>`;
  const discCards = k => [
    ...(rels.filter(r => !k || relKind(r) === k).map(r => `<a class="card" href="#/release/${enc(r.key)}"><div class="art"><img loading="lazy" src="${esc(ipfs(r.img))}" alt=""><button class="fab" data-playrel="${esc(r.key)}" title="Play ${esc(r.title)}">&#9654;</button></div><div class="c"><div class="t">${esc(r.title)}</div><div class="a">${esc(relYear(r))} · ${relKind(r)}</div></div></a>`))
  ].join("") || `<p class="muted">Nothing here yet.</p>`;
  view().innerHTML = `
  <section class="artist-hero${banner ? " has-banner" : ""}" style="--ab:${esc(cssUrl(banner || ipfs(a.img)))}">
    <div class="ah-in"><img class="ah-av" src="${esc(avatar)}" alt="">
      <div class="ah-txt"><div class="eyebrow">Artist${p.bio ? " · page by the artist" : ""}</div>
        <h1 class="ah-name">${esc(a.name)}</h1>
        ${p.tagline || p.location ? `<div class="ah-tag">${esc([p.tagline, p.location].filter(Boolean).join(" · "))}</div>` : ""}
        <div class="ah-stats"><span><b>${songCount(a)}</b> songs</span><span><b>${a.releases.length}</b> releases</span><span><b>${a.collected.toLocaleString()}</b> collected</span>${vrPlays ? `<span><b>${vrPlays.toLocaleString()}</b> Vibrr Radio plays</span>` : ""}</div></div></div>
  </section>
  <div class="actions ah-actions"><button class="btn big" id="play-artist">&#9654; Play</button><button class="btn ghost" id="shuf-artist">&#8644; Shuffle</button>
    <button class="btn ghost${fol ? " on" : ""}" id="follow">${fol ? "✓ Following" : "+ Follow"}</button><button class="btn ghost" id="share-artist">Share</button>
    </div>
  ${owner ? `<div class="tools"><div class="tools-h"><b>Your artist tools</b><span class="muted small">Only you see this</span></div><div class="tools-grid">
    <button data-tool="edit"><span>✎</span><b>Edit your page</b><small>Photos, bio, links, videos</small></button>
    <button data-tool="songs"><span>♪</span><b>Lyrics, credits and stories</b><small>For every song</small></button>
    <button data-tool="share"><span>⤴</span><b>Share your page</b><small>Put it in your Instagram and Spotify bio</small></button>
    <div class="soon"><span>◎</span><b>Merch and collectables</b><small>Coming soon</small></div>
    <div class="soon"><span>🎟</span><b>Tour dates and tickets</b><small>Coming soon</small></div>
    <div class="soon"><span>⤓</span><b>Press kit</b><small>Full-size photos, bio and music for press, on request. Coming soon</small></div>
    <a href="#/for-artists"><span>★</span><b>Everything you can do here</b><small>For artists</small></a></div></div>` : ""}
  <div class="subtabs"><button data-jump="popular" class="on">Popular</button><button data-jump="discography">Discography</button>${(p.videos || []).length ? `<button data-jump="videos">Videos</button>` : ""}<button data-jump="about">About</button>${fans.length ? `<button data-jump="fans">Fans also like</button>` : ""}</div>
  <div class="ah-top" id="popular">
    <div><h2>Popular</h2><div class="tracks" data-list="popular" id="pop-list">${popular.slice(0, 5).map((t, i) => trackRow(t, i, { thumb: 1, meta: popMeta })).join("")}</div>
      ${popular.length > 5 ? `<button class="btn ghost sm" id="pop-more">Show 5 more</button>` : ""}</div>
    <div class="ah-side">${pickRel ? card(pickRel, "Artist Pick") : ""}${(() => {
      // latest release on Splendor Music (a real release date beats a mint date)
      const latest = rels.filter(relDateKnown)[0] || rels[0];
      return latest && latest !== pickRel ? card(latest, "Latest release") : "";
    })()}</div>
  </div>
  <div class="row-head" id="discography"><h2>Discography</h2></div>
  <div class="chips" id="disc-chips"><button class="chip on" data-k="">All</button>${["Album", "EP", "Single"].filter(k => rels.some(r => relKind(r) === k)).map(k => `<button class="chip" data-k="${k}">${k === "Album" ? "Albums" : k === "EP" ? "EPs" : "Singles"}</button>`).join("")}</div>
  <div class="grid" id="disc">${discCards("")}</div>
  ${notYet.length ? `<div class="row-head" id="notyet"><div><h2>More music</h2><div class="muted small">Not here yet. Ask for it and ${esc(a.name)} will know you're keen.</div></div></div>
  <div class="notyet">${notYet.map(e => { const on = asks.includes(askKey(e));
    return `<div class="ny"><img loading="lazy" src="${esc(imgUrl(e.img))}" alt=""><span class="ny-t"><b>${esc(e.title)}</b><small>${esc(e.type || "Release")} · ${esc(String(e.released || "").slice(0, 4))}</small></span>
      <button class="btn ${on ? "ghost on" : "ghost"} sm" data-ask="${esc(askKey(e))}">${on ? "✓ Asked" : "Ask for it"}</button></div>`; }).join("")}</div>` : ""}
  ${videos.length ? `<div class="row-head" id="videos"><h2>Videos</h2>${videos.length > 4 ? `<span class="muted small">${videos.length} videos</span>` : ""}</div><div class="videos" id="vids">${videos.slice(0, 4).map(vidCard).join("")}</div>
    ${videos.length > 4 ? `<button class="btn ghost sm" id="vids-more" style="margin-top:14px">Show all ${videos.length} videos</button>` : ""}` : ""}
  <div class="row-head" id="about"><h2>About</h2></div>
  <div class="about-grid">
    <div class="panel about-main">
      ${photos.length ? `<div class="gallery">${photos.map((ph, i) => `<button class="gimg" data-ph="${i}" title="Open photo"><img loading="lazy" src="${esc(ph.src)}" alt=""></button>`).join("")}</div>` : ""}
      ${p.bio ? `<div class="bio">${esc(p.bio)}</div>` : `<p class="muted">${esc(a.name)} hasn't written a bio yet.${owner ? " Add one with Edit artist page." : ""}</p>`}
      ${p.location ? `<div class="muted small" style="margin-top:12px">📍 ${esc(p.location)}</div>` : ""}
      ${social.length ? `<div class="sub-h" style="margin-top:18px">Follow</div><div class="lpills" id="ab-links">${linkPills(social)}</div>` : `<div class="lpills" id="ab-links"></div>`}
      ${streaming.length ? `<div class="sub-h" style="margin-top:14px">Also on</div><div class="lpills">${linkPills(streaming)}</div>` : ""}</div>
    <div class="panel"><h3 style="margin-top:0">Support ${esc(a.name)}</h3>
      <p class="muted" style="margin-top:0">Collect a song and ${esc(a.name)} is paid straight away. You keep the song, and nobody in the middle takes a cut.</p>
      <a class="btn" target="_blank" rel="noopener" href="https://vibrr.ai/vibrr-market/collection/${enc(rels[0]?.collection || "")}">Collect on Vibrr ↗</a>
      <div class="muted small" id="ah-verified" style="margin-top:16px"></div></div>
  </div>
  ${fans.length ? `<div class="row-head" id="fans"><h2>Fans also like</h2></div><div class="grid">${fans.map(artistCard).join("")}</div>` : ""}`;
  $("#play-artist").onclick = () => playQueue(popular.length ? popular.concat(all.filter(t => !popular.includes(t))) : all, 0, a.name);
  $("#shuf-artist").onclick = () => playQueue(shuffled(all), 0, a.name);
  $("#follow").onclick = () => { const f = follows(), on = f.includes(a.name); store.set("follows", on ? f.filter(x => x !== a.name) : [...f, a.name]); toast(on ? `Unfollowed ${a.name}` : `Following ${a.name}`); route(true); };
  $("#share-artist").onclick = () => shareModal(`${a.name} on Splendor Music`, location.href);
  $$("[data-ph]").forEach(b => b.onclick = () => lightbox(photos, +b.dataset.ph));
  $$("[data-tool]").forEach(b => b.onclick = () => b.dataset.tool === "edit" ? editArtist(a.name) : b.dataset.tool === "songs" ? editArtist(a.name, all[0]?.id) : shareModal(`${a.name} on Splendor Music`, location.href));
  $$("[data-ask]").forEach(b => b.onclick = () => { const k = b.dataset.ask, l = store.get("asks", []), on = l.includes(k); store.set("asks", on ? l.filter(x => x !== k) : [...l, k]);
    b.textContent = on ? "Ask for it" : "✓ Asked"; b.classList.toggle("on", !on);
    if (!on) toast(`Asked ${a.name} for “${k.split("|")[1]}”. They'll see how many fans asked.`); });
  const bindVids = () => $$("[data-yt]").forEach(b => b.onclick = () => { P.audio?.pause(); const f = document.createElement("iframe"); f.className = "vid-frame"; f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.allowFullscreen = true;
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.yt}?autoplay=1&rel=0`; b.replaceWith(f); });
  bindVids();
  if ($("#vids-more")) $("#vids-more").onclick = e => { const all4 = e.target.dataset.open === "1"; $("#vids").innerHTML = (all4 ? videos.slice(0, 4) : videos).map(vidCard).join("");
    e.target.dataset.open = all4 ? "" : "1"; e.target.textContent = all4 ? `Show all ${videos.length} videos` : "Show less"; bindVids(); if (all4) $("#videos")?.scrollIntoView({ block: "start" }); };
  if (a.verified && $("#ah-verified")) $("#ah-verified").innerHTML = `<span class="pill ok">✓ ID-verified artist</span> The identity behind this music has been checked.`;
  if ($("#pop-more")) $("#pop-more").onclick = e => { $("#pop-list").innerHTML = popular.map((t, i) => trackRow(t, i, { thumb: 1, meta: popMeta })).join(""); e.target.remove(); markPlaying(); };
  $$("#disc-chips [data-k]").forEach(b => b.onclick = () => { $$("#disc-chips .chip").forEach(c => c.classList.toggle("on", c === b)); $("#disc").innerHTML = discCards(b.dataset.k); });
  $$(".subtabs [data-jump]").forEach(b => b.onclick = () => { $$(".subtabs button").forEach(x => x.classList.toggle("on", x === b)); $("#" + b.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  setAmbient(p.banner ? null : a.img);
  hydrate(view());
  if (!links.length) chainSocials(a);
}
/* "ID-verified artist": the XPR account behind the music passed identity checks (KYC). Wallet names stay private. */
async function verifiedBadge(a) {
  for (const acc of [...a.accounts].slice(0, 4)) {
    try {
      const r = await fetch(`${RPC}/v1/chain/get_table_rows`, { method: "POST", body: JSON.stringify({ json: true, code: "eosio.proton", scope: "eosio.proton", table: "usersinfo", lower_bound: acc, upper_bound: acc, limit: 1 }) });
      const row = (await r.json()).rows?.[0];
      if (row && Array.isArray(row.kyc) ? row.kyc.length : (row && String(row.kyc || "").length > 2)) { const el = $("#ah-verified"); if (el) el.innerHTML = `<span class="pill ok">✓ ID-verified artist</span> The identity behind this music has been checked.`; return; }
    } catch {}
  }
}
/* artists without a profile yet: show the socials they put in their Vibrr collection on chain */
async function chainSocials(a) {
  const out = new Map();
  for (const c of [...new Set(a.releases.map(r => r.collection))].slice(0, 6)) {
    try {
      const d = (await getJSON(`${API}/collections/${enc(c)}`))?.data || {};
      let s = d.socials; if (typeof s === "string") { try { s = JSON.parse(s); } catch { s = {}; } }
      Object.entries(s || {}).forEach(([k, u]) => { if (safeHref(u) && !out.has(k)) out.set(k, safeHref(u)); });
      const site = safeHref(d.url) || (/^[\w-]+(\.[\w-]+)+\/?$/.test(String(d.url || "")) ? "https://" + d.url : "");
      if (site && !out.has("website")) out.set("website", site);
    } catch {}
  }
  const el = $("#ab-links"); if (el && out.size) el.innerHTML = linkPills([...out.entries()]);
}
/* photos: { src, credit } (older profiles: plain strings + one photoCredit) */
const photoList = p => (p.photos || []).map(ph => typeof ph === "string" ? { src: imgUrl(ph), credit: String(p.photoCredit || "").replace(/^Photos?:\s*/i, "") } : { src: imgUrl(ph?.src), credit: String(ph?.credit || "") }).filter(ph => ph.src);
function lightbox(list, i) {
  const bg = document.createElement("div"); bg.className = "lb-bg";
  const show = () => { const ph = list[i]; bg.innerHTML = `<button class="lb-x" title="Close">&times;</button>
    ${list.length > 1 ? `<button class="lb-nav prev" title="Previous">&#8249;</button><button class="lb-nav next" title="Next">&#8250;</button>` : ""}
    <figure class="lb-fig"><img src="${esc(ph.src)}" alt=""><figcaption>${ph.credit ? `Photo: ${esc(ph.credit)}` : ""}<span class="muted">${i + 1} of ${list.length}</span></figcaption></figure>`;
    $(".lb-x", bg).onclick = close; if (list.length > 1) { $(".prev", bg).onclick = e => { e.stopPropagation(); i = (i - 1 + list.length) % list.length; show(); }; $(".next", bg).onclick = e => { e.stopPropagation(); i = (i + 1) % list.length; show(); }; } };
  const key = e => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && list.length > 1) { i = (i + 1) % list.length; show(); } else if (e.key === "ArrowLeft" && list.length > 1) { i = (i - 1 + list.length) % list.length; show(); } };
  function close() { document.removeEventListener("keydown", key); bg.parentNode && bg.parentNode.removeChild(bg); }
  bg.onclick = e => { if (e.target === bg) close(); };
  document.addEventListener("keydown", key); document.body.append(bg); show();
}
/* upload + crop: you see exactly how the photo will sit (circle for the profile photo, wide for the banner) */
const CROP = { avatar: { aspect: 1, w: 640, round: true, label: "Centre your face in the circle" }, banner: { aspect: 3, w: 2400, label: "Frame your banner (your name sits bottom left)" },
               photo: { aspect: 4 / 3, w: 1400, label: "Frame your photo" } };
function pickImage(kind) {
  return new Promise(done => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return done(""); if (f.size > 25e6) { toast("That image is over 25 MB"); return done(""); } cropImage(f, CROP[kind]).then(done); };
    inp.click();
  });
}
function cropImage(file, o) {
  return new Promise(done => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const bg = document.createElement("div"); bg.className = "crop-bg";
      bg.innerHTML = `<div class="crop-box"><div class="m-head"><div><h3>${esc(o.label)}</h3><div class="muted small">Drag to move · slide to zoom</div></div></div>
        <div class="crop-frame${o.round ? " round" : ""}" style="aspect-ratio:${o.aspect}"><img alt=""></div>
        <input type="range" class="crop-zoom" min="1" max="4" step="0.01" value="1">
        <div class="m-foot"><button class="btn ghost" data-c="no">Cancel</button><button class="btn" data-c="ok">Use photo</button></div></div>`;
      document.body.append(bg);
      const fr = $(".crop-frame", bg), im = $("img", fr); im.src = url;
      let z = 1, x = 0, y = 0;
      const dims = () => { const W = fr.clientWidth, H = fr.clientHeight, base = Math.max(W / img.naturalWidth, H / img.naturalHeight), sc = base * z; return { W, H, s: sc, w: img.naturalWidth * sc, h: img.naturalHeight * sc }; };
      const clamp = () => { const d = dims(); x = Math.min(0, Math.max(d.W - d.w, x)); y = Math.min(0, Math.max(d.H - d.h, y)); };
      const draw = () => { clamp(); const d = dims(); Object.assign(im.style, { width: d.w + "px", height: d.h + "px", transform: `translate(${x}px,${y}px)` }); };
      requestAnimationFrame(() => { const d = dims(); x = (d.W - d.w) / 2; y = (d.H - d.h) / 2; draw(); });
      $(".crop-zoom", bg).oninput = e => { const d0 = dims(), cx = (d0.W / 2 - x) / d0.s, cy = (d0.H / 2 - y) / d0.s; z = +e.target.value; const d = dims(); x = d.W / 2 - cx * d.s; y = d.H / 2 - cy * d.s; draw(); };
      let drag = null;
      fr.onpointerdown = e => { drag = { px: e.clientX, py: e.clientY, x, y }; fr.setPointerCapture(e.pointerId); };
      fr.onpointermove = e => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; draw(); };
      fr.onpointerup = fr.onpointercancel = () => { drag = null; };
      const end = v => { bg.parentNode && bg.parentNode.removeChild(bg); URL.revokeObjectURL(url); done(v); };
      $("[data-c=no]", bg).onclick = () => end("");
      $("[data-c=ok]", bg).onclick = () => {
        const d = dims(), outW = o.w, outH = Math.round(o.w / o.aspect), c = document.createElement("canvas"); c.width = outW; c.height = outH;
        c.getContext("2d").drawImage(img, -x / d.s, -y / d.s, d.W / d.s, d.H / d.s, 0, 0, outW, outH);
        end(c.toDataURL("image/jpeg", 0.82));
      };
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image"); done(""); };
    img.src = url;
  });
}
/* the artist edits their own page: bio, photos, links, Artist Pick, lyrics and song stories */
function editArtist(name, focusTid) {
  const a = ARTISTS.find(x => x.name === name); if (!a) return;
  const p = profileOf(name), all = a.releases.flatMap(r => r.tracks), keys = ["website", "spotify", "apple", "bandcamp", "youtube", "instagram", "facebook", "x", "tiktok", "soundcloud"];
  const m = modal(`<div class="m-head"><div><h3>Edit artist page</h3><div class="muted small">${esc(name)}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      <label>Tagline<input id="ea-tag" maxlength="90" value="${esc(p.tagline || "")}" placeholder="One line about your music"></label>
      <label>Location<input id="ea-loc" maxlength="80" value="${esc(p.location || "")}"></label>
      <label>Bio<textarea id="ea-bio" rows="7" maxlength="3000">${esc(p.bio || "")}</textarea></label>
      <div class="sub-h">Photos</div>
      <div class="up-row"><div class="up-prev banner" id="ea-banner-prev"></div><div><b>Banner</b><small class="muted">Wide photo across the top of your page</small>
        <div class="row"><button class="btn ghost sm" data-up="banner">Upload and crop</button><button class="btn ghost sm" data-clear="banner">Remove</button></div></div></div>
      <div class="up-row"><div class="up-prev round" id="ea-av-prev"></div><div><b>Profile photo</b><small class="muted">Shown in a circle: you'll centre it</small>
        <div class="row"><button class="btn ghost sm" data-up="avatar">Upload and crop</button><button class="btn ghost sm" data-clear="avatar">Remove</button></div></div></div>
      <div><b style="font-size:14px">Gallery</b> <small class="muted">up to 6</small><div class="up-gallery" id="ea-gal"></div></div>
      <label>YouTube videos (one link per line)<textarea id="ea-vids" rows="3" placeholder="https://youtu.be/...">${esc((p.videos || []).map(v => "https://youtu.be/" + v.id).join("\n"))}</textarea></label>
      <div class="sub-h">Links</div>
      <div class="link-grid">${keys.map(k => `<label>${esc(LINK_NAMES[k] || k)}<input data-link="${k}" value="${esc(p.links?.[k] || "")}" placeholder="https://"></label>`).join("")}</div>
      <div class="sub-h">Artist Pick</div>
      <label>Pin a release<select id="ea-pick"><option value="">None</option>${a.releases.map(r => `<option${p.pick?.release === r.title ? " selected" : ""}>${esc(r.title)}</option>`).join("")}</select></label>
      <label>A note for fans<input id="ea-note" maxlength="160" value="${esc(p.pick?.note || "")}"></label>
      <div class="sub-h" id="ea-lyr-h">Songs: lyrics, credits and about</div>
      <label>Song<select id="ea-song">${all.map(t => `<option value="${esc(t.id)}"${t.id === focusTid ? " selected" : ""}>${esc(t.title)}${p.lyrics?.[t.id] ? " ✓" : ""}</option>`).join("")}</select></label>
      <label>Lyrics<textarea id="ea-lyrics" rows="9" maxlength="8000" placeholder="Paste the full lyrics: one line per line, a blank line between verses, and write out every repeated chorus."></textarea><small class="muted">They show straight away. No middleman, no fee. Synced lyrics (line by line with the music) are coming.</small></label>
      <label>Credits<textarea id="ea-credits" rows="5" maxlength="2000" placeholder="One per line, for example:&#10;Written by: Lachlan Grant&#10;Produced by: Lachlan Grant&#10;Mastered by: Alex DeYoung"></textarea></label>
      <label class="toggle"><input type="checkbox" id="ea-allrel"> Use these credits for every song on this release</label>
      <label>About this song<textarea id="ea-story" rows="4" maxlength="2000" placeholder="Where it came from, what it means to you"></textarea></label>
      <p class="muted small" style="margin:0">Prototype: your changes are saved on this device and show straight away. Publishing them for every listener comes with signed artist profiles on Vibrr.</p>
    </div>
    <div class="m-foot"><button class="btn ghost" data-mclose>Cancel</button><button class="btn" id="ea-save">Save</button></div>`, "wide sheet");
  const saved = store.get("profile:" + name, null) || {};
  const draft = { lyrics: { ...(saved.lyrics || {}) }, stories: { ...(saved.stories || {}) }, credits: { ...(saved.credits || {}) }, albumCredits: { ...(saved.albumCredits || {}) },
                  banner: p.banner || "", avatar: p.avatar || "", photos: photoList(p).slice(0, 6).map(ph => ({ ...ph })) };
  const drawPics = () => {
    $("#ea-banner-prev", m).style.backgroundImage = draft.banner ? cssUrl(imgUrl(draft.banner)) : "";
    $("#ea-av-prev", m).style.backgroundImage = draft.avatar ? cssUrl(imgUrl(draft.avatar)) : "";
    $("#ea-gal", m).innerHTML = draft.photos.map((ph, i) => `<span class="gitem"><span class="gthumb" style="background-image:${esc(cssUrl(ph.src))}"><button data-gx="${i}" title="Remove">&#10005;</button></span><input class="gcredit" data-gc="${i}" maxlength="80" placeholder="Photographer" value="${esc(ph.credit || "")}"></span>`).join("")
      + (draft.photos.length < 6 ? `<button class="gadd" data-up="photo">+ Add</button>` : "");
    $$("[data-gx]", m).forEach(b => b.onclick = () => { draft.photos.splice(+b.dataset.gx, 1); drawPics(); });
    $$("[data-gc]", m).forEach(inp => inp.oninput = () => { draft.photos[+inp.dataset.gc].credit = inp.value.trim(); });
    $$("[data-up]", m).forEach(b => b.onclick = () => pickImage(b.dataset.up).then(url => { if (!url) return; if (b.dataset.up === "photo") draft.photos.push({ src: url, credit: "" }); else draft[b.dataset.up] = url; drawPics(); }));
  };
  $$("[data-clear]", m).forEach(b => b.onclick = () => { draft[b.dataset.clear] = ""; drawPics(); });
  drawPics();
  const loadSong = () => { const id = $("#ea-song", m).value, t = byId.get(id); if (!t) return;
    $("#ea-lyrics", m).value = draft.lyrics[id] ?? p.lyrics?.[id] ?? t.d.lyrics ?? "";
    $("#ea-story", m).value = draft.stories[id] ?? p.stories?.[id] ?? String(t.d.about || "");
    $("#ea-credits", m).value = draft.credits[id] ?? draft.albumCredits[t.release] ?? creditText(t); $("#ea-allrel", m).checked = false; };
  const keepSong = () => { const id = $("#ea-song", m).value, t = byId.get(id); if (!t) return;
    draft.lyrics[id] = $("#ea-lyrics", m).value.trim(); draft.stories[id] = $("#ea-story", m).value.trim();
    const cr = $("#ea-credits", m).value.trim(); if ($("#ea-allrel", m).checked) { draft.albumCredits[t.release] = cr; delete draft.credits[id]; } else if (cr !== creditText(t)) draft.credits[id] = cr; };
  let cur = $("#ea-song", m).value; loadSong();
  $("#ea-song", m).onchange = () => { const nx = $("#ea-song", m).value; $("#ea-song", m).value = cur; keepSong(); $("#ea-song", m).value = cur = nx; loadSong(); };
  if (focusTid) setTimeout(() => $("#ea-lyr-h", m)?.scrollIntoView({ block: "start" }), 50);
  $("#ea-save", m).onclick = () => {
    keepSong();
    const links = {}; $$("[data-link]", m).forEach(i => { links[i.dataset.link] = i.value.trim(); });
    const pick = $("#ea-pick", m).value ? { release: $("#ea-pick", m).value, note: $("#ea-note", m).value.trim() } : null;
    const videos = $("#ea-vids", m).value.split(/\s+/).map(u => (u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1]).filter(Boolean).map(id => ({ id, title: (p.videos || []).find(v => v.id === id)?.title || "Video" }));
    try {
      store.set("profile:" + name, { tagline: $("#ea-tag", m).value.trim(), location: $("#ea-loc", m).value.trim(), bio: $("#ea-bio", m).value.trim(),
        banner: draft.banner, avatar: draft.avatar, photos: draft.photos, photoCredit: "", videos, links, pick, lyrics: draft.lyrics, stories: draft.stories, credits: draft.credits, albumCredits: draft.albumCredits });
      if (!localStorage.getItem("profile:" + name)) throw new Error("full");
    } catch { toast("Couldn't save: this device is out of space for photos. Try fewer gallery photos."); return; }
    MODAL_DIRTY = true; closeModal(); toast("Artist page saved");
  };
}

async function release(key) {
  const r = relByKey.get(key); if (!r) return notFound();
  const d = r.d, t0 = r.tracks[0]; LISTS.rel = r.tracks;
  const price = d.sale_price ? esc(money(d.sale_price, d.sale_currency)) : "";
  const main = r.hidden && relByKey.get(r.dupOf);
  view().innerHTML = `${main ? `<div class="note" style="margin:0 0 20px">This is another mint of the same recordings (same ISRCs), tidied out of Discover. <a href="#/release/${enc(main.key)}" style="color:var(--accent)">Go to the main release →</a></div>` : ""}<section class="release">
    <img class="cover" src="${esc(ipfs(r.img))}" alt="">
    <div>
      <div class="eyebrow">Release</div><h1>${esc(r.title)}</h1>
      <div style="margin-bottom:12px"><a href="#/artist/${enc(r.artist)}"><b>${esc(r.artist)}</b></a> <span class="muted">${r.released ? `· released ${esc(relDate(r.released))} ` : ""}· ${plural(r.tracks.length, "song")} · ${relCollected(r).toLocaleString()} collected</span></div>
      <div>${[d.genre, d.mood, d.language].filter(Boolean).map(x => `<span class="pill">${esc(String(x).replace(/\|/g, " · "))}</span>`).join("")}
        <span class="pill hot">${edition(t0)}</span>${price ? `<span class="pill">${price}</span>` : ""}${d.explicit === true || d.explicit === 1 || d.explicit === "true" ? `<span class="pill">Explicit</span>` : ""}</div>
      <div class="actions">
        <button class="btn big" id="play-rel">&#9654; Play</button>
        <button class="btn ghost" id="shuf-rel">&#8644; Shuffle</button>
        <button class="btn ghost" data-save="${esc(r.tracks.map(t => t.id).join(","))}" data-label="${esc(`${r.title} · ${plural(r.tracks.length, "song")}`)}">+ Save to playlist</button>
        <button class="btn ghost" id="share">Share</button>
        <a class="btn ghost" href="https://vibrr.ai/vibrr-market/collection/${enc(r.collection)}" target="_blank" rel="noopener">Collect on Vibrr ↗</a>
      </div>
      ${listHead("Edition")}<div class="tracks" data-list="rel">${r.tracks.map((t, i) => trackRow(t, i, { meta: x => `${x.issued} collected` })).join("")}</div>
      <h3 style="margin-top:26px">Supported by</h3><div class="supporters" id="sup"><span class="muted">Loading…</span></div>
      ${d.about ? `<div class="about">${esc(d.about)}</div>` : ""}
      <div style="margin-top:16px">${[["Spotify", d.spotify], ["YouTube", d.youtube], ["Bandcamp", d.link]].filter(x => /^https?:\/\//.test(x[1] || "")).map(([n, u]) => `<a class="pill" target="_blank" rel="noopener" href="${esc(u)}">${n} ↗</a>`).join("")}</div>
    </div></section>`;
  $("#play-rel").onclick = () => playQueue(r.tracks); setAmbient(r.img);
  $("#shuf-rel").onclick = () => playQueue(shuffled(r.tracks));
  $("#share").onclick = () => shareModal(`${r.title} by ${r.artist} on Splendor Music`, location.href);
  const counts = new Map();
  try {
    for (const t of r.tracks) {
      const [holders, st] = await Promise.all([getJSON(`${API}/accounts?template_id=${t.id}&collection_name=${enc(t.collection)}&limit=100`), liveStats(t)]);
      holders.forEach(x => counts.set(x.account, (counts.get(x.account) || 0) + (+x.assets)));
      const cell = $(`.trk[data-id="${t.id}"] .rel`); if (cell && st) cell.textContent = `${edition(t)} · ${st.label}`;
    }
  } catch { if ($("#sup")) $("#sup").innerHTML = `<span class="muted">Couldn't reach the chain right now.</span>`; return; }
  const el = $("#sup"); if (!el) return;
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  el.innerHTML = list.length ? list.slice(0, 40).map(([acc, n]) => personChip(acc, n > 1 ? ` <span class="muted">×${n}</span>` : "")).join("") + (list.length > 40 ? `<span class="muted">+${list.length - 40} more</span>` : "")
    : `<span class="muted">No collectors yet. Be the first.</span>`;
  hydrate(el);
}

/* live copies = minted minus burned; "retired" = every copy burned and the edition can't mint again */
async function liveStats(t) {
  try {
    const s = await getJSON(`${API}/templates/${enc(t.collection)}/${enc(t.id)}/stats`);
    const minted = +s.assets || 0, burned = +s.burned || 0, live = minted - burned, retired = live === 0 && burned > 0 && t.max > 0 && t.issued >= t.max;
    return { minted, burned, live, retired, label: retired ? `all ${burned} burned` : `${live} held${burned ? ` · ${burned} burned` : ""}` };
  } catch { return null; }
}

/* ---------- the public Music Passport ---------- */
function owner(line) {
  const s = String(line || "").trim(); if (!s) return {};
  const m = s.replace(/^(℗|©|\(p\)|\(c\)|p\s|c\s)\s*/i, "").replace(/^by\s+/i, "").match(/^(\d{4})?\s*(.*)$/);
  return { year: m[1] || "", who: (m[2] || "").replace(/^[,\-–\s]+/, "").trim() || s };
}
function parseCredits(s) {
  if (!s) return [];
  const lines = String(s).split(/\n|;|\.\s+(?=[A-Z])|,\s+(?=[A-Z][\w &]*?\s+by\s)/i).map(x => x.trim().replace(/[.,]$/, "")).filter(x => x.length > 1);
  return lines.map(ln => {
    let m = ln.match(/^(.{2,60}?)\s+by\s+(.+)$/i);
    if (m) return { role: m[1].trim().replace(/^./, c => c.toUpperCase()), who: m[2].trim() };
    m = ln.match(/^([A-Za-z][A-Za-z &/]{2,40}?)\s*[-–—:]\s*(.+)$/);
    if (m) return { role: m[1].trim(), who: m[2].trim() };
    return { role: "", who: ln };
  });
}
const contribs = d => [1, 2, 3, 4, 5].map(i => ({ w: String(d[`contrib${i}_wallet`] || "").trim(), r: d[`contrib${i}_role`], s: d[`contrib${i}_split`] })).filter(c => c.w);
const yes = v => v === true || v === 1 || v === "1" || v === "true";
function mrz(t) {
  const clean = s => String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z0-9]+/g, "<");
  const pad = s => (s + "<".repeat(44)).slice(0, 44);
  const yr = owner(t.d.p_line).year || new Date(t.created).getFullYear();
  return [pad(`P<XPR${clean(t.artist)}<<${clean(t.title)}`), pad(`${clean(t.d.isrc || "NOISRC")}<${t.id}<${clean(t.collection)}<${yr}`)];
}
/* who gets paid on a primary collect: the on-chain split if registered, else the Passport's declared split, else the collection owner */
function payShares(t) {
  const sp = CHAIN.splits.get(t.id);
  if (sp) {
    const roy = sp.royalty_bps / 100, m = new Map();
    const add = (who, pct, role) => { const x = m.get(who) || { who, pct: 0, roles: [] }; x.pct += pct; if (!x.roles.includes(role)) x.roles.push(role); m.set(who, x); };
    add(sp.artist, 100 - roy, "Artist");
    sp.wallets.forEach((w, i) => add(w, roy * (sp.bps[i] || 0) / 10000, "Collaborator share"));
    return { src: "chain", sp, legs: [...m.values()] };
  }
  const c = contribs(t.d).filter(x => +x.s > 0);
  if (c.length) return { src: "declared", legs: c.map(x => ({ who: x.w, pct: +x.s, roles: [x.r || "Contributor"] })) };
  return { src: "owner", legs: [{ who: t.author, pct: 100, roles: ["Artist"] }] };
}
const splitBar = legs => `<div class="splitbar">${legs.map((l, i) => `<span style="width:${Math.max(0, l.pct)}%;background:${COLORS[i % COLORS.length]}" title="${esc(personName(l.who))} ${l.pct.toFixed(1)}%"></span>`).join("")}</div>`;
/* privacy by default: wallets that belong to an artist show as the artist's name (wallet names only in Technical details) */
function artistNameFor(acc) { for (const a of ARTISTS) if (a.accounts.has(acc)) return a.name; return ""; }
const personChip = (acc, extra = "") => {
  const n = artistNameFor(acc); if (!n) return supChip(acc, extra);
  const pic = imgUrl(profileOf(n).avatar);
  return `<a class="sup" href="#/artist/${enc(n)}"><span class="av" style="--h:${hue(n)}">${pic ? `<img src="${esc(pic)}" alt="">` : esc(n[0])}</span>${esc(n)}${extra}</a>`;
};
const personName = acc => artistNameFor(acc) || acc;
const legRows = (legs, price, cur) => `<div class="legs">${legs.map((l, i) => `<div class="leg"><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>${personChip(l.who)}<span class="r">${esc(l.roles.join(" + "))}</span><b>${l.pct.toFixed(l.pct % 1 ? 1 : 0)}%${price ? ` · ${esc(money(price * l.pct / 100, cur))}` : ""}</b></div>`).join("")}</div>`;

async function passportPage(id) {
  const t = byId.get(String(id)); if (!t) return notFound();
  const d = t.d, credits = creditsOf(t), pl = owner(d.p_line), cl = owner(d.c_line), con = contribs(d), [m1, m2] = mrz(t);
  LISTS.pass = [t]; setAmbient(t.img);
  const perms = [["Sync", "allow_sync", "Film, TV, ads and games"], ["Commercial use", "allow_commercial", "Use in commercial projects"], ["Sampling", "allow_sampling", "Sample parts of the recording"],
                 ["Remix", "allow_remix", "Make a remix"], ["Cover", "allow_cover", "Record a cover version"]].filter(([, k]) => k in d);
  const kv = (k, v, copyable) => v ? `<div class="k">${k}</div><div class="v"><span>${esc(v)}</span>${copyable ? `<button class="copy" data-copy="${esc(v)}">copy</button>` : ""}</div>` : "";
  const cidLink = (k, cid) => cid && ipfs(cid) ? `<div class="k">${k}</div><div class="v"><a class="mono" target="_blank" rel="noopener" href="${esc(ipfs(cid))}">${esc(String(cid).slice(0, 18))}… ↗</a></div>` : "";
  view().innerHTML = `
  <section class="pass-card">
    <div class="pass-art"><img id="pass-img" src="${esc(ipfs(t.img))}" alt="">${d.backimg ? `<button class="flip" id="flip">↻ Flip artwork</button>` : ""}</div>
    <div class="pass-main">
      <div class="eyebrow">Music Passport</div>
      <h1>${esc(t.title)}</h1>
      <div class="by"><a href="#/artist/${enc(t.artist)}"><b>${esc(t.artist)}</b></a> · <a class="muted" href="#/release/${enc(t.key)}">${esc(t.release)}</a></div>
      <div class="pass-fields">
        <div class="pf"><div class="k">℗ Recording owner</div><div class="v big">${esc(pl.who || "Not declared")}</div></div>
        <div class="pf"><div class="k">© Song owner</div><div class="v big">${esc(cl.who || "Not declared")}</div></div>
        <div class="pf"><div class="k">Edition</div><div class="v">${edition(t)}</div></div>
        <div class="pf"><div class="k">Collected</div><div class="v" id="pf-live">${plural(t.issued, "copy", "copies")}</div></div>
        <div class="pf"><div class="k">Added</div><div class="v">${date(t.created)}</div></div>
        ${VR.byId.has(t.id) ? `<div class="pf"><div class="k">Vibrr Radio</div><div class="v">${plural(VR.byId.get(t.id).plays, "play")} · ${plural(VR.byId.get(t.id).reacts, "reaction")}</div></div>` : ""}
      </div>
      <div class="actions" data-list="pass">
        <button class="btn big" data-play="0">&#9654; Play</button>
        <button class="ic like${isLiked(t.id) ? " on" : ""}" data-like="${esc(t.id)}" title="Like" style="font-size:22px">&#9829;</button>
        <button class="btn ghost" data-save="${esc(t.id)}">+ Save to playlist</button>
        <button class="btn ghost" id="share-pass">Share Passport</button>
        <span id="own-actions" class="actions" style="margin:0"><a class="btn ghost" href="${vibrrUrl(t)}" target="_blank" rel="noopener">Collect on Vibrr ↗</a></span>
      </div>
    </div>
    <div class="stamp">VERIFIED<br>ON CHAIN<span>#${esc(t.id)}</span></div>
  </section>
  <section class="pgrid">
    <div class="panel"><h2>Who owns it</h2>
      <div class="owner-tiles">
        <div class="owner"><div class="sym">℗</div><div class="what">The recording (master)</div><div class="who">${esc(pl.who || "Not declared")}</div><div class="yr">${pl.year ? "since " + esc(pl.year) : ""}</div></div>
        <div class="owner"><div class="sym">©</div><div class="what">The song (composition)</div><div class="who">${esc(cl.who || "Not declared")}</div><div class="yr">${cl.year ? "since " + esc(cl.year) : ""}</div></div>
      </div>
      <p class="muted small" style="margin:12px 0 0">Owning a copy makes you a collector and supporter. The copyrights stay with the owners above.</p>
      <div class="licence-note"><b>Want to use this song?</b> For a film, ad, game, video, remix, sample or cover, ask ${esc(t.artist)} first. Licensing requests through Splendor Music are coming.</div>
    </div>
    <div class="panel"><h2>Who made it</h2>
      ${credits.length ? `<div class="credits">${credits.map(c => `<div class="role">${esc(c.role || "Credit")}</div><div class="who">${esc(c.who)}</div>`).join("")}</div>` : `<p class="muted">No credits listed yet.</p>`}
      ${isArtistOwner(artistOf(t)) ? `<button class="btn ghost sm" style="margin-top:12px" data-editlyrics="${esc(t.id)}">✎ ${credits.length ? "Edit" : "Add"} credits</button>` : ""}
    </div>
    ${(() => { const L = lyricsOf(t), own = isArtistOwner(artistOf(t)), about = L.story || String(d.about || "").trim();
      return `${about ? `<div class="panel wide"><h2>About this song</h2><div class="about" style="margin:0">${esc(about)}</div></div>` : ""}
      <div class="panel wide lyrics-panel" id="lyrics"><h2>Lyrics</h2>${L.lyrics ? `<div class="lyrics">${esc(L.lyrics)}</div>` : `<p class="muted" style="margin:0">No lyrics yet. When ${esc(t.artist)} adds them, they show here and in Now Playing.</p>`}
      ${own ? `<button class="btn ghost sm" style="margin-top:14px" data-editlyrics="${esc(t.id)}">✎ ${L.lyrics ? "Edit" : "Add"} lyrics, credits and about</button>` : ""}</div>`; })()}
    <div class="panel wide"><h2>How each sale is shared</h2><div id="paid"><span class="muted">Checking…</span></div></div>
    <details class="panel wide tech"><summary>Technical details <span class="muted small">codes, files and wallets, for the curious</span></summary><div class="kv" style="margin-top:14px">
      ${kv("ISRC", d.isrc, 1)}${kv("UPC", d.upc, 1)}${kv("Template", t.id, 1)}${kv("Collection", t.collection, 1)}${kv("Schema", t.schema)}${kv("Created by wallet", t.author)}${kv("Licence", d.license && d.license !== "None" ? d.license : "")}
      ${perms.length ? `<div class="k">Permission settings</div><div class="v"><span>${perms.map(([n, k]) => `${n}: ${yes(d[k]) ? "open to it" : "ask first"}`).join(" · ")}<br><small class="muted">What the artist ticked when minting. Always ask the artist before using the song.</small></span></div>` : ""}<div class="k">Passport code</div><div class="v"><span class="mono small" style="white-space:pre;overflow-x:auto;display:block">${esc(m1)}\n${esc(m2)}</span><small class="muted">A machine-readable line, like the one on a real passport</small></div>
      ${con.length ? `<div class="k">On-chain contributors</div><div class="v">${con.map(c => `${esc(c.w)} (${esc(c.r || "Contributor")}${c.s ? ` ${esc(c.s)}%` : ""})`).join(", ")}</div>` : ""}
      ${kv("Genre", d.genre && String(d.genre).replace(/\|/g, " · "))}${kv("Mood", d.mood && String(d.mood).replace(/\|/g, " · "))}${kv("BPM", d.bpm)}${kv("Key", d.key)}${kv("Language", d.language)}${kv("Format", d.format)}
      ${kv("Track", d.track)}${kv("Released", d.released && relDate(d.released))}
      ${cidLink("Audio (master)", d.audio)}${cidLink("Listening copy", d.listen)}${cidLink("Artwork", d.img)}${cidLink("Video", d.video)}
      <div class="k">Raw record</div><div class="v"><a class="mono" target="_blank" rel="noopener" href="${API}/templates/${enc(t.collection)}/${enc(t.id)}">template ${esc(t.id)} ↗</a></div>
    </div></details>
    <div class="panel wide"><h2>Collectors</h2><div id="collectors"><span class="muted">Loading…</span></div></div>

  </section>`;
  if (d.backimg) { let back = false; $("#flip").onclick = () => { back = !back; $("#pass-img").src = ipfs(back ? d.backimg : t.img); }; }
  $("#share-pass").onclick = () => shareModal(`${t.title} by ${t.artist}: Music Passport`, location.href);
  // other mints of the same recording (same ISRC), e.g. a test mint in another collection
  const isrc = String(d.isrc || "").trim().toUpperCase();
  const twins = isrc ? [...byId.values()].filter(x => x !== t && String(x.d.isrc || "").trim().toUpperCase() === isrc) : [];
  const mainRel = t.hidden && relByKey.get(relByKey.get(t.key)?.dupOf);
  if (twins.length || mainRel) $(".pass-card").insertAdjacentHTML("afterend", `<div class="note" style="margin-top:14px">${mainRel ? `This is another mint of a recording that lives on <a href="#/release/${enc(mainRel.key)}" style="color:var(--accent)">${esc(mainRel.title)}</a>. ` : ""}${twins.length ? `Same recording (ISRC ${esc(isrc)}) also minted as: ${twins.map(x => `<a class="pill" href="#/passport/${enc(x.id)}">${esc(x.collection)} · #${esc(x.id)}</a>`).join("")}` : ""}</div>`);
  liveStats(t).then(st => { const el = $("#pf-live"); if (el && st) el.innerHTML = `${esc(st.label)}${st.retired ? ` <span class="pill">Retired</span>` : ""}`; });
  hydrate(view());
  collectors(t);
  await CHAIN.ready;
  if (location.hash.startsWith("#/passport/" + t.id)) { renderPaid(t); if (typeof renderOwnActions === "function") renderOwnActions(t); }
}
function renderPaid(t) {
  const el = $("#paid"); if (!el) return;
  const d = t.d, price = +d.sale_price || 0, cur = d.sale_currency || "XPR", ps = payShares(t);
  const col = (CHAIN.collects.get(t.id) || []).slice().sort((a, b) => b.time - a.time), res = (CHAIN.resales.get(t.id) || []).slice().sort((a, b) => b.time - a.time);
  const tot = new Map(); col.forEach(c => c.outs.forEach(o => tot.set(o.q.sym, (tot.get(o.q.sym) || 0) + o.q.n)));
  const head = ps.src === "chain" ? `Every collect pays these people automatically <span class="pill ok">✓ locked in since ${date(ps.sp.time)}</span>`
    : ps.src === "declared" ? `The shares the artist has listed <span class="pill">not locked in yet</span>`
    : `No shares set yet <span class="pill">sales go to the artist</span>`;
  const declared = contribs(d), showDeclared = ps.src === "chain" && declared.some(c => !ps.legs.find(l => l.who === c.w));
  el.innerHTML = `
    <div class="sub-h">${head}</div>
    ${splitBar(ps.legs)}${legRows(ps.legs, price, cur)}
    ${price ? `<p class="muted small">Shown for a collect at the listed price of ${esc(money(price, cur))}.</p>` : ""}
    ${showDeclared ? `<p class="muted small">The Passport also credits ${declared.filter(c => !ps.legs.find(l => l.who === c.w)).map(c => esc(c.w)).join(", ")}; the on-chain split above is what actually pays out.</p>` : ""}
    ${t.fee ? `<div class="sub-h">On every resale</div><p style="margin:0"><b>${num(t.fee * 100)}%</b> of the resale price goes back to ${personChip(t.author)}.</p>` : ""}
    <details class="tech-d"><summary>Payment history (${col.length + res.length})</summary>
    ${tot.size || res.length ? `<div class="totals">${[...tot.entries()].map(([s, n]) => `<div class="stat"><b>${esc(money(n, s))}</b><span>paid to the people who made it</span></div>`).join("")}${col.length ? `<div class="stat"><b>${col.length}</b><span>paid collect${col.length === 1 ? "" : "s"}</span></div>` : ""}${res.length ? `<div class="stat"><b>${res.length}</b><span>resale${res.length === 1 ? "" : "s"}</span></div>` : ""}</div>` : ""}
    <div class="ledger">
      ${col.map(c => `<div class="lrow"><span class="when">${date(c.time)}</span><div class="what"><div>${acctLink(c.buyer)} collected a copy for <b>${esc(money(c.paid.n, c.paid.sym))}</b></div>
        <div class="payouts">${c.outs.map(o => `<span class="payout">${esc(personName(o.acc))} +${esc(money(o.q.n, o.q.sym))}</span>`).join("")}</div></div>
        <a class="pill" target="_blank" rel="noopener" href="${EXPLORER}/transaction/${enc(c.trx)}">tx ↗</a></div>`).join("")}
      ${res.map(s => `<div class="lrow"><span class="when">${date(s.time)}</span><div class="what"><div>${acctLink(s.seller)} resold #${esc(s.mint)} to ${acctLink(s.buyer)} for <b>${num(s.amount)} ${esc(s.sym)}</b>${s.bundle > 1 ? ` <span class="muted small">(bundle of ${s.bundle})</span>` : ""}</div>
        ${s.fee ? `<div class="payouts"><span class="payout">${esc(personName(t.author))} ≈ +${num(s.amount * s.fee)} ${esc(s.sym)} royalty</span></div>` : ""}</div><span class="pill">${esc(s.market || "market")}</span></div>`).join("")}
      ${!col.length && !res.length ? `<div class="empty-state" style="margin:0"><b>No paid collects yet</b>When this song is collected, every payment shows here, for anyone to check.</div>` : ""}
    </div></details>
    ${CHAIN.ok ? "" : `<p class="err">Couldn't read the split contract's history right now.</p>`}`;
  hydrate(el);
}
async function collectors(t) {
  try {
    const [first, acc] = await Promise.all([getJSON(`${API}/assets?template_id=${t.id}&collection_name=${enc(t.collection)}&sort=template_mint&order=asc&limit=10`), getJSON(`${API}/accounts?template_id=${t.id}&collection_name=${enc(t.collection)}&limit=100`)]);
    const box = $("#collectors"); if (!box) return;
    box.innerHTML = first.length ? `<div class="sub-h">Early supporters</div><div class="supporters">${first.map(a => personChip(a.owner, ` <span class="mint">#${esc(a.template_mint)}</span>`)).join("")}</div>
      <div class="sub-h">Everyone holding a copy (${acc.length}${acc.length === 100 ? "+" : ""})</div><div class="supporters">${acc.map(x => personChip(x.account, +x.assets > 1 ? ` <span class="muted">×${esc(x.assets)}</span>` : "")).join("")}</div>`
      : `<span class="muted">No collectors yet. Be the first.</span>`;
    hydrate(box);
  } catch { const box = $("#collectors"); if (box) box.innerHTML = `<span class="muted">Couldn't reach the chain right now.</span>`; }
}

/* ---------- Library + playlists ---------- */
function library() {
  const pls = PL.all(), rec = recentTracks().slice(0, 15), m = me();
  LISTS.recent = rec;
  view().innerHTML = `<div class="row-head" style="margin-top:0"><h1 style="margin:0">Your Library</h1>
      ${m ? `<a class="me-chip" href="#/u/${enc(m)}">${av(m)}<span>My Corner</span></a>` : `<button class="btn ghost sm" id="lib-me">Set your XPR account</button>`}</div>
    <div class="row-head"><h2>Playlists</h2><button class="btn sm" id="new-pl">+ New playlist</button></div>
    <div class="grid">${plCard(PL.get("liked"))}${pls.map(plCard).join("")}<button class="card new" id="new-pl2"><span>+</span>Create playlist</button></div>
    ${typeof libraryExtras === "function" ? libraryExtras() : ""}
    <a class="econ-banner" href="#" id="get-app" style="margin-top:30px"><div><div class="eyebrow">Splendor Music app</div><h2>Listen offline</h2><div class="muted">Add Splendor Music to your phone. The music you own plays anywhere, even with no signal.</div></div><span class="btn">Set it up</span></a>
    <div class="row-head"><h2>Recently played</h2></div>
    ${rec.length ? `${listHead()}<div class="tracks" data-list="recent">${rec.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1 })).join("")}</div>` : `<p class="muted">Nothing played yet.</p>`}`;
  const mk = () => { const pl = PL.create(`My Playlist #${PL.all().length + 1}`); location.hash = "#/pl/" + pl.id + "/edit"; };
  $("#new-pl").onclick = mk; $("#new-pl2").onclick = mk;
  if ($("#lib-me")) $("#lib-me").onclick = accountMenu;
  $("#get-app").onclick = e => { e.preventDefault(); getApp(); };
  if (typeof bindLibraryExtras === "function") bindLibraryExtras();
  hydrate(view());
}
/* installable app (PWA): Chrome/Android offer an install prompt; iPhone = Share → Add to Home Screen */
let INSTALL = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function platform() {
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other" : "ios-safari";
  return /Android/.test(ua) ? "android" : "desktop";
}
/* "Get the app": one tap where the browser allows it, otherwise big, plain steps for this exact phone */
function getApp(reason = "") {
  if (INSTALL) { INSTALL.prompt(); INSTALL.userChoice.finally(() => { INSTALL = null; $("#install-btn").hidden = true; hideAppBanner(); }); return; }
  const pf = platform();
  if (isStandalone()) { toast("You're already in the app ✓"); return; }
  const steps = {
    "ios-safari": [["⬆︎", "Tap Share", "The square with an arrow. On newer iPhones it's inside the ••• button at the bottom right."], ["＋", "Tap “Add to Home Screen”", "Scroll down the list if you can't see it."], ["✓", "Tap “Add”", "Splendor Music is now on your home screen, like any app."]],
    "ios-other": [["⬆︎", "Tap Share", "Top right, next to the address bar."], ["＋", "Tap “Add to Home Screen”", ""], ["✓", "Tap “Add”", "Splendor Music is now on your home screen."]],
    android: [["⋮", "Tap the menu", "Top right of Chrome."], ["＋", "Tap “Install app”", "Or “Add to Home screen”."], ["✓", "Tap “Install”", "Splendor Music is now with your other apps."]],
    desktop: [["⤓", "Click the install icon", "At the right end of Chrome's address bar."], ["✓", "Click “Install”", "Splendor Music opens in its own window."]]
  }[pf];
  modal(`<div class="m-head"><div><h3>Get the Splendor Music app</h3><div class="muted small">${esc(reason || "Free, no app store, 10 seconds.")}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      <div class="steps-big">${steps.map(([i, t, s], n) => `<div class="sb"><span class="sb-i">${i}</span><span><b>${n + 1}. ${t}</b>${s ? `<small>${s}</small>` : ""}</span></div>`).join("")}</div>
      <p class="muted small" style="margin:0">Why install? It opens full screen like a normal app, the music you own plays offline, and your phone won't clear your offline songs. No app store means the artist keeps their full share.</p>
    </div><div class="m-foot"><button class="btn ghost" data-mclose id="app-later">Not now</button><button class="btn" data-mclose>Done</button></div>`, "sheet");
  store.set("appNag", Date.now());
}
function hideAppBanner() { $(".app-banner")?.remove(); }
function appBanner() {
  if (EMBED || isStandalone() || platform() === "desktop" || $(".app-banner")) return;
  if (Date.now() - (store.get("appNag", 0) || 0) < 3 * 864e5) return;      // at most every 3 days
  document.body.insertAdjacentHTML("beforeend", `<div class="app-banner"><img src="icons/icon-192.png" alt=""><div><b>Splendor Music app</b><small>Free · offline music · 2 taps</small></div><button class="btn sm" id="ab-get">Get it</button><button class="x" id="ab-x" title="Not now">&times;</button></div>`);
  $("#ab-get").onclick = () => { hideAppBanner(); getApp(); };
  $("#ab-x").onclick = () => { store.set("appNag", Date.now()); hideAppBanner(); };
}

function playlistPage(id, editNow) {
  const p = PL.get(id); if (!p) return notFound();
  const tracks = p.ids.map(i => byId.get(i)).filter(Boolean); LISTS.pl = tracks;
  const artistsN = new Set(tracks.map(t => t.artist)).size, m = me();
  const recs = p.liked ? [] : suggest(tracks, p.ids); LISTS.recs = recs;
  view().innerHTML = `<section class="plhead">${p.liked ? `<div class="mosaic xl liked">&#9829;</div>` : mosaic(p.ids, "mosaic xl")}
    <div class="plmeta"><div class="eyebrow">${p.liked ? "Collection" : p.curator && p.curator !== m ? "Saved playlist" : "Playlist"}</div>
      ${p.liked ? `<h1>Liked Songs</h1>` : `<h1 class="editable" id="pl-name" title="Click to rename">${esc(p.name)}</h1>`}
      ${p.liked ? "" : `<div class="desc editable${p.desc ? "" : " muted"}" id="pl-desc" title="Click to edit">${p.desc ? esc(p.desc) : "Add a description"}</div>`}
      <div class="muted small">${p.curator ? `Curated by ${acctLink(p.curator)}${p.via?.length ? ` · passed on by ${p.via.map(v => acctLink(v)).join(" → ")}` : ""} · ` : m ? `${acctLink(m)} · ` : ""}${plural(tracks.length, "song")} · ${plural(artistsN, "artist")}</div>
      <div class="actions">${tracks.length ? `<button class="btn big" id="pl-play">&#9654; Play</button><button class="btn ghost" id="pl-shuf">&#8644; Shuffle</button>` : ""}
        ${p.liked ? "" : `${tracks.length ? `<button class="btn ghost" id="pl-share">Share &amp; earn</button>` : ""}<button class="btn ghost" id="pl-del">Delete</button>`}</div>
      <div id="pl-confirm"></div></div></section>
    ${p.brief === BRIEF.id ? `<section class="brief" style="margin:22px 0 8px"><div><span class="closes">Brief #${BRIEF.no} entry · closes ${esc(briefCloses().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }))}</span><h2>${esc(BRIEF.title)}</h2>
      <p style="color:#d8d1e3;margin:0">${esc(BRIEF.blurb)}</p><div class="actions"><button class="btn ghost sm" id="pl-rules">How entries are judged</button><a class="btn ghost sm" href="#/playlists/brief">The brief</a></div></div>
      <div class="prize"><b>Live score</b>${scoreBlock(briefScore(tracks))}</div></section>` : ""}
    ${tracks.length ? `${listHead()}<div class="tracks" data-list="pl" id="pl-tracks">${tracks.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1, drag: !p.liked, remove: 1 })).join("")}</div>
      ${p.liked ? "" : `<p class="muted small">Drag songs to reorder.</p>`}`
      : `<div class="empty-state"><b>${p.liked ? "Songs you like will appear here" : "Let's find something for your playlist"}</b>Tap ♥ or + on any song${p.liked ? "" : ", or add from the suggestions below"}.</div>`}
    ${!p.liked && tracks.length ? `<div class="note">Share this playlist with <b>Share &amp; earn</b>. In the playlisting economy, when someone collects a song through your link, a share of that collect (artists opt in and choose it) flows back down the chain to you and everyone who passed it on. Coming with Vibrr's curator share. <a href="#/playlists/economy" style="color:var(--accent)">How it works</a></div>` : ""}
    ${recs.length ? `<div class="row-head"><h2>Recommended</h2><span class="muted small">Based on what's in this playlist</span></div>
      <div class="tracks" data-list="recs">${recs.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1, extra: `<button class="btn ghost sm" data-addto="${esc(p.id)}" data-tid="${esc(t.id)}">Add</button>` })).join("")}</div>` : ""}`;
  if (tracks.length) { $("#pl-play").onclick = () => playQueue(tracks); $("#pl-shuf").onclick = () => playQueue(shuffled(tracks)); }
  if (p.liked) return;
  const editName = () => {
    const h = $("#pl-name"); if (!h || h.querySelector("input")) return;
    h.innerHTML = `<input class="inline-edit" maxlength="80" value="${esc(p.name)}">`; const i = h.querySelector("input"); i.focus(); i.select();
    let done = false;
    const finish = () => { if (done) return; done = true; const v = i.value.trim() || p.name; PL.update(id, x => x.name = v); route(true); };
    i.onblur = finish; i.onkeydown = e => { if (e.key === "Enter") finish(); if (e.key === "Escape") { i.value = p.name; finish(); } };
  };
  $("#pl-name").onclick = editName;
  $("#pl-desc").onclick = () => {
    const el = $("#pl-desc"); if (el.querySelector("input")) return;
    el.classList.remove("muted"); el.innerHTML = `<input class="inline-edit" maxlength="200" placeholder="Add a description" value="${esc(p.desc || "")}">`; const i = el.querySelector("input"); i.focus();
    let done = false;
    const finish = () => { if (done) return; done = true; PL.update(id, x => x.desc = i.value.trim()); route(true); };
    i.onblur = finish; i.onkeydown = e => { if (e.key === "Enter") finish(); };
  };
  if (editNow) { history.replaceState(null, "", "#/pl/" + id); editName(); }
  if ($("#pl-share")) $("#pl-share").onclick = () => sharePlaylist(PL.get(id));
  if ($("#pl-rules")) $("#pl-rules").onclick = briefRules;
  if (!p.liked && tracks[0]) setAmbient(tracks[0].img);
  $("#pl-del").onclick = () => {
    $("#pl-confirm").innerHTML = `<div class="confirm"><span>Delete “${esc(p.name)}”? This can't be undone.</span><button class="btn danger sm" id="pl-yes">Delete</button><button class="btn ghost sm" id="pl-no">Cancel</button></div>`;
    $("#pl-no").onclick = () => $("#pl-confirm").innerHTML = "";
    $("#pl-yes").onclick = () => { PL.remove(id); toast(`Deleted “${p.name}”`); location.hash = "#/library"; };
  };
  // drag to reorder
  const box = $("#pl-tracks"); if (!box) return;
  let from = -1;
  const below = (e, r) => e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2;
  box.addEventListener("dragstart", e => { const r = e.target.closest(".trk"); if (!r) return; from = +r.dataset.idx; r.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(from)); });
  box.addEventListener("dragend", () => { $$(".trk", box).forEach(r => r.classList.remove("dragging", "drop-above", "drop-below")); });
  box.addEventListener("dragover", e => {
    const r = e.target.closest(".trk"); if (!r || from < 0) return; e.preventDefault();
    $$(".trk", box).forEach(x => x.classList.remove("drop-above", "drop-below")); r.classList.add(below(e, r) ? "drop-below" : "drop-above");
  });
  box.addEventListener("drop", e => {
    const r = e.target.closest(".trk"); if (!r || from < 0) return; e.preventDefault();
    let to = +r.dataset.idx + (below(e, r) ? 1 : 0);
    if (to > from) to--;
    const f = from; from = -1;
    if (to !== f) { PL.update(id, x => { const [mv] = x.ids.splice(f, 1); x.ids.splice(to, 0, mv); }); route(true); }
  });
}
function suggest(tracks, ids) {
  const have = new Set(ids), arts = new Set(tracks.map(t => t.artist)), out = [], seen = new Set(tracks.map(t => t.title.toLowerCase() + "|" + t.artist));
  const push = t => { const k = t.title.toLowerCase() + "|" + t.artist; if (!have.has(t.id) && !seen.has(k)) { seen.add(k); out.push(t); } };
  TRACKS.filter(t => arts.has(t.artist)).forEach(push);
  RELEASES.forEach(r => r.tracks.slice(0, 2).forEach(push));
  return out.slice(0, 8);
}
function sharePlaylist(p) {
  if (!p) return;
  const m = me(), curator = p.curator || m || "";
  let via = (p.via || []).slice();
  if (m && p.curator && p.curator !== m && !via.includes(m)) via.push(m);
  via = via.slice(-PIPE.hops);
  const url = `${location.origin}${location.pathname}#/p/${b64e(JSON.stringify({ n: p.name, d: p.desc || "", i: p.ids, c: curator, v: via }))}`;
  shareModal(`${p.name}: a playlist on Splendor Music`, url, m ? `This link carries the chain: curated by <b>${esc(curator)}</b>${via.length ? `, passed on by ${via.map(esc).join(" → ")}` : ""}. Once Vibrr's curator share is live, collects through it pay the pipeline the share each artist has chosen.`
    : `Sign in with WebAuth before sharing so the pipeline can credit you.`);
}
function sharedView(raw) {
  let o; try { o = JSON.parse(b64d(raw)); } catch { return notFound(); }
  const name = String(o.n || "Shared playlist").slice(0, 80), desc = String(o.d || "").slice(0, 300);
  const ids = (Array.isArray(o.i) ? o.i : []).map(String).filter(x => /^\d+$/.test(x)).slice(0, 500);
  const curator = isAcct(o.c) ? String(o.c) : "", via = (Array.isArray(o.v) ? o.v : []).map(String).filter(isAcct).slice(0, PIPE.hops);
  const tracks = ids.map(i => byId.get(i)).filter(Boolean); LISTS.shared = tracks;
  view().innerHTML = `<section class="plhead">${mosaic(ids, "mosaic xl")}
    <div class="plmeta"><div class="eyebrow">Shared playlist</div><h1>${esc(name)}</h1>${desc ? `<div class="desc">${esc(desc)}</div>` : ""}
      <div class="muted small">${curator ? `Curated by ${acctLink(curator)}` : "Shared with you"}${via.length ? ` · passed on by ${via.map(v => acctLink(v)).join(" → ")}` : ""} · ${plural(tracks.length, "song")}</div>
      <div class="actions"><button class="btn big" id="sh-play">&#9654; Play</button><button class="btn ghost" id="sh-shuf">&#8644; Shuffle</button><button class="btn ghost" id="sh-save">+ Save to my library</button><button class="btn ghost" id="sh-pass">Pass it on</button></div></div></section>
    ${listHead()}<div class="tracks" data-list="shared">${tracks.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1 })).join("")}</div>
    ${curator ? `<div class="note">Coming soon: when the artist opts in, collecting a song from this playlist sends a share they choose (say <b>20%</b>) back down the chain to ${esc(curator)}${via.length ? ` and ${via.map(esc).join(", ")}` : ""}, the people who got this music to you. The rest goes to the artist's Passport split. Today, 100% follows the artist's split. <a href="#/playlists/economy" style="color:var(--accent)">The playlisting economy</a></div>` : ""}`;
  if (tracks[0]) setAmbient(tracks[0].img);
  $("#sh-play").onclick = () => playQueue(tracks); $("#sh-shuf").onclick = () => playQueue(shuffled(tracks));
  $("#sh-save").onclick = () => { const pl = PL.create(name, tracks.map(t => t.id), { desc, curator: curator || undefined, via }); toast(`Saved “${pl.name}” to your library`); location.hash = "#/pl/" + pl.id; };
  $("#sh-pass").onclick = () => sharePlaylist({ name, desc, ids: tracks.map(t => t.id), curator, via });
}

/* ---------- My Corner (MySpace-style profile + poster wall of every NFT you hold) ---------- */
const cornerCfg = acc => store.get("corner:" + acc, null) || (acc === me() ? store.get("corner", null) : null) || {};
const saveCorner = (acc, c) => store.set("corner:" + acc, c);
const LINKS = [["website", "Website"], ["instagram", "Instagram"], ["x", "X"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["spotify", "Spotify"], ["bandcamp", "Bandcamp"], ["tiktok", "TikTok"]];
const safeUrl = u => /^https:\/\/[^\s"'<>()\\]+$/i.test(String(u || "").trim()) ? String(u).trim() : "";
const safeImg = u => /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(u || "")) ? String(u) : safeUrl(u);
const GIG_RE = /ticket|gig|concert|tour|festival|poap|show|event/i;

/* group the wall: music by release (12 TCIY tracks = 1 album tile), everything else by collection (all the Hoopers = 1 stack) */
function wallGroups(assets, grouped) {
  const m = new Map();
  for (const a of assets) {
    const sch = a.schema?.schema_name || "", dd = a.data || {}, tid = String(a.template?.template_id || ""), col = a.collection?.collection_name || "?";
    const t = sch === SCHEMA ? byId.get(tid) : null;
    const rel = t && relByKey.get(t.key), main = rel && (rel.hidden ? relByKey.get(rel.dupOf) || rel : rel);
    const key = t && main ? (grouped ? "r:" + main.key : "t:" + tid) : (grouped ? "c:" + col : (tid ? "t:" + tid : "a:" + a.asset_id));
    if (!m.has(key)) {
      const colName = a.collection?.name || col;
      m.set(key, { key, kind: t ? "music" : GIG_RE.test(`${sch} ${colName} ${dd.name || ""}`) ? "gigs" : "art", t, rel: main, colName, n: 0, items: new Map() });
    }
    const g = m.get(key), ik = tid || a.asset_id; g.n++;
    if (!g.items.has(ik)) g.items.set(ik, { name: t ? t.title : String(dd.name || dd.title || "Untitled"), img: t ? t.img : (dd.img || dd.image || dd.cover || dd.backimg), video: dd.video, t, n: 0 });
    g.items.get(ik).n++;
  }
  return [...m.values()].map(g => {
    const items = [...g.items.values()], first = items.find(i => ipfs(i.img)) || items[0];
    const isRel = g.key.startsWith("r:"), isCol = g.key.startsWith("c:");
    return { ...g, items, img: isRel ? g.rel.img : first?.img, video: first?.video,
      title: isRel ? g.rel.title : isCol ? g.colName : first.name,
      sub: isRel ? `${g.rel.artist} · ${plural(items.length, "song")}` : isCol ? `${plural(items.length, "item")}${g.n > items.length ? ` · ${g.n} total` : ""}` : (g.t ? g.t.artist : g.colName),
      href: isRel ? `#/release/${enc(g.rel.key)}` : g.t ? `#/passport/${enc(g.t.id)}` : "",
      stack: (isRel || isCol) && (items.length > 1 || g.n > 1) };
  });
}

async function corner(acc) {
  acc = String(acc || "").toLowerCase(); if (!isAcct(acc)) return notFound();
  view().innerHTML = `<div class="loading">Opening ${esc(acc)}'s corner…</div>`;
  let assets = [], capped = false;
  const [prof] = await Promise.all([profile(acc), (async () => {
    try { for (let page = 1; page <= 5; page++) { const d = await getJSON(`${API}/assets?owner=${enc(acc)}&limit=100&page=${page}&sort=transferred&order=desc`); assets = assets.concat(d); if (d.length < 100) break; if (page === 5) capped = true; } } catch {}
  })()]);
  if (!location.hash.startsWith("#/u/" + acc)) return;
  const isMe = acc === me(), c = isMe ? cornerCfg(acc) : {};
  const w = Object.assign({ group: true, orders: {}, hidden: [] }, c.wall || {});
  const color = /^#[0-9a-f]{6}$/i.test(c.color || "") ? c.color : `hsl(${hue(acc)},80%,62%)`;
  const music = assets.filter(a => a.schema?.schema_name === SCHEMA).map(a => ({ a, t: byId.get(String(a.template?.template_id)) })).filter(x => x.t);
  const best = new Map(); music.forEach(x => { const m = +x.a.template_mint; if (!best.has(x.t.id) || m < best.get(x.t.id).m) best.set(x.t.id, { m, t: x.t }); });
  const early = [...best.values()].filter(x => x.m <= 10).sort((a, b) => a.m - b.m);
  const artCount = new Map(); music.forEach(x => artCount.set(x.t.artist, (artCount.get(x.t.artist) || 0) + 1));
  if (isMe) recentTracks().forEach(t => artCount.set(t.artist, (artCount.get(t.artist) || 0) + 0.2));
  const top8 = (Array.isArray(c.top8) && c.top8.length ? c.top8 : [...artCount.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0])).map(n => ARTISTS.find(a => a.name === n)).filter(Boolean).slice(0, 8);
  const song = byId.get(String(c.song || "")) || [...best.values()].sort((a, b) => a.m - b.m)[0]?.t;
  const first = music.length ? Math.min(...music.map(x => +x.a.minted_at_time)) : 0;
  const myPls = isMe ? PL.all().filter(p => !p.curator || p.curator === acc) : PL.all().filter(p => p.curator === acc);
  const links = LINKS.filter(([k]) => safeUrl(c.links?.[k]));
  const checks = [["Banner", !!safeImg(c.banner)], ["Headline", !!c.headline], ["Bio", !!c.about], ["Social links", links.length > 0], ["Profile song", !!c.song], ["Top 8", (c.top8 || []).length > 0], ["Wall arranged", Object.values(w.orders || {}).some(o => o?.length)]];
  const score = Math.round(100 * checks.filter(x => x[1]).length / checks.length);
  LISTS.psong = song ? [song] : [];
  view().innerHTML = `<div class="corner" style="--c:${esc(color)}">
    <div class="banner" id="c-banner"></div>
    <div class="c-head">${av(acc, "lg")}
      <div class="who"><h1><span data-pname="${esc(acc)}" data-tick>${esc(prof.name || acc)}</span></h1>
        <div class="handle">@${esc(acc)}${c.location ? ` · ${esc(c.location)}` : ""}${first ? ` · collecting since ${date(first)}` : ""}</div>
        ${c.headline ? `<div class="headline"><span class="mood">Mood:</span> ${esc(c.headline)}</div>` : isMe ? `<div class="headline muted">Add a banner, headline, bio and links to make this corner yours.</div>` : ""}
        ${links.length ? `<div class="c-links">${links.map(([k, n]) => `<a class="pill" target="_blank" rel="noopener me" href="${esc(safeUrl(c.links[k]))}">${n} ↗</a>`).join("")}</div>` : ""}</div>
      <div class="actions" style="margin:0">${isMe ? `<button class="btn" id="c-edit">Edit my corner</button>` : ""}<button class="btn ghost" id="c-share">Share</button></div>
    </div>
    <div class="stats" style="padding:0 6px"><div class="stat"><b>${best.size}</b><span>songs collected</span></div><div class="stat"><b>${new Set(music.map(x => x.t.artist)).size}</b><span>artists supported</span></div><div class="stat"><b>${early.length}</b><span>early-supporter badges</span></div><div class="stat"><b>${assets.length}${capped ? "+" : ""}</b><span>NFTs on the wall</span></div><div class="stat"><b>${myPls.length}</b><span>playlists</span></div></div>
    <div class="c-grid">
      <div style="display:flex;flex-direction:column;gap:20px">
        ${isMe ? `<div class="panel"><h2>Corner score <span class="n">${score}%</span></h2><div class="splitbar"><span style="width:${score}%;background:linear-gradient(90deg,var(--c),var(--accent))"></span></div>
          ${checks.filter(x => !x[1]).length ? `<div class="muted small">To finish: ${checks.filter(x => !x[1]).map(x => `<span class="pill">${x[0]}</span>`).join("")}</div>` : `<div class="small" style="color:var(--ok)">Fully dressed. Nice wall.</div>`}
          <p class="muted small" style="margin:10px 0 0">Coming: SI wall awards. Well-presented corners get featured on Discover and rewarded.</p></div>` : ""}
        ${c.about ? `<div class="panel"><h2>About me</h2><div class="about" style="margin:0">${esc(c.about)}</div></div>` : ""}
        ${song ? `<div class="panel"><h2>Profile song</h2><div class="psong" data-list="psong"><img src="${esc(ipfs(song.img))}" alt=""><div class="m"><b>${esc(song.title)}</b><span class="muted small">${esc(song.artist)}</span></div><button class="btn sm" data-play="0">&#9654;</button></div></div>` : ""}
        <div class="panel"><h2>Top 8</h2>${top8.length ? `<div class="top8">${top8.map((a, i) => `<a href="#/artist/${enc(a.name)}"><img loading="lazy" src="${esc(ipfs(a.img))}" alt=""><span class="rank">#${i + 1}</span><span>${esc(a.name)}</span></a>`).join("")}</div>` : `<p class="muted">Collect some music and the Top 8 fills itself.</p>`}</div>
        ${early.length ? `<div class="panel"><h2>Early supporter</h2>${early.slice(0, 16).map(x => `<a class="badge" href="#/passport/${enc(x.t.id)}">${esc(x.t.title)} #${x.m}</a>`).join("")}</div>` : ""}
        <div class="panel"><h2>Playlists</h2>${myPls.length ? myPls.slice(0, 8).map(p => `<a class="m-row" href="#/pl/${enc(p.id)}">${mosaic(p.ids, "mosaic sm")}<span class="m-name"><b>${esc(p.name)}</b><span class="muted">${plural(p.ids.length, "song")}</span></span></a>`).join("") : `<p class="muted small">${isMe ? "Make one from any song with +." : "Playlists shared by this curator will show here once playlists live on chain. For now, open their share links."}</p>`}</div>
      </div>
      <div class="panel"><div class="row-head" style="margin:0 0 12px"><h2 style="margin:0">Poster wall</h2>
        <span class="actions" style="margin:0"><label class="toggle"><input type="checkbox" id="w-group"${w.group !== false ? " checked" : ""}> Group collections</label>${isMe ? `<button class="btn ghost sm" id="w-arrange">Arrange wall</button>` : ""}</span></div>
        <div class="tabs" id="wall-tabs"></div>
        <div id="wall"></div>${capped ? `<p class="muted small">Showing the latest 500 NFTs.</p>` : ""}
      </div>
    </div></div>`;
  const bu = safeImg(c.banner);
  if (bu) { const b = $("#c-banner"); b.classList.add("has-img"); b.style.backgroundImage = `linear-gradient(180deg,rgba(6,6,7,0) 45%,rgba(6,6,7,.6)),url("${bu}")`; }

  let grouped = w.group !== false, tab = "all", arranging = false, groups = [];
  const hidden = new Set(w.hidden || []);
  const mode = () => grouped ? "g" : "f";
  const sortGroups = () => {
    const ord = new Map(((w.orders || {})[mode()] || []).map((k, i) => [k, i]));
    const rank = g => ord.has(g.key) ? ord.get(g.key) : 1e5 + (g.kind === "music" ? 0 : 5e4) - Math.min(g.n, 49999);
    groups = wallGroups(assets, grouped).sort((a, b) => rank(a) - rank(b));
  };
  const persist = () => { if (!isMe) return; const cur = cornerCfg(acc); saveCorner(acc, { ...cur, wall: { group: grouped, orders: w.orders, hidden: [...hidden] } }); };
  const tile = g => {
    const src = ipfs(g.img);
    const media = src ? `<img loading="lazy" src="${esc(src)}" alt="">` : `<div class="noimg">${g.video ? "▶" : "◆"}</div>`;
    const badge = g.stack ? `<span class="cnt">${g.key.startsWith("r:") ? plural(g.items.length, "song") : "×" + g.n}</span>` : g.n > 1 ? `<span class="cnt">×${g.n}</span>` : "";
    const inner = `<div class="pmedia">${media}${badge}</div><div class="cap"><b>${esc(g.title)}</b><span class="muted">${esc(g.sub)}</span></div>${arranging ? `<button class="hide-btn" data-hide="${esc(g.key)}">${hidden.has(g.key) ? "Show" : "Hide"}</button>` : ""}`;
    const cls = `poster${g.stack ? " stack" : ""}${hidden.has(g.key) ? " is-hidden" : ""}`;
    if (arranging) return `<div class="${cls}" draggable="true" data-key="${esc(g.key)}">${inner}</div>`;
    if (g.stack && g.key.startsWith("c:")) return `<button class="${cls}" data-group="${esc(g.key)}">${inner}</button>`;
    return g.href ? `<a class="${cls}" href="${g.href}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  };
  const draw = () => {
    const vis = groups.filter(g => arranging || !hidden.has(g.key));
    const kinds = { all: vis.length, music: vis.filter(g => g.kind === "music").length, gigs: vis.filter(g => g.kind === "gigs").length, art: vis.filter(g => g.kind === "art").length };
    $("#wall-tabs").innerHTML = arranging ? `<span class="muted small">Drag tiles to reorder. Hide anything you don't want on show (test mints, spam drops). Then press Done.</span>`
      : [["all", "Everything"], ["music", "Music"], ["gigs", "Gigs & tickets"], ["art", "Art & more"]].map(([k, n]) => `<button class="tab${tab === k ? " on" : ""}" data-k="${k}">${n} · ${kinds[k]}</button>`).join("");
    $$("#wall-tabs .tab").forEach(b => b.onclick = () => { tab = b.dataset.k; draw(); });
    const list = vis.filter(g => arranging || tab === "all" || g.kind === tab);
    $("#wall").innerHTML = list.length ? `<div class="wall${arranging ? " arranging" : ""}">${list.map(tile).join("")}</div>${!arranging && isMe && hidden.size ? `<p class="muted small">${hidden.size} hidden from your wall.</p>` : ""}`
      : `<div class="empty-state" style="margin:0"><b>${tab === "gigs" ? "No gig tickets yet" : "Nothing here yet"}</b>${tab === "gigs" ? "When artists mint tickets or proof-of-attendance NFTs for their shows, the gigs you've been to land here." : ""}</div>`;
    $$("#wall [data-group]").forEach(b => b.onclick = () => openGroup(groups.find(g => g.key === b.dataset.group)));
    $$("#wall [data-hide]").forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.hide; hidden.has(k) ? hidden.delete(k) : hidden.add(k); draw(); });
    if (arranging) {
      let dragKey = null; const box = $("#wall .wall");
      box.addEventListener("dragstart", e => { const p = e.target.closest(".poster"); if (!p) return; dragKey = p.dataset.key; p.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragKey); });
      box.addEventListener("dragend", e => { e.target.closest(".poster")?.classList.remove("dragging"); });
      box.addEventListener("dragover", e => {
        const p = e.target.closest(".poster"); if (!p || !dragKey || p.dataset.key === dragKey) return; e.preventDefault();
        const src = box.querySelector(`.poster[data-key="${CSS.escape(dragKey)}"]`), r = p.getBoundingClientRect();
        box.insertBefore(src, e.clientX > r.left + r.width / 2 ? p.nextSibling : p);
      });
      box.addEventListener("drop", e => e.preventDefault());
    }
  };
  const openGroup = g => {
    if (!g) return;
    modal(`<div class="m-head"><div><h3>${esc(g.title)}</h3><div class="muted small">${esc(g.sub)}</div></div><button class="x" data-mclose>&times;</button></div>
      <div class="m-body"><div class="wall" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${g.items.map(i => { const s = ipfs(i.img); return `<div class="poster"><div class="pmedia">${s ? `<img loading="lazy" src="${esc(s)}" alt="">` : `<div class="noimg">${i.video ? "▶" : "◆"}</div>`}${i.n > 1 ? `<span class="cnt">×${i.n}</span>` : ""}</div><div class="cap"><b>${esc(i.name)}</b></div></div>`; }).join("")}</div></div>`, "wide");
  };
  sortGroups(); draw();
  $("#w-group").onchange = e => { grouped = e.target.checked; sortGroups(); draw(); persist(); };
  if (isMe) $("#w-arrange").onclick = () => {
    if (!arranging) { arranging = true; tab = "all"; $("#w-arrange").textContent = "Done"; $("#w-arrange").className = "btn sm"; draw(); return; }
    w.orders = { ...(w.orders || {}), [mode()]: $$("#wall .poster[data-key]").map(p => p.dataset.key) };
    arranging = false; $("#w-arrange").textContent = "Arrange wall"; $("#w-arrange").className = "btn ghost sm";
    persist(); sortGroups(); draw(); toast("Wall saved");
  };
  $("#c-share").onclick = () => shareModal(`${prof.name || acc}'s corner on Splendor Music`, location.href);
  if (isMe) $("#c-edit").onclick = () => editCorner(acc, wallGroups(assets, true));
  hydrate(view());
}

function editCorner(acc, groups) {
  const c = cornerCfg(acc), top = new Set(Array.isArray(c.top8) ? c.top8 : []);
  let banner = safeImg(c.banner);
  const songs = TRACKS.slice().sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title));
  const pics = groups.flatMap(g => g.items).map(i => ipfs(i.img)).filter(Boolean).filter((u, i, a) => a.indexOf(u) === i).slice(0, 36);
  const m = modal(`<div class="m-head"><div><h3>Edit my corner</h3><div class="muted small">Saved on this device for now. The live version saves it to your XPR account.</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      <label>Banner</label>
      <div class="banner-edit" id="e-banner"></div>
      <div class="actions" style="margin:0"><button class="btn ghost sm" id="e-up">Upload image</button><button class="btn ghost sm" id="e-pick">Use one of my NFTs</button><button class="btn ghost sm" id="e-rm">Remove</button><input type="file" id="e-file" accept="image/*" hidden></div>
      <div class="pick-imgs" id="e-pics" hidden>${pics.map(u => `<button data-pic="${esc(u)}"><img loading="lazy" src="${esc(u)}" alt=""></button>`).join("")}</div>
      <label>Headline / mood<input id="e-head" maxlength="80" value="${esc(c.headline || "")}" placeholder="e.g. Writing the next record by the sea"></label>
      <label>Location<input id="e-loc" maxlength="60" value="${esc(c.location || "")}" placeholder="e.g. Bargara, QLD"></label>
      <label>Bio<textarea id="e-about" rows="4" maxlength="800">${esc(c.about || "")}</textarea></label>
      <label>Social links</label>
      <div class="link-grid">${LINKS.map(([k, n]) => `<label>${n}<input data-link="${k}" maxlength="200" value="${esc(c.links?.[k] || "")}" placeholder="https://…"></label>`).join("")}</div>
      <label>Corner colour<input id="e-color" type="color" value="${/^#[0-9a-f]{6}$/i.test(c.color || "") ? esc(c.color) : "#7b88ff"}" style="height:42px;padding:4px"></label>
      <label>Profile song<select id="e-song"><option value="">Auto (your earliest collect)</option>${songs.map(t => `<option value="${esc(t.id)}"${String(c.song) === t.id ? " selected" : ""}>${esc(t.artist)} · ${esc(t.title)}</option>`).join("")}</select></label>
      <label>Top 8 artists <span class="small" id="e-n">(${top.size}/8)</span></label>
      <div class="pick-grid">${ARTISTS.map(a => `<label><input type="checkbox" value="${esc(a.name)}"${top.has(a.name) ? " checked" : ""}>${esc(a.name)}</label>`).join("")}</div>
      <div class="err" id="e-err"></div>
    </div>
    <div class="m-foot"><button class="btn ghost" data-mclose>Cancel</button><button class="btn" id="e-save">Save</button></div>`, "wide");
  const showBanner = () => { const el = $("#e-banner", m); el.style.backgroundImage = banner ? `url("${banner}")` : ""; el.textContent = banner ? "" : "No banner yet"; };
  showBanner();
  $("#e-up", m).onclick = () => $("#e-file", m).click();
  $("#e-rm", m).onclick = () => { banner = ""; showBanner(); };
  $("#e-pick", m).onclick = () => { $("#e-pics", m).hidden = !$("#e-pics", m).hidden; };
  $$("[data-pic]", m).forEach(b => b.onclick = () => { banner = safeImg(b.dataset.pic); showBanner(); $("#e-pics", m).hidden = true; });
  $("#e-file", m).onchange = () => {
    const f = $("#e-file", m).files[0]; if (!f || !f.type.startsWith("image/")) return;
    const rd = new FileReader();
    rd.onload = () => { const img = new Image(); img.onload = () => {
      const W = 1500, H = 500, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
      cv.getContext("2d").drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      banner = cv.toDataURL("image/jpeg", 0.85); showBanner();
    }; img.src = rd.result; };
    rd.readAsDataURL(f);
  };
  const boxes = $$(".pick-grid input", m);
  boxes.forEach(b => b.onchange = () => { if (boxes.filter(x => x.checked).length > 8) { b.checked = false; toast("Top 8 means 8"); } $("#e-n", m).textContent = `(${boxes.filter(x => x.checked).length}/8)`; });
  $("#e-save", m).onclick = () => {
    const links = {}, bad = [];
    $$("[data-link]", m).forEach(i => { const v = i.value.trim(); if (!v) return; const u = safeUrl(/^https?:\/\//i.test(v) ? v.replace(/^http:/i, "https:") : "https://" + v.replace(/^\/+/, "")); if (u) links[i.dataset.link] = u; else bad.push(i.dataset.link); });
    if (bad.length) { $("#e-err", m).textContent = `Check the ${bad.join(", ")} link.`; return; }
    if (banner && banner.length > 1500000) { $("#e-err", m).textContent = "That banner is too big. Try a smaller image."; return; }
    try {
      saveCorner(acc, { ...cornerCfg(acc), banner, headline: $("#e-head", m).value.trim(), location: $("#e-loc", m).value.trim(), about: $("#e-about", m).value.trim(), links,
        color: $("#e-color", m).value, song: $("#e-song", m).value, top8: boxes.filter(x => x.checked).map(x => x.value) });
    } catch { $("#e-err", m).textContent = "That banner is too big to save. Try a smaller image."; return; }
    MODAL_DIRTY = true; closeModal(); toast("Corner saved");
  };
}

/* ---------- The playlisting economy ---------- */
/* proposed: curator takes half the pipeline (all of it if nobody passed it on); the share chain takes the other half,
   the person who shared it to the buyer gets the biggest slice, halving back up the chain; the first sharer keeps the rest */
function pipeline(price, artistPct, curator, sharers) {
  const pool = price * (100 - artistPct) / 100, legs = [];
  if (!curator) return { artist: price, legs };
  if (!sharers.length) { legs.push({ who: curator, role: "Curator", amt: pool, idx: -1 }); return { artist: price - pool, legs }; }
  legs.push({ who: curator, role: "Curator", amt: pool / 2, idx: -1 });
  let rest = pool / 2;
  for (let k = sharers.length - 1; k >= 0; k--) {
    const amt = k === 0 ? rest : rest / 2;
    legs.push({ who: sharers[k], role: k === sharers.length - 1 ? `Share ${k + 1} · shared it to the buyer` : `Share ${k + 1} · passed it on`, amt, idx: k }); rest -= amt;
  }
  return { artist: price * artistPct / 100, legs };
}
/* the playlisting economy: lives at the bottom of the Playlists tab (#/playlists/economy) */
async function economy(el) {
  el.innerHTML = `<div class="loading">Reading the split contract…</div>`;
  await CHAIN.ready;
  if (!el.isConnected) return;
  const m = me(), def = byId.get("130261") || TRACKS[0];
  const proof = [...CHAIN.collects.entries()].flatMap(([tid, l]) => l.map(c => ({ ...c, t: byId.get(tid) }))).filter(c => c.t).sort((a, b) => b.outs.length - a.outs.length)[0];
  const songs = TRACKS.slice().sort((a, b) => (a.artist + a.title).localeCompare(b.artist + b.title));
  el.innerHTML = `
  <div class="panel" style="padding:26px 28px"><p style="font-size:17px;margin:0 0 10px;color:#dcd8ea">Mint on Vibrr. Listen and share on Splendor Music. We're in the age of turning our social, digital interactions into ways to hold each other up, while AI helps all of us expand what we're aware of. Playlists are word of mouth. Here, word of mouth pays.</p>
    <p class="muted" style="font-size:15px;margin:0">Artists opt in and choose the share. Say they keep 80% through their Music Passport split: the other 20% flows back down the pipeline to the people who helped the song get there: the curator who made the playlist, and every person who passed it on. Share for share, like Facebook back in 2019, except this time the people sharing get paid too.</p></div>
  <div class="steps">
    <div class="step"><span class="k">01</span><b>Artists mint</b><p>Release on Vibrr with a Music Passport: credits, copyright, permissions, and a payment split enforced on chain.</p></div>
    <div class="step"><span class="k">02</span><b>Listeners curate</b><p>Collect what you love, build playlists, and decorate your Corner with your music, gigs and art.</p></div>
    <div class="step"><span class="k">03</span><b>Shares carry the chain</b><p>Every share link remembers who made the playlist and who passed it on, up to ${PIPE.hops} people deep.</p></div>
    <div class="step"><span class="k">04</span><b>Everyone earns</b><p>When someone collects through the link, one transaction pays the artist's split and the whole pipeline, all public on the song's Passport.</p></div>
  </div>
  <div class="row-head"><h2>Try it: follow one collect</h2><span class="muted small">Proposed rules. Every number here can be tuned.</span></div>
  <div class="sim">
    <div class="panel">
      <label class="field">Song<select id="s-song">${songs.map(t => `<option value="${esc(t.id)}"${t === def ? " selected" : ""}>${esc(t.artist)} · ${esc(t.title)}</option>`).join("")}</select></label>
      <label class="field">Collect price<div class="row"><input id="s-price" type="number" min="1" step="1" value="${+(def && def.d.sale_price) || 100}"><span id="s-cur" class="mono">${esc((def && def.d.sale_currency) || "XPR")}</span></div></label>
      <label class="field">Artist share: <b id="s-artv" style="color:var(--text)">${PIPE.artist}%</b><input id="s-art" type="range" min="50" max="95" step="5" value="${PIPE.artist}"></label>
      <label class="field">Curator (made the playlist)<input id="s-curator" value="${esc(m || "curator")}" maxlength="12"></label>
      <div class="field">Share chain, in order<div id="s-chain" style="display:flex;flex-direction:column;gap:6px"></div>
        <div class="row"><button class="btn ghost sm" id="s-add">+ Add a share</button><button class="btn ghost sm" id="s-none">Direct collect (no playlist)</button></div></div>
    </div>
    <div class="panel"><div id="s-out"></div></div>
  </div>
  <div class="pgrid">
    <div class="panel"><h2>The rules (proposed)</h2><ol class="rules">
      <li>Collect straight from the artist, no playlist: <b>100%</b> goes to the artist's Passport split.</li>
      <li>The artist opts in and sets the pipeline share. Example: <b>80%</b> to the artist's split, <b>20%</b> to the pipeline.</li>
      <li>The curator who made the playlist takes half the pipeline, or all of it if they shared it straight to the buyer.</li>
      <li>The other half goes to the share chain: whoever shared it to the buyer gets the biggest slice, halving back up the chain.</li>
      <li>Fair play: up to ${PIPE.hops} people per chain, each account once, and nobody earns from their own collect (that slice returns to the artist).</li>
      <li>Every payout happens in the same transaction and shows on the song's Passport ledger, forever.</li></ol></div>
    <div class="panel"><h2>A discovery engine for artists</h2>
      <p>Playlists become the map of how music travels. Artists see which curators and which shares brought them new collectors, and can follow and reward them. Curators build a public record of the artists they found early. Listeners find new music through people they trust, not an algorithm.</p>
      <h3 style="margin-top:16px">Why this can run on XPR today</h3>
      <p class="muted">Vibrr's split contract already pays several wallets in one transaction when a song is collected. Adding the pipeline means one more field in the collect memo (our sketch: <span class="mono">mint,130261,via:curator&gt;sharer1&gt;sharer2</span>; Vibrr will set the real format), plus an audited contract update. Vibrr is scoping it now, with artists opting in and setting their own share. Until then every collect uses the plain <span class="mono">mint,&lt;song&gt;</span> memo.</p>
      ${proof ? `<div class="proof"><img src="${esc(ipfs(proof.t.img))}" alt="" style="width:56px;height:56px;border-radius:8px;object-fit:cover"><div>Proof the rails work: on ${date(proof.time)}, ${acctLink(proof.buyer)} collected <a href="#/passport/${enc(proof.t.id)}"><b>${esc(proof.t.title)}</b></a> for ${num(proof.paid.n)} ${esc(proof.paid.sym)}, and the contract made <b>${proof.outs.length} payouts</b> in that same transaction. <a target="_blank" rel="noopener" href="${EXPLORER}/transaction/${enc(proof.trx)}" style="color:var(--accent)">See it on chain ↗</a></div></div>` : ""}
    </div>
  </div>
  <div class="note">Prototype: this page shows the maths. Splendor Music sends no payments. Live payouts need the Vibrr team's audited contract.</div>`;
  const sharers = ["sharer1", "sharer2"]; let direct = false;
  const drawChain = () => {
    $("#s-chain").innerHTML = sharers.map((s, i) => `<div class="row"><span class="mono muted" style="width:22px">${i + 1}</span><input data-si="${i}" value="${esc(s)}" maxlength="12"><button class="ic" data-sx="${i}" title="Remove">&#10005;</button></div>`).join("") || `<span class="muted small">Nobody passed it on: the curator shared it straight to the buyer.</span>`;
    $$("[data-si]").forEach(inp => inp.oninput = () => { sharers[+inp.dataset.si] = inp.value.trim() || "someone"; calc(); });
    $$("[data-sx]").forEach(b => b.onclick = () => { sharers.splice(+b.dataset.sx, 1); drawChain(); calc(); });
  };
  const calc = () => {
    const t = byId.get($("#s-song").value) || def, price = Math.max(0, +$("#s-price").value || 0), cur = $("#s-cur").textContent, art = +$("#s-art").value;
    const curator = $("#s-curator").value.trim() || "curator";
    $("#s-artv").textContent = direct ? "100% (direct collect)" : art + "%";
    const res = direct ? { artist: price, legs: [] } : pipeline(price, art, curator, sharers);
    const ps = payShares(t);
    const all = [...ps.legs.map(l => ({ who: l.who, role: "Artist split · " + l.roles.join(" + "), amt: res.artist * l.pct / 100 })), ...res.legs];
    const nodes = [{ who: t.artist, role: "Artist", amt: res.artist },
      ...(direct ? [] : [{ who: curator, role: "Curator", amt: res.legs[0]?.amt || 0 }, ...sharers.map((s, i) => ({ who: s, role: `Share ${i + 1}`, amt: res.legs.find(l => l.idx === i)?.amt || 0 }))]),
      { who: "New fan", role: "Collects", amt: -price }];
    $("#s-out").innerHTML = `<div class="sub-h">How ${num(price)} ${esc(cur)} travels</div>
      <div class="chainnodes">${nodes.map((n, i) => `${i ? `<span class="arrow">←</span>` : ""}<div class="node"><span class="r">${esc(n.role)}</span><span class="acc">${esc(n.who)}</span><b style="color:${n.amt < 0 ? "var(--muted)" : "var(--ok)"}">${n.amt < 0 ? "pays " + num(-n.amt) : "+" + num(n.amt)}</b></div>`).join("")}</div>
      ${splitBar(all.map(l => ({ who: l.who, pct: price ? 100 * l.amt / price : 0 })))}
      <div class="legs">${all.map((l, i) => `<div class="leg"><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span><b style="font-family:Inter;font-size:14px">${esc(l.who)}</b><span class="r">${esc(l.role)}</span><b>${num(l.amt)} ${esc(cur)} · ${price ? (100 * l.amt / price).toFixed(1) : 0}%</b></div>`).join("")}</div>
      <p class="muted small" style="margin-top:12px">${ps.src === "chain" ? `The artist's share is divided by the split registered on chain for “${esc(t.title)}”.` : ps.src === "declared" ? `The artist's share is divided by the split declared in “${esc(t.title)}”'s Passport.` : `No split registered for “${esc(t.title)}” yet, so the artist's share goes to the collection owner.`}</p>`;
  };
  $("#s-song").onchange = () => { const t = byId.get($("#s-song").value); if (t) { $("#s-price").value = +t.d.sale_price || 100; $("#s-cur").textContent = t.d.sale_currency || "XPR"; } calc(); };
  $("#s-price").oninput = calc; $("#s-art").oninput = calc; $("#s-curator").oninput = calc;
  $("#s-add").onclick = () => { if (direct) { direct = false; $("#s-none").textContent = "Direct collect (no playlist)"; } if (sharers.length < PIPE.hops) { sharers.push("sharer" + (sharers.length + 1)); drawChain(); calc(); } else toast(`Chains stop at ${PIPE.hops} people`); };
  $("#s-none").onclick = () => { direct = !direct; $("#s-none").textContent = direct ? "Through a playlist" : "Direct collect (no playlist)"; calc(); };
  drawChain(); calc(); hydrate(el);
}

/* ---------- Playlists tab: curators, the weekly brief, Featured spots (his design, 24 Nov 2026) ----------
   Splendor Radio = editorial (SI picks from artist submissions). Playlists = where curators live.
   Curators answer a weekly BRIEF; the best entries get the call-up: a Featured spot + a guest slot on a station.
   Nobody can buy a spot. Prototype: entries live in this browser until there's a shared playlist registry. */
const BRIEF = { id: "brief-1", no: 1, title: "Salt Air Sunday", min: 10, max: 20, perArtist: 2,
  blurb: "Slow mornings by the sea. Acoustic, warm and unhurried: the songs you'd play with the doors open and the coffee on.",
  words: ["acoustic", "folk", "chill", "calm", "mellow", "warm", "uplifting", "nostalgic", "peaceful", "relax", "soft", "dream", "happy", "reflective",
          "sea", "ocean", "beach", "surf", "salt", "morning", "sunday", "sun", "indie", "singer", "roots", "country", "guitar", "piano", "ambient", "love"] };
function briefCloses() { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7); d.setHours(23, 59, 0, 0); return d; }
const briefText = t => [t.d.genre, t.d.mood, t.d.about, t.d.description, t.title, t.release].filter(Boolean).join(" ").toLowerCase();
// the SI rules for a brief, published so every curator plays by the same ones
function briefScore(tracks, b = BRIEF) {
  const n = tracks.length; if (!n) return { score: 0, parts: [], tips: [`Add ${b.min} to ${b.max} songs to get a score.`] };
  const per = new Map(); tracks.forEach(t => per.set(t.artist, (per.get(t.artist) || 0) + 1));
  const excess = [...per.values()].reduce((s, c) => s + Math.max(0, c - b.perArtist), 0);
  const fit = tracks.filter(t => b.words.some(w => briefText(t).includes(w))).length / n;
  const disc = tracks.filter(t => (t.issued || 0) <= 10).length / n;
  const pass = typeof siPick === "function" ? tracks.reduce((s, t) => s + siPick(t).passport, 0) / n : .5;
  let adj = 0; for (let i = 1; i < n; i++) if (tracks[i].artist === tracks[i - 1].artist) adj++;
  const flow = n > 1 ? 1 - adj / (n - 1) : 1, size = n < b.min ? n / b.min : n > b.max ? b.max / n : 1, variety = Math.max(0, 1 - excess / n);
  const parts = [["Fits the brief", fit, 30], ["Discovery", disc, 20], ["Variety", variety, 15], ["Length", size, 15], ["Flow", flow, 10], ["Song details", pass, 10]];
  const tips = [];
  if (n < b.min) tips.push(`Add ${b.min - n} more song${b.min - n === 1 ? "" : "s"} (${b.min} to ${b.max}).`); else if (n > b.max) tips.push(`Trim to ${b.max} songs.`);
  if (fit < .6) tips.push("More songs that feel like the brief: acoustic, warm, by-the-sea moods.");
  if (disc < .4) tips.push("Find a few undiscovered artists (songs with 10 or fewer copies collected).");
  if (excess) tips.push(`Max ${b.perArtist} songs per artist.`);
  if (flow < 1) tips.push("Spread out songs by the same artist.");
  if (pass < .6) tips.push("Songs with complete Music Passports score higher.");
  return { score: Math.round(parts.reduce((s, [, v, w]) => s + v * w, 0)), parts, tips };
}
const scoreBlock = s => `<div class="score"><div class="ring" style="--v:${s.score}">${s.score}</div><div class="parts">${s.parts.map(([k, v]) => `<div class="sbar"><span>${k}</span><i><b style="width:${Math.round(v * 100)}%"></b></i><span>${Math.round(v * 100)}</span></div>`).join("")}</div></div>
  ${s.tips.length ? `<ul class="tips">${s.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small" style="color:var(--ok);margin:10px 0 0">Strong entry. Share it so listeners can find it.</p>`}`;
const briefEntry = () => PL.all().find(p => p.brief === BRIEF.id);
function startBriefEntry() {
  const e = briefEntry(); if (e) { location.hash = "#/pl/" + e.id; return; }
  const pl = PL.create(`${BRIEF.title}`, [], { brief: BRIEF.id, desc: `My entry for Brief #${BRIEF.no}: ${BRIEF.blurb}` });
  toast(`Your entry for “${BRIEF.title}” is ready. Add ${BRIEF.min} to ${BRIEF.max} songs.`);
  location.hash = "#/pl/" + pl.id;
}
function briefRules() {
  modal(`<div class="m-head"><div><h3>How entries are judged</h3><div class="muted small">Brief #${BRIEF.no} · ${esc(BRIEF.title)}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body"><p style="margin:0">Every entry is scored with the same published rules. Money is never part of it.</p>
      <div class="legs">${[["Fits the brief", 30, "the songs' genres, moods and stories match the brief"], ["Discovery", 20, "artists still waiting to be found"], ["Variety", 15, `max ${BRIEF.perArtist} songs per artist`], ["Length", 15, `${BRIEF.min} to ${BRIEF.max} songs`], ["Flow", 10, "no back-to-back songs by the same artist (later: tempo, key and energy)"], ["Song details", 10, "credits, owners, permissions and pay shares filled in"]]
        .map(([k, w, s], i) => `<div class="leg"><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span><b style="font-family:Inter;font-size:14px">${k}</b><span class="r">${s}</span><b>${w}%</b></div>`).join("")}</div>
      <p class="muted small" style="margin:0">Then real listening decides between the best: people who play the playlist through, save it, and collect from it. The top entries get a Featured spot for two weeks and a guest slot on a Splendor Radio station.</p></div>
    <div class="m-foot"><button class="btn" data-mclose>Got it</button></div>`);
}
function curatorModal() {
  const m = me(), e = briefEntry();
  const mm = modal(`<div class="m-head"><div><h3>Become a curator</h3><div class="muted small">Three steps. Free, always.</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body"><div class="steps-big">
      <div class="sb"><span class="sb-i">1</span><div><b>${m ? `Signed in as ${esc(m)}` : "Sign in with WebAuth"}</b><small>Your XPR account is your curator name and where your share gets paid.</small></div></div>
      <div class="sb"><span class="sb-i">2</span><div><b>Build a playlist</b><small>Start with this week's brief, “${esc(BRIEF.title)}”, or any theme you love.</small></div></div>
      <div class="sb"><span class="sb-i">3</span><div><b>Share it anywhere</b><small>Your link carries your name. When listeners collect through it, you earn (once artists opt in).</small></div></div>
    </div></div>
    <div class="m-foot">${m ? "" : `<button class="btn ghost" id="cm-sign">Sign in</button>`}<button class="btn" id="cm-go">${e ? "Open my brief entry" : "Start my brief entry"}</button></div>`, "sheet");
  $("#cm-go", mm).onclick = () => { closeModal(); startBriefEntry(); };
  if ($("#cm-sign", mm)) $("#cm-sign", mm).onclick = () => { closeModal(); accountMenu(); };
}
function playlistsPage(focus) {
  const m = me(), mine = PL.all(), entry = briefEntry();
  const closes = briefCloses().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  const entryTracks = entry ? entry.ids.map(i => byId.get(i)).filter(Boolean) : [];
  view().innerHTML = `
  <section class="manifesto curate-hero"><div class="eyebrow">Playlists · for curators</div>
    <h1>Good taste pays.</h1>
    <p>Build playlists, answer the brief, and earn when listeners collect the songs you found.</p>
    <div class="actions"><button class="btn big" id="be-curator">Become a curator</button><a class="btn ghost big" href="#/playlists/brief">This week's brief</a></div></section>

  <div class="row-head" id="brief"><h2>This week's brief</h2><span class="muted small">Brief #${BRIEF.no} · free to enter · picked by open rules, never sold</span></div>
  <section class="brief">
    <div><span class="closes">Open · closes ${esc(closes)}</span><h2>${esc(BRIEF.title)}</h2>
      <p style="font-size:16px;color:#d8d1e3;margin:0">${esc(BRIEF.blurb)}</p>
      <ul><li>${BRIEF.min} to ${BRIEF.max} songs from Splendor Music</li><li>Max ${BRIEF.perArtist} songs per artist</li><li>Mix in artists still waiting to be discovered</li><li>One entry per curator</li></ul>
      <div class="actions">${entry ? `<a class="btn" href="#/pl/${enc(entry.id)}">Open your entry</a>` : `<button class="btn" id="brief-go">Start your entry</button>`}<button class="btn ghost" id="brief-rules">How entries are judged</button></div></div>
    <div class="prize">${entry ? `<b>Your entry · ${esc(entry.name)} · ${plural(entryTracks.length, "song")}</b>${scoreBlock(briefScore(entryTracks))}`
      : `<b>The call-up</b><p class="muted" style="margin:0">The best entries win a Featured spot for two weeks and a guest slot on a Splendor Radio station, credited to you. Like a DJ getting the call-up because they've got the tunes the party wants: your playlist plays at the party, even when you're not there.</p>`}</div>
  </section>

  <div class="row-head"><h2>Featured curators</h2><span class="muted small">12 spots · refreshed every fortnight · never sold</span></div>
  <div class="slots">${Array.from({ length: 12 }, (_, i) => `<div class="slot"><b>${i + 1}</b><span>Open spot</span></div>`).join("")}</div>
  <p class="muted small">The first twelve come from Brief #${BRIEF.no} entries. Featured spots are earned by answering briefs well, never bought.</p>

  <div class="row-head"><h2>Your curator studio</h2>${m ? `<a class="me-chip" href="#/u/${enc(m)}">${av(m)}<span>${esc(m)}</span></a>` : `<button class="btn ghost sm" id="pls-sign">Sign in to curate</button>`}</div>
  ${mine.length ? `<div class="grid">${mine.map(plCard).join("")}<button class="card new" id="pls-new"><span>+</span>New playlist</button></div>`
    : `<div class="empty-state"><b>No playlists yet</b>Start with this week's brief, or build one from songs you love.<div class="actions" style="justify-content:center"><button class="btn" id="brief-go2">Start your brief entry</button></div></div>`}

  <div class="row-head"><h2>How it works</h2></div>
  <div class="how3">
    <div class="panel"><h3>How playlists rise</h3><p class="muted" style="margin:0">Rankings use real listening: people who play your playlist through, save it, follow you, and collect songs from it. Finding artists early counts extra. Collecting through your own playlist, or the same accounts looping, doesn't count. Nobody can pay to move up.</p></div>
    <div class="panel"><h3>Radio and Playlists</h3><p class="muted" style="margin:0">Splendor Radio is the editorial side: stations picked by open, published rules from music artists submit, like Spotify's own playlists. Playlists is where curators live: anyone can build, share and climb on their taste. Winning a brief puts your playlist on the radio too.</p></div>
    <div class="panel"><h3>Artists: pitch to curators</h3><p class="muted" style="margin:0">Coming soon: pitch your song to curators right here. Free, a few pitches a week, no paying for a spot. Curators earn when listeners collect the songs they picked, so a weak song costs them too.</p></div>
  </div>

  <div class="row-head" id="economy"><h2>How curators get paid</h2></div>
  <p class="lead">When someone collects a song from your playlist, a share of that sale comes back to you, and to anyone who passed your playlist on. Each artist chooses whether to take part and how big the share is.</p>
  <details class="panel tech" id="econ-d"><summary>See how the money moves, step by step</summary><div id="econ" style="margin-top:14px"></div></details>`;
  $("#be-curator").onclick = curatorModal;
  $("#brief-rules").onclick = briefRules;
  [$("#brief-go"), $("#brief-go2")].forEach(b => b && (b.onclick = startBriefEntry));
  if ($("#pls-sign")) $("#pls-sign").onclick = accountMenu;
  if ($("#pls-new")) $("#pls-new").onclick = () => { const pl = PL.create(`My Playlist #${PL.all().length + 1}`); location.hash = "#/pl/" + pl.id + "/edit"; };
  economy($("#econ"));
  hydrate(view());
  if (focus === "economy") $("#econ-d").open = true;
  if (focus === "economy" || focus === "brief") setTimeout(() => $("#" + focus)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}


/* ---------- Trust & safety: how anyone can check Splendor Music is legit ---------- */
VIEWS.trust = async () => {
  view().innerHTML = `<div class="loading">Checking the chain…</div>`;
  await CHAIN.ready;
  const p = await profile("splendor");
  const pr = (CHAIN.collects.get("130261") || []).slice().sort((a, b) => b.time - a.time)[0];
  const row = (title, body) => `<div class="check-row"><span class="i">✓</span><span><b>${title}</b><span class="muted small">${body}</span></span></div>`;
  view().innerHTML = `
  <section class="manifesto" style="padding:36px"><div class="eyebrow">Trust &amp; safety</div><h1 style="font-size:42px">Don't trust us. Check us.</h1>
    <p>Splendor Music never holds your keys or your money. Every sign-in and every payment happens in WebAuth, the same window you use on Metal X, and every collect is a public transaction anyone can look up.</p></section>
  <div class="trust-grid">
    <div class="panel"><h2>Who's behind it</h2>
      <div class="contrib">${av("splendor", "md")}<span class="meta"><b>${esc(p.name || "Splendor")}${p.verified ? ` <span class="tick">✓</span>` : ""}</b><small>@splendor · ${p.kyc ? "KYC-verified XPR account (checked live just now)" : "XPR account"}</small></span><a class="pill" target="_blank" rel="noopener" href="${EXPLORER}/account/splendor">See on explorer ↗</a></div>
      <p class="muted small" style="margin:12px 0 0">Built by Lachlan Grant Splendor, an independent folk-rock artist from Bargara, Queensland. On XPR Network your @name is tied to a real, verified person: no anonymous devs.</p></div>
    <div class="panel"><h2>Check it yourself</h2>
      ${row("The WebAuth window tells the truth", "Before you approve, WebAuth shows the app name, the amount, who receives it (vibrrsplit, Vibrr's split contract) and the memo mint,&lt;song&gt;. Nothing moves until you approve.")}
      ${row("Every collect is public", pr ? `Like this one: on ${date(pr.time)} @${esc(pr.buyer)} collected Pristine for ${num(pr.paid.n)} ${esc(pr.paid.sym)} and the split paid out in the same transaction. <a target="_blank" rel="noopener" style="color:var(--accent)" href="${EXPLORER}/transaction/${enc(pr.trx)}">Look it up ↗</a>` : "Every payout is listed on the song's Music Passport with a link to the transaction.")}
      ${row("Your music is yours on chain", "Each copy you collect is an NFT in your own XPR account. It shows on Vibrr, explorers and any XPR app, not just here.")}
      ${row("No passwords, no servers holding your data", "There's no Splendor Music account to hack. Your playlists and offline songs live on your device; what you own is read from the chain.")}
      ${row("Open code (at launch)", "The whole app will be public on GitHub and the website is built straight from it, so anyone can read every line.")}</div>
  </div>
  <div class="trust-grid">
    <div class="panel"><h2>The contracts it uses</h2><div class="kv">
      <div class="k">Music NFTs</div><div class="v"><a class="mono" target="_blank" rel="noopener" href="${EXPLORER}/account/atomicassets">atomicassets ↗</a> the XPR standard</div>
      <div class="k">Payments + splits</div><div class="v"><a class="mono" target="_blank" rel="noopener" href="${EXPLORER}/account/${SPLITTER}">${SPLITTER} ↗</a> Vibrr's split contract</div>
      <div class="k">Sign-in + signing</div><div class="v">WebAuth (Metallicus)</div></div></div>
    <div class="panel"><h2>App stores</h2>
      <p class="muted small" style="margin-top:0">Splendor Music installs straight from its website, so the artist's share isn't cut. Google Play and the Microsoft Store can list web apps like this one too. Apple requires NFT sales inside App Store apps to go through its own in-app purchase, so an iPhone store version would be for listening, with collecting staying on the web.</p></div>
  </div>`;
  hydrate(view());
};

/* ---------- router ---------- */
/* ---------- For artists: why bring your music here (plain words, no jargon) ---------- */
function forArtists() {
  const card = (i, h, p) => `<div class="fa-card"><span class="fa-i">${i}</span><b>${h}</b><p>${p}</p></div>`;
  view().innerHTML = `
  <section class="hero fa-hero"><div class="eyebrow">For artists</div><h1>Your music. Your page. Yours to keep.</h1>
    <p class="hero-sub">No website builder to pay for. No monthly fee. Nobody can lock you out of your own work.</p>
    <p>Splendor Music gives every artist a home page and a store in one place, and you get paid the moment a fan collects.</p></section>
  <div class="fa-grid">
    ${card("♫", "A page that's really yours", "Your photos, bio, videos, links and every release in one place. Change it whenever you like, free, forever.")}
    ${card("$", "Paid straight away", "When a fan collects a song, you're paid in that moment, and your collaborators get their share automatically.")}
    ${card("✎", "Your lyrics, your words", "Add your lyrics and the story behind each song yourself. Nobody charges you to show your own words next to your own music.")}
    ${card("✋", "Fans tell you what's next", "Fans can ask for the releases they want here, so you know what to bring over first.")}
    ${card("★", "Found by good taste, not ads", "Curators, weekly briefs and radio that nobody can pay their way onto.")}
    ${card("◎", "Merch and tickets, coming", "Sell merch and gig tickets as collectables from the same page. Fans keep them, you keep the relationship.")}
    ${card("✓", "Protected by its Passport", "Every song carries a record of who made it and who owns it, tied to a verified identity. Copies and fakes have nowhere to hide.")}
    ${card("⇄", "Coming from Bandcamp?", "We'll help you bring your music over, with its credits and owners in its Passport from day one.")}
  </div>
  <div class="row-head"><h2>Getting started</h2></div>
  <div class="steps">
    <div class="step"><span class="k">1</span><b>Release on Vibrr</b><p>Put your music out on <a href="https://vibrr.ai" target="_blank" rel="noopener" style="color:var(--accent)">Vibrr</a> with its Music Passport: credits, owners and who gets paid.</p></div>
    <div class="step"><span class="k">2</span><b>Sign in here</b><p>Use the same account. Your page appears automatically.</p></div>
    <div class="step"><span class="k">3</span><b>Make it yours</b><p>Tap Edit artist page: photos, bio, videos, links, lyrics.</p></div>
    <div class="step"><span class="k">4</span><b>Share your link</b><p>Put your Splendor Music page in your Instagram and Spotify bio so fans can find you here.</p></div>
  </div>
  <p class="muted small" style="margin-top:22px">Your privacy: your page shows your artist name, not your wallet. The technical details are tucked away for anyone who wants to check them.</p>
  <div class="foot">Splendor Music · concept and product design by Lachlan Grant Splendor</div>`;
}

/* ---------- navigation that never loses you (his ask 24 Nov 2026) ----------
   - a Back button that names where it goes ("‹ The Choice Is Yours")
   - each tab remembers where you were: tap Radio, wander off to Discover, tap Radio again = right where you left it
   - tapping the tab you're already on takes you to its top
   - going Back puts you at the same scroll position you left */
const TABS = ["home", "radio", "playlists", "artists", "library"];
const TAB_ROOT = { home: "#/", radio: "#/radio", playlists: "#/playlists", artists: "#/artists", library: "#/library" };
const TAB_NAME = { home: "Discover", radio: "Radio", playlists: "Playlists", artists: "Artists", library: "Library" };
const ss = { get(k, d) { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const NAV = { stack: ss.get("nav.stack", []), tab: ss.get("nav.tab", "home"), last: ss.get("nav.last", {}), scroll: ss.get("nav.scroll", {}), cur: "", restore: false, next: "", fresh: false };
const curHash = () => location.hash && location.hash.length > 1 ? location.hash : "#/";
function navSave() {
  ss.set("nav.stack", NAV.stack.slice(-60)); ss.set("nav.tab", NAV.tab); ss.set("nav.last", NAV.last);
  const k = Object.keys(NAV.scroll); if (k.length > 80) k.slice(0, k.length - 80).forEach(x => delete NAV.scroll[x]); ss.set("nav.scroll", NAV.scroll);
}
function tabFor(p0) {
  if (NAV.next) { const t = NAV.next; NAV.next = ""; return t; }
  if (TABS.includes(p0)) return p0;
  if (p0 === "economy") return "playlists";
  if (NAV.stack.length > 1) return NAV.tab;                     // detail pages belong to the tab you opened them from
  return { pl: "library", offline: "library", u: "library", p: "playlists", playlist: "playlists", artist: "artists" }[p0] || "home";
}
function pageTitle(p0) {
  if (TABS.includes(p0) && p0 !== "playlists") return TAB_NAME[p0];
  if (p0 === "playlists" || p0 === "economy") return "Playlists";
  if (p0 === "search") return "Search";
  const h = view().querySelector("h1"); const t = (h?.textContent || "").trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 40) + "…" : t;
}
function navChrome(p0) {
  const top = NAV.stack[NAV.stack.length - 1], t = pageTitle(p0);
  if (top && t) top.t = t;
  document.title = t && p0 !== "home" ? `${t} · Splendor Music` : "Splendor Music";
  const prev = NAV.stack[NAV.stack.length - 2], b = $("#back-btn");
  const detail = !TABS.includes(p0) && !["playlists", "economy", "search"].includes(p0);
  let cr = view().querySelector(":scope > .crumb");
  if (prev && detail && !EMBED) {
    if (!cr) { cr = document.createElement("button"); cr.className = "crumb"; cr.onclick = () => $("#back-btn").click(); view().prepend(cr); }
    cr.innerHTML = `&#8249; Back to ${esc(prev.t || "the last page")}`;
  } else if (cr) cr.hidden = true;
  if (b) { b.hidden = !prev || EMBED; if (prev) { $(".lbl", b).textContent = prev.t || "Back"; b.title = "Back to " + (prev.t || "the last page"); } }
  navSave();
}
function restoreScroll(y, h) {
  let stop = false; const cancel = () => stop = true;
  ["wheel", "touchstart", "keydown"].forEach(ev => window.addEventListener(ev, cancel, { once: true, passive: true }));
  window.scrollTo(0, y);
  [60, 200, 450, 900, 1600].forEach(ms => setTimeout(() => { if (!stop && NAV.cur === h && Math.abs(window.scrollY - y) > 8) window.scrollTo(0, y); }, ms));
}
function setAmbient(img) {
  const a = $("#ambient"); if (!a) return;
  const u = img ? ipfs(img) : "";
  if (u) { a.style.backgroundImage = `url("${u.replace(/["\\\n\r]/g, encodeURIComponent)}")`; a.classList.add("on"); } else a.classList.remove("on");
}

function route(keep) {
  closeModal();
  if (typeof NP !== "undefined" && NP.open) npClose(true);
  let h; try { h = decodeURIComponent(location.hash.slice(1) || "/"); } catch { h = "/"; }
  const parts = h.split("/").filter(Boolean), p0 = parts[0] || "home", rest = parts.slice(1).join("/");
  const hash = curHash(), sy = window.scrollY;
  let restore = false;
  if (!keep) {
    if (NAV.cur && NAV.cur !== hash) NAV.scroll[NAV.cur] = sy;                       // remember where you were
    const s = NAV.stack, prev = s[s.length - 2];
    let tab;
    if (prev && prev.h === hash) { s.pop(); restore = true; tab = NAV.next || prev.tab; NAV.next = ""; }   // Back: same tab + spot as before
    else { tab = tabFor(p0); if (!s.length || s[s.length - 1].h !== hash) s.push({ h: hash, t: "", tab }); else s[s.length - 1].tab = tab; }
    restore = (restore || NAV.restore) && !NAV.fresh; NAV.restore = false; NAV.fresh = false;
    NAV.tab = tab || tabFor(p0); NAV.last[NAV.tab] = hash; NAV.cur = hash;
    setAmbient(null);
  }
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === NAV.tab && !a.classList.contains("brand")));
  if (p0 !== "search") $("#search").value = "";
  switch (p0) {
    case "home": home(); break;
    case "release": release(rest); break;
    case "artist": artist(rest); break;
    case "artists": artists(); break;
    case "library": if (parts[1]) { location.replace("#/u/" + enc(parts[1])); return; } library(); break;
    case "pl": playlistPage(parts[1], parts[2] === "edit"); break;
    case "p": sharedView(parts[1] || ""); break;
    case "playlist": sharedView(b64e(JSON.stringify({ n: parts[1] || "Playlist", i: (parts[2] || "").split(",") }))); break;
    case "passport": passportPage(parts[1]); break;
    case "u": corner(parts[1]); break;
    case "playlists": playlistsPage(parts[1]); break;
    case "economy": playlistsPage("economy"); break;                       // old links still land in the right place
    case "search": search(rest); break;
    case "for-artists": forArtists(); break;
    default: if (VIEWS[p0]) VIEWS[p0](parts, rest); else notFound();
  }
  if (keep) window.scrollTo(0, sy);
  else if (restore && NAV.scroll[hash] > 0) restoreScroll(NAV.scroll[hash], hash);
  else window.scrollTo(0, 0);
  markPlaying();
  navChrome(p0); setTimeout(() => { if (NAV.cur === hash) navChrome(p0); }, 700);   // async pages fill their title a moment later
}

(async function main() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";   // we restore scroll ourselves (per page)
  initPlayer(); initNP();
  document.addEventListener("click", e => {
    const t = e.target;
    // tabs (top nav, phone tab bar, logo): return to where you were in that tab; tap the current tab = its top
    const nv = t.closest("a[data-nav]");
    if (nv && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      const tab = nv.dataset.nav, root = TAB_ROOT[tab];
      if (tab === NAV.tab || nv.classList.contains("brand")) {
        if (curHash() === root) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
        else { NAV.next = tab; NAV.fresh = true; }
        return;
      }
      const last = NAV.last[tab]; NAV.restore = true; NAV.next = tab;
      if (last && last !== curHash()) { e.preventDefault(); location.hash = last; }
      return;
    }
    const el = t.closest("[data-editlyrics]"); if (el) { const tt = byId.get(el.dataset.editlyrics); if (tt) editArtist(tt.artist, tt.id); return; }
    const pr = t.closest("[data-playrel]"); if (pr) { e.preventDefault(); const r = relByKey.get(pr.dataset.playrel); if (r) playQueue(r.tracks); return; }
    const pp = t.closest("[data-playpl]"); if (pp) { e.preventDefault(); const p = PL.get(pp.dataset.playpl); if (p) playQueue(p.ids.map(i => byId.get(i))); return; }
    const pl = t.closest("[data-play]"); if (pl) { const box = pl.closest("[data-list]"), list = box && LISTS[box.dataset.list]; if (list) playQueue(list, +pl.dataset.play, box.dataset.ctx || ""); return; }
    const lk = t.closest("[data-like]"); if (lk) { if (lk.dataset.like) toggleLike(lk.dataset.like); return; }
    const sv = t.closest("[data-save]"); if (sv) { if (sv.dataset.save) saveTo(sv.dataset.save.split(",").map(i => byId.get(i)), sv.dataset.label); return; }
    const rm = t.closest("[data-remove]"); if (rm) {
      const id = (location.hash.match(/^#\/pl\/([^/]+)/) || [])[1]; if (!id) return;
      const i = +rm.dataset.remove, p = PL.get(id), gone = p?.ids[i]; if (gone === undefined) return;
      PL.update(id, x => x.ids.splice(i, 1)); route(true);
      toast(`Removed “${byId.get(gone)?.title || "song"}”`, { label: "Undo", fn: () => { PL.update(id, x => x.ids.splice(i, 0, gone)); route(true); } });
      return;
    }
    const ad = t.closest("[data-addto]"); if (ad) { PL.update(ad.dataset.addto, x => { if (!x.ids.includes(ad.dataset.tid)) x.ids.push(ad.dataset.tid); }); toast(`Added “${byId.get(ad.dataset.tid)?.title || "song"}”`); route(true); return; }
    const cp = t.closest("[data-copy]"); if (cp) { copy(cp.dataset.copy, "Copied " + cp.dataset.copy); return; }
    if (t.closest("#me-btn")) accountMenu();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  // images: try the next IPFS gateway; if none has it (unpinned NFT art), show a clean placeholder
  document.addEventListener("error", e => {
    const img = e.target; if (!(img instanceof HTMLImageElement) || !img.src) return;
    const off = img.src.match(/\/offline\/art\/(\d+)$/); if (off) { const t = byId.get(off[1]); img.src = t ? ipfs(t.img) : ""; return; }
    const g = GATEWAYS.findIndex(x => img.src.startsWith(x));
    if (g >= 0 && g < GATEWAYS.length - 1) { img.src = GATEWAYS[g + 1] + img.src.slice(GATEWAYS[g].length); return; }
    if (img.closest(".poster")) { const ph = document.createElement("div"); ph.className = "noimg"; ph.textContent = "◆"; img.replaceWith(ph); }
    else img.removeAttribute("src");
  }, true);
  let tm; $("#search").addEventListener("input", e => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      const q = e.target.value.trim();
      const fn = location.hash.startsWith("#/search/") ? "replaceState" : "pushState";
      if (q) { history[fn](null, "", "#/search/" + enc(q)); search(q); } else { history.replaceState(null, "", "#/"); home(); }
    }, 200);
  });
  if (!store.get("me", "") && store.get("account", "")) store.set("me", store.get("account", ""));   // v0.1 -> v0.2
  renderMe();
  // the installable app: offline-capable shell + install prompt
  if ("serviceWorker" in navigator && !EMBED) navigator.serviceWorker.register("sw.js").then(reg => { reg.waiting?.postMessage("skipWaiting"); reg.addEventListener("updatefound", () => { const n = reg.installing; n?.addEventListener("statechange", () => { if (n.state === "installed") n.postMessage("skipWaiting"); }); }); }).catch(() => {});
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL = e; $("#install-btn").hidden = false; });
  $("#install-btn").onclick = () => getApp();
  if (EMBED) {   // embedded player on someone else's website
    document.body.classList.add("embed");
    document.body.insertAdjacentHTML("beforeend", `<a class="embed-brand" target="_blank" rel="noopener" href="${esc(location.pathname + location.hash)}"><img class="s-mark" src="icons/s-mark.png" alt=""><b>Splendor</b>&nbsp;Music ↗</a>`);
  }
  try { await load(); } catch (e) { view().innerHTML = `<p class="muted">Couldn't read the XPR Network right now (${esc(e.message)}). Try again in a minute.</p>`; return; }
  CHAIN.ready = loadLedger();
  window.addEventListener("hashchange", () => route());
  route();
  if (typeof loadOwned === "function" && me()) loadOwned();
  setTimeout(appBanner, 4000);
  if (store.get("wa", false) && typeof waConnect === "function") waConnect(true).then(() => renderMe()).catch(() => {});
})();
