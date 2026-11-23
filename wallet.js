/* Splendor Music: WebAuth sign-in, what you own, collecting in-app, offline songs and downloads (prototype v0.3).
   Collecting = the same on-chain flow Vibrr uses: you send the listed price to Vibrr's split contract with the memo
   "mint,<template>", and in that one transaction it pays the artist's split and mints a fresh copy to you.
   You approve the exact transfer in WebAuth; Splendor Music never holds money or keys. */
"use strict";
const SDK_URL = "https://cdn.jsdelivr.net/npm/@proton/web-sdk@5.1.0/lib/proton-web-sdk.bundle.js";
const RPCS = ["https://proton.greymass.com", "https://rpc.api.mainnet.metalx.com"];
const APP_ACCOUNT = "splendor";            // shown in WebAuth as the requesting app (his KYC-verified @name); a dedicated @splendormusic account later
const AUDIO_CACHE = "pp-offline-v1";
const WALLET = { link: null, session: null };
const MINTS = new Map(), DL = new Set();  // template -> your best mint number; songs downloading right now

/* ---------- WebAuth ---------- */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.ProtonWebSDK) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Couldn't load WebAuth. Check your connection.")); document.head.append(s);
  });
}
async function waConnect(restore) {
  await loadScript(SDK_URL);
  const r = await window.ProtonWebSDK({
    linkOptions: { endpoints: RPCS, restoreSession: !!restore },
    transportOptions: { requestAccount: APP_ACCOUNT },
    selectorOptions: { appName: "Splendor Music", appLogo: new URL("icons/icon-192.png", location.href).href }
  });
  WALLET.link = r?.link || null; WALLET.session = r?.session || null;
  if (WALLET.session) {
    const acc = String(WALLET.session.auth.actor);
    store.set("me", acc); store.set("wa", true); renderMe(); await loadOwned(true);
  }
  return WALLET.session;
}
async function waLogout() {
  try { if (WALLET.link && WALLET.session) await WALLET.link.removeSession(APP_ACCOUNT, WALLET.session.auth); } catch {}
  WALLET.link = WALLET.session = null; store.set("wa", false); renderMe();
}
const verified = () => !!WALLET.session && String(WALLET.session.auth.actor) === me();

/* ---------- what you own (read from the chain; remembered for offline) ---------- */
async function loadOwned(rerender) {
  const acc = me(); const before = [...OWN].sort().join();
  OWN.clear(); MINTS.clear();
  if (!acc) { if (rerender) route(true); return; }
  store.get("owned:" + acc, []).forEach(x => { OWN.add(String(x.id)); MINTS.set(String(x.id), +x.mint); });
  try {
    const best = new Map();
    for (let page = 1; page <= 10; page++) {
      const d = await getJSON(`${API}/assets?owner=${enc(acc)}&schema_name=${SCHEMA}&limit=100&page=${page}`);
      d.forEach(a => { const id = String(a.template?.template_id), m = +a.template_mint; if (!best.has(id) || m < best.get(id)) best.set(id, m); });
      if (d.length < 100) break;
    }
    OWN.clear(); MINTS.clear(); best.forEach((m, id) => { OWN.add(id); MINTS.set(id, m); });
    store.set("owned:" + acc, [...best.entries()].map(([id, mint]) => ({ id, mint })));
  } catch {}
  if (rerender || [...OWN].sort().join() !== before) { if (!$(".modal-bg") && !document.activeElement?.matches("input,textarea,select")) route(true); }
  if (P.cur()) updateCollectBtn(P.cur());
  if (store.get("autoOffline", false) && OWN.size) saveAllOffline([...OWN], true);
}

/* ---------- collecting ---------- */
function collectInfo(t, again) {
  const d = t.d, price = +d.sale_price, sym = String(d.sale_currency || "").trim().toUpperCase(), tok = CHAIN.tokens.get(sym);
  if (OWN.has(t.id) && !again) return { ok: false, owned: true, why: "You own this" };
  if (CHAIN.paused) return { ok: false, why: "Vibrr's split contract is paused right now" };
  if (!CHAIN.splits.has(t.id)) return { ok: false, why: "Not registered with Vibrr's split contract yet" };
  if (!(price > 0) || !tok) return { ok: false, why: "No listed price yet" };
  if (!(t.minters || []).includes(SPLITTER)) return { ok: false, why: "The split contract can't mint this collection" };
  if (t.max > 0 && t.issued >= t.max) return { ok: false, why: "Sold out" };
  return { ok: true, price, sym, tok, qty: `${price.toFixed(tok.precision)} ${sym}`, label: `${num(price)} ${sym}` };
}
function updateCollectBtn(t) {
  const b = $("#p-collect"); if (!b || !t) return;
  const ci = collectInfo(t);
  b.hidden = !(ci.ok || ci.owned);
  b.dataset.collect = ci.ok ? t.id : "";
  b.className = "btn sm" + (ci.owned ? " ghost owned" : "");
  b.textContent = ci.owned ? `✓ Yours #${MINTS.get(t.id) ?? ""}` : `Collect · ${ci.label}`;
}
function renderOwnActions(t) {
  const el = $("#own-actions"); if (!el) return;
  const ci = collectInfo(t), more = ci.owned && collectInfo(t, true);
  el.innerHTML = ci.owned
    ? `<span class="pill ok">✓ You own #${esc(MINTS.get(t.id))}</span><button class="btn ghost" data-offline="${esc(t.id)}">${OFF.has(t.id) ? "✓ Saved offline" : "⤓ Save offline"}</button><button class="btn ghost" data-dl="${esc(t.id)}">Download file</button>${more.ok ? `<button class="btn ghost" data-collect="${esc(t.id)}" data-again="1">Collect another copy · ${esc(more.label)}</button>` : ""}`
    : ci.ok ? `<button class="btn" data-collect="${esc(t.id)}">Collect · ${esc(ci.label)}</button>`
    : `<a class="btn ghost" href="https://vibrr.ai/radio" target="_blank" rel="noopener" title="${esc(ci.why)}">Collect on Vibrr ↗</a>`;
}
async function collect(id, again) {
  const t = byId.get(String(id)); if (!t) return;
  const ci = collectInfo(t, again); if (!ci.ok) { toast(ci.why); return; }
  const ps = payShares(t);
  const m = modal(`<div class="m-head"><div><h3>Collect “${esc(t.title)}”</h3><div class="muted small">${esc(t.artist)} · ${esc(edition(t))}</div></div><button class="x" data-mclose>&times;</button></div>
    <div class="m-body">
      <div class="psong"><img src="${esc(ipfs(t.img))}" alt=""><div class="m"><b>${esc(t.title)}</b><span class="muted small">A fresh copy is minted straight to your account</span></div><b class="mono">${esc(ci.qty)}</b></div>
      <div class="sub-h" style="margin:4px 0 0">Where your ${esc(ci.label)} goes</div>${legRows(ps.legs, ci.price, ci.sym)}
      <div class="muted small">You'll approve the exact transfer in WebAuth: ${esc(ci.qty)} to <span class="mono">${SPLITTER}</span> with memo <span class="mono">mint,${esc(t.id)}</span>. Splendor Music never holds your money. The 20% playlist pipeline needs Vibrr's contract update, so for now 100% follows the split above.</div>
      <div id="c-status" class="err"></div>
    </div>
    <div class="m-foot"><button class="btn ghost" data-mclose>Cancel</button><button class="btn" id="c-go">${verified() ? "Approve in WebAuth" : "Sign in with WebAuth to collect"}</button></div>`);
  $("#c-go", m).onclick = async () => {
    const go = $("#c-go", m), st = $("#c-status", m);
    try {
      go.disabled = true; go.textContent = "Opening WebAuth…"; st.textContent = "";
      if (!verified()) await waConnect(false);
      if (!verified()) throw new Error("Sign-in was cancelled.");
      const s = WALLET.session;
      go.textContent = "Approve in WebAuth…";
      const r = await s.transact({ transaction: { actions: [{ account: ci.tok.contract, name: "transfer",
        data: { from: String(s.auth.actor), to: SPLITTER, quantity: ci.qty, memo: `mint,${t.id}` }, authorization: [s.auth] }] } }, { broadcast: true });
      const trx = r?.processed?.id || r?.transaction_id || r?.payload?.tx || "";
      t.issued++;
      $(".modal", m).innerHTML = `<div class="m-head"><div><h3>It's yours ✓</h3><div class="muted small">“${esc(t.title)}” is in your collection. The artist was paid in the same transaction.</div></div><button class="x" data-mclose>&times;</button></div>
        <div class="m-body"><p style="margin:0">Keep it on this ${platform() === "desktop" ? "computer" : "phone"} so it plays anywhere, even with no signal. You can download the file any time, on any device you sign in on.</p>${trx ? `<a class="pill" target="_blank" rel="noopener" href="${EXPLORER}/transaction/${enc(trx)}">See the transaction ↗</a>` : ""}</div>
        <div class="m-foot"><button class="btn ghost" data-mclose>Later</button><button class="btn" id="c-keep">⤓ Keep it on this ${platform() === "desktop" ? "computer" : "phone"}</button></div>`;
      $("#c-keep", m).onclick = () => { OWN.add(t.id); closeModal(); toggleOffline(t.id).then(() => { if (!isStandalone() && platform() !== "desktop") getApp("Your music is saved. Add the app to your home screen so it's one tap away and your phone never clears it."); }); };
      MODAL_DIRTY = true; setTimeout(() => loadOwned(true), 2500);
    } catch (e) {
      go.disabled = false; go.textContent = verified() ? "Try again" : "Sign in with WebAuth to collect";
      st.textContent = String(e?.message || e || "Something went wrong").slice(0, 240);
    }
  };
}

/* ---------- offline songs + downloads (only for music you own) ---------- */
const offKey = id => new URL(`offline/audio/${id}`, location.href).href;
const offArt = id => new URL(`offline/art/${id}`, location.href).href;
async function offlineInit() {
  try { const c = await caches.open(AUDIO_CACHE); (await c.keys()).forEach(r => { const m = new URL(r.url).pathname.match(/\/offline\/audio\/(\d+)$/); if (m) OFF.add(m[1]); }); } catch {}
}
async function fetchAudio(t) {
  let last;
  for (let g = 0; g < GATEWAYS.length; g++) {
    try { const r = await fetch(ipfs(t.audio, g)); if (r.ok) return await r.blob(); last = new Error("gateway said " + r.status); } catch (e) { last = e; }
  }
  throw last || new Error("file not found");
}
function refreshOff() {
  $$("[data-offline]").forEach(b => {
    const id = b.dataset.offline, busy = DL.has(id), on = OFF.has(id);
    b.classList.toggle("on", on); b.classList.toggle("busy", busy);
    if (b.classList.contains("btn")) b.textContent = busy ? "Saving…" : on ? "✓ Saved offline" : "⤓ Save offline";
    b.title = busy ? "Saving for offline…" : on ? "Saved offline (click to remove)" : "Save offline";
  });
  const n = $("#off-count"); if (n) n.textContent = OFF.size;
}
async function toggleOffline(id) {
  const t = byId.get(String(id)); if (!t || DL.has(t.id)) return;
  if (!OWN.has(t.id)) { toast("Collect this song to keep it offline"); return; }
  const c = await caches.open(AUDIO_CACHE);
  if (OFF.has(t.id)) { await c.delete(offKey(t.id)); await c.delete(offArt(t.id)); OFF.delete(t.id); refreshOff(); toast(`Removed “${t.title}” from this device`); return; }
  DL.add(t.id); refreshOff(); toast(BATCH ? `Saving ${BATCH}: “${t.title}”…` : `Saving “${t.title}” to this device…`);
  try {
    const blob = await fetchAudio(t);
    await c.put(offKey(t.id), new Response(blob, { headers: { "Content-Type": blob.type || "audio/wav" } }));
    try { for (let g = 0; g < GATEWAYS.length; g++) { const r = await fetch(ipfs(t.img, g)); if (r.ok) { await c.put(offArt(t.id), r); break; } } } catch {}
    OFF.add(t.id); navigator.storage?.persist?.().catch(() => {});
    if (!BATCH) toast(`“${t.title}” is on this device (${(blob.size / 1e6).toFixed(0)} MB). It plays offline.`);
  } catch (e) { toast(`Couldn't save “${t.title}”: ${e.message}`); }
  DL.delete(t.id); refreshOff();
}
async function saveAllOffline(ids, quiet) {
  const todo = ids.filter(id => !OFF.has(id) && !DL.has(id)); if (!todo.length) { if (!quiet) toast("Everything you own is already on this device ✓"); return; }
  for (let i = 0; i < todo.length; i++) { BATCH = `${i + 1} of ${todo.length}`; await toggleOffline(todo[i]); }
  BATCH = ""; toast(`Done: ${plural(todo.length, "song")} saved to this device`); meter();
}
let BATCH = "";
async function meter() {
  const el = $("#store-meter"); if (!el) return;
  try {
    const e = await navigator.storage.estimate(), used = e.usage || 0, free = Math.max(0, (e.quota || 0) - used);
    const gb = n => n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.round(n / 1e6) + " MB";
    el.textContent = `On this device: ${plural(OFF.size, "song")} · using ${gb(used)} · ${gb(free)} free for more`;
  } catch { el.textContent = `On this device: ${plural(OFF.size, "song")}`; }
}
async function offlineUrl(id) {
  if (!OFF.has(String(id))) return null;
  try { const r = await (await caches.open(AUDIO_CACHE)).match(offKey(id), { ignoreVary: true }); return r ? URL.createObjectURL(await r.blob()) : null; } catch { return null; }
}
async function downloadFile(id) {
  const t = byId.get(String(id)); if (!t) return;
  if (!OWN.has(t.id)) { toast("Collect this song to download it"); return; }
  toast(`Preparing “${t.title}”…`);
  try {
    const r = await (await caches.open(AUDIO_CACHE)).match(offKey(t.id));
    const blob = r ? await r.blob() : await fetchAudio(t);
    const ext = /mpeg|mp3/.test(blob.type) ? "mp3" : /flac/.test(blob.type) ? "flac" : "wav";
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${t.artist} - ${t.title}.${ext}`.replace(/[\/\\:*?"<>|]+/g, " ");
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch (e) { toast(`Couldn't download: ${e.message}`); }
}

/* ---------- Library: your collection + what's on this device ---------- */
function libraryExtras() {
  const owned = [...OWN].map(id => byId.get(id)).filter(Boolean); LISTS.owned = owned;
  const offline = [...OFF].map(id => byId.get(id)).filter(Boolean); LISTS.offline = offline;
  return `<div class="row-head"><h2>Your collection</h2>${owned.length ? `<span class="actions" style="margin:0"><button class="btn ghost sm" id="own-play">&#9654; Play</button><a class="btn ghost sm" href="#/offline">On this device · <span id="off-count">${OFF.size}</span></a></span>` : ""}</div>
    ${owned.length ? `<label class="keep-switch"><input type="checkbox" id="own-keep"${store.get("autoOffline", false) ? " checked" : ""}><span class="sw-ui"></span><span><b>Keep my music on this device</b><small id="store-meter">Songs you own download here so they play with no signal.</small></span></label>` : ""}
    ${!me() ? `<p class="muted">Sign in with WebAuth to see the music you own.</p>` : owned.length ? `${listHead()}<div class="tracks" data-list="owned">${owned.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1 })).join("")}</div>`
      : `<p class="muted">${esc(me())} doesn't hold any music NFTs yet. Collect one from any Passport.</p>`}`;
}
function bindLibraryExtras() {
  if ($("#own-play")) $("#own-play").onclick = () => playQueue(LISTS.owned);
  if ($("#own-keep")) $("#own-keep").onchange = e => { store.set("autoOffline", e.target.checked); if (e.target.checked) saveAllOffline(LISTS.owned.map(t => t.id)); else toast("New music won't download automatically. Songs already saved stay on this device."); };
  meter();
}
VIEWS.offline = () => {
  const list = [...OFF].map(id => byId.get(id)).filter(Boolean); LISTS.offline = list;
  view().innerHTML = `<section class="plhead"><div class="mosaic xl liked" style="background:linear-gradient(135deg,#0f766e,#5eead4)">⤓</div>
    <div class="plmeta"><div class="eyebrow">On this device</div><h1>Offline</h1><div class="muted small">${plural(list.length, "song")} you own, saved to this device. They play with no connection.</div>
    ${list.length ? `<div class="actions"><button class="btn big" id="off-play">&#9654; Play</button><button class="btn ghost" id="off-shuf">&#8644; Shuffle</button></div>` : ""}</div></section>
    ${list.length ? `${listHead()}<div class="tracks" data-list="offline">${list.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, release: 1 })).join("")}</div>`
      : `<div class="empty-state"><b>Nothing saved yet</b>Tap ⤓ on any song you own to keep it on this device.</div>`}`;
  if (list.length) { $("#off-play").onclick = () => playQueue(list); $("#off-shuf").onclick = () => playQueue(shuffled(list)); }
};

/* ---------- boot ---------- */
offlineInit().then(refreshOff);
document.addEventListener("click", e => {
  const c = e.target.closest("[data-collect]"); if (c && c.dataset.collect) { e.preventDefault(); collect(c.dataset.collect, !!c.dataset.again); return; }
  const o = e.target.closest("[data-offline]"); if (o) { e.preventDefault(); toggleOffline(o.dataset.offline); return; }
  const d = e.target.closest("[data-dl]"); if (d) { e.preventDefault(); downloadFile(d.dataset.dl); }
});
