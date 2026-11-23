/* Splendor Radio: free listening. Stations picked by OPEN RULES (no payola): every input comes from the chain and the
   weights are published on the page, so the same rules apply to everyone. Artists opt in by submitting music
   they've already minted. (Prototype: submissions are saved in this browser; live version = signed + on chain.) */
"use strict";
const RADIO = { weights: { fresh: 0.35, under: 0.35, passport: 0.30 }, perArtist: 2 };
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function siPick(t) {
  const d = t.d, days = Math.max(0, (Date.now() - t.created) / 864e5);
  const fresh = Math.max(0, 1 - days / 240);                                  // newer releases rank higher
  const under = 1 / (1 + Math.log10(1 + Math.max(0, t.issued || 0)));         // fewer collects = more room to be discovered
  const checks = [!!d.isrc, !!d.credits, !!(d.p_line && d.c_line), "allow_sync" in d, CHAIN.splits.has(t.id), !!d.about];
  const passport = checks.filter(Boolean).length / checks.length;            // a complete, honest Music Passport
  const w = RADIO.weights, score = w.fresh * fresh + w.under * under + w.passport * passport;
  const why = [];
  if (fresh > .6) why.push("new release"); if (under > .45) why.push("still undiscovered");
  if (passport >= .8) why.push("complete Passport"); if (CHAIN.splits.has(t.id)) why.push("fair split on chain");
  return { score, why, fresh, under, passport };
}
function spread(list, perArtist = RADIO.perArtist, max = 25) {
  const n = new Map(), out = [];
  for (const t of list) { if ((n.get(t.artist) || 0) >= perArtist) continue; n.set(t.artist, (n.get(t.artist) || 0) + 1); out.push(t); if (out.length >= max) break; }
  return out;
}
function radioStations() {
  const bySi = TRACKS.slice().sort((a, b) => siPick(b).score - siPick(a).score);
  const st = [{ slug: "new-talent", name: "New Talent", blurb: "SI picks from open rules: newer, less-discovered artists with complete Music Passports.", tracks: spread(bySi, 2, 25), h: 300 },
              { slug: "fresh", name: "Fresh Drops", blurb: "The newest releases on the network.", tracks: spread(TRACKS.slice().sort((a, b) => b.created - a.created), 3, 25), h: 190 }];
  const g = new Map();
  TRACKS.forEach(t => String(t.d.genre || "").split(/[|,/]/).map(x => x.trim()).filter(x => x && x.length < 24)
    .forEach(x => { const k = x.toLowerCase(); if (!g.has(k)) g.set(k, { name: x, list: [] }); if (!g.get(k).list.includes(t)) g.get(k).list.push(t); }));
  [...g.values()].filter(x => x.list.length >= 3).sort((a, b) => b.list.length - a.list.length).slice(0, 8)
    .forEach(x => st.push({ slug: "genre-" + slugify(x.name), name: `${x.name} Radio`, blurb: `${x.name} from across the network, in SI-pick order.`, tracks: spread(x.list.sort((a, b) => siPick(b).score - siPick(a).score), 3, 30), h: hue(x.name) }));
  const subs = store.get("radioSubs", []).map(s => byId.get(String(s.id))).filter(Boolean);
  if (subs.length) st.push({ slug: "submitted", name: "Submitted", blurb: "Music artists submitted for Splendor Radio.", tracks: subs, h: 40 });
  st.push({ slug: "favourites", name: "Collectors' Favourites", blurb: "What collectors hold the most.", tracks: spread(TRACKS.slice().sort((a, b) => b.issued - a.issued), 2, 25), h: 140 });
  // Vibrr Radio, live: the songs artists opted in on Vibrr, most played first (plays + reactions straight from Vibrr's feed)
  if (typeof VR !== "undefined" && VR.ok) {
    const vt = [...VR.byId.keys()].map(id => byId.get(id)).filter(Boolean).sort((a, b) => VR.byId.get(b.id).plays - VR.byId.get(a.id).plays);
    const plays = [...VR.byId.values()].reduce((n, v) => n + v.plays, 0);
    st.unshift({ slug: "vibrr-radio", name: "Vibrr Radio", chip: "VIBRR RADIO · LIVE", ctx: "Vibrr Radio · live", eyebrow: "Live from Vibrr Radio",
      blurb: `Live from Vibrr Radio: the songs artists opted in on Vibrr, most played first. ${plays.toLocaleString()} plays so far. Plays and reactions come straight from Vibrr.`,
      head: "Most played on Vibrr Radio", tracks: vt, h: 275,
      meta: x => { const v = VR.byId.get(x.id) || { plays: 0, reacts: 0 }; return `${plural(v.plays, "play")}${v.reacts ? ` · ${plural(v.reacts, "reaction")}` : ""}`; } });
  }
  return st.filter(s => s.tracks.length);
}
const stationCard = s => `<a class="station" href="#/radio/${enc(s.slug)}" style="--sh:${s.h}">
  <div class="st-art">${mosaic(s.tracks.map(t => t.id))}<span class="st-live">${esc(s.chip || "SPLENDOR RADIO")}</span><button class="fab" data-station="${esc(s.slug)}" title="Play ${esc(s.name)}">&#9654;</button></div>
  <div class="c"><div class="t">${esc(s.name)}</div><div class="a">${plural(s.tracks.length, "song")} · ${plural(new Set(s.tracks.map(t => t.artist)).size, "artist")}</div></div></a>`;
function playStation(slug, start = 0) {
  const s = radioStations().find(x => x.slug === slug); if (!s) return;
  playQueue(s.tracks, start, s.ctx || `Splendor Radio · ${s.name}`);
}

function radioHome() {
  const st = radioStations();
  view().innerHTML = `
  <section class="manifesto" style="padding:38px 36px"><div class="eyebrow">Splendor Radio</div><h1 style="font-size:44px">Free listening. Picked by open rules, never by payola.</h1>
    <p>No account needed, nothing to buy. Every station is chosen by published rules that read the chain, so nobody can pay their way on, and every song has a Collect button if it moves you.</p>
    <div class="actions"><button class="btn big" data-station="new-talent">&#9654; Play New Talent</button><a class="btn ghost" href="#/radio/submit">Artists: submit your music</a></div></section>
  <div class="row-head"><h2>Stations</h2><span class="muted small">${plural(st.length, "station")}</span></div>
  <div class="grid">${st.map(stationCard).join("")}</div>
  <div class="pgrid">
    <div class="panel"><h2>How the picks are made</h2>
      <p class="muted" style="margin-top:0">Open rules, same for everyone. Every input is public chain data.</p>
      <div class="legs">
        <div class="leg"><span class="sw" style="background:var(--c1)"></span><b style="font-family:Inter;font-size:14px">Fresh</b><span class="r">newer releases rank higher</span><b>${RADIO.weights.fresh * 100}%</b></div>
        <div class="leg"><span class="sw" style="background:var(--c2)"></span><b style="font-family:Inter;font-size:14px">Undiscovered</b><span class="r">fewer collects = more room to grow</span><b>${RADIO.weights.under * 100}%</b></div>
        <div class="leg"><span class="sw" style="background:var(--c3)"></span><b style="font-family:Inter;font-size:14px">Complete Passport</b><span class="r">credits, ISRC, ℗/©, permissions, split on chain, story</span><b>${RADIO.weights.passport * 100}%</b></div>
      </div>
      <p class="muted small">Max ${RADIO.perArtist} songs per artist per station so nobody dominates. Next: SI that actually listens (sound, craft, originality), community signals from curators with good track records, and every pick logged on chain so anyone can audit it.</p>
      ${typeof VR !== "undefined" && VR.ok ? `<p class="muted small"><b style="color:var(--text)">Vibrr Radio</b> is Vibrr's own live station, played here: songs their artists opted in on Vibrr, ordered by real plays from Vibrr's feed.</p>` : ""}</div>
    <div class="panel"><h2>For artists</h2>
      <ol class="rules">
        <li><b>Opt in.</b> Submit music you've already minted (later: tick "OK for Splendor Radio" when you mint on Vibrr).</li>
        <li><b>Free to submit, no pay-to-play, ever.</b> Picks come from the open rules, not money.</li>
        <li><b>Free plays are promotion</b>, like community radio, but every play has a Collect button and your Passport travels with the song.</li>
        <li><b>Collected from the radio:</b> proposed <b>85%</b> to your Passport split, <b>15%</b> to Splendor Radio to fund the stations (SI, human curators who find gems, running costs).</li>
        <li><b>Early supporters</b> who collect you off the radio get that status on chain forever.</li>
        <li><b>Leave any time.</b> Later: a radio pool funded by sponsors and supporters, paid to artists per play, on chain.</li>
      </ol>
      <a class="btn" href="#/radio/submit">Submit your music</a></div>
  </div>`;
}
function stationPage(slug) {
  const s = radioStations().find(x => x.slug === slug); if (!s) return notFound();
  LISTS.station = s.tracks;
  view().innerHTML = `<section class="plhead" style="background:linear-gradient(180deg,hsla(${s.h},70%,45%,.25),rgba(14,14,17,.6))">${mosaic(s.tracks.map(t => t.id), "mosaic xl")}
    <div class="plmeta"><div class="eyebrow">${esc(s.eyebrow || "Splendor Radio station")}</div><h1>${esc(s.name)}</h1><div class="desc">${esc(s.blurb)}</div>
      <div class="muted small">${plural(s.tracks.length, "song")} · ${plural(new Set(s.tracks.map(t => t.artist)).size, "artist")} · free to play</div>
      <div class="actions"><button class="btn big" data-station="${esc(s.slug)}">&#9654; Play station</button><button class="btn ghost" id="st-shuf">&#8644; Shuffle</button><button class="btn ghost" id="st-share">Share</button>${s.slug === "vibrr-radio" ? `<a class="btn ghost" href="https://vibrr.ai/radio" target="_blank" rel="noopener">Open Vibrr Radio ↗</a>` : ""}</div></div></section>
    ${listHead(s.head || "Why it's here")}<div class="tracks" data-list="station" data-ctx="${esc(s.ctx || "Splendor Radio · " + s.name)}">${s.tracks.map((t, i) => trackRow(t, i, { thumb: 1, artist: 1, meta: s.meta || (x => siPick(x).why.join(" · ") || "open-rules pick") })).join("")}</div>`;
  $("#st-shuf").onclick = () => playQueue(shuffled(s.tracks), 0, s.ctx || `Splendor Radio · ${s.name}`);
  $("#st-share").onclick = () => shareModal(`${s.name} on Splendor Radio`, location.href);
}
function radioSubmit() {
  const m = me();
  const mine = m ? TRACKS.filter(t => t.author === m || contribs(t.d).some(c => c.w === m) || CHAIN.splits.get(t.id)?.artist === m) : [];
  const subs = store.get("radioSubs", []);
  const st = radioStations().filter(s => s.slug === "new-talent" || s.slug.startsWith("genre-"));
  view().innerHTML = `<div class="row-head" style="margin-top:0"><div><div class="eyebrow">Splendor Radio</div><h1 style="margin:0">Submit your music</h1></div><a class="btn ghost sm" href="#/radio">Back to Splendor Radio</a></div>
    <p class="muted" style="max-width:760px">Free to submit. No pay-to-play, ever. Picks come from the open rules. Your music must already be minted, with your account on the collection or in the Passport's split.</p>
    ${!m ? `<div class="empty-state"><b>Sign in first</b>So we know which minted music is yours.<div class="actions" style="justify-content:center"><button class="btn" id="rs-sign">Sign in with WebAuth</button></div></div>` : `
    <div class="sim" style="grid-template-columns:1fr 360px">
      <div class="panel"><h2>Your minted music <span class="n">${esc(m)}</span></h2>
        ${mine.length ? `<div class="m-list" style="padding:0;max-height:none">${mine.map(t => `<label class="m-row" style="cursor:pointer"><input type="checkbox" value="${esc(t.id)}"${subs.some(s => s.id === t.id) ? " checked disabled" : ""}><img src="${esc(ipfs(t.img))}" alt="" style="width:44px;height:44px;border-radius:6px;object-fit:cover"><span class="m-name"><b>${esc(t.title)}</b><span class="muted">${esc(t.release)}${subs.some(s => s.id === t.id) ? " · submitted" : ""}</span></span></label>`).join("")}</div>`
          : `<p class="muted">No minted music found for ${esc(m)}. Mint on Vibrr first, then come back.</p>`}</div>
      <div class="panel">
        <label class="field">Best station for it<select id="rs-st">${st.map(s => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join("")}</select></label>
        <label class="field">Why should listeners hear it? (optional)<textarea id="rs-pitch" rows="4" maxlength="400" style="background:var(--panel2);border:1px solid var(--line2);border-radius:10px;padding:10px 12px;color:var(--text)"></textarea></label>
        <label class="field" style="flex-direction:row;gap:8px;align-items:flex-start;color:var(--text)"><input type="checkbox" id="rs-ok" style="margin-top:3px">I own or control these recordings. Free plays on Splendor Radio are promotion, collects pay my Passport split, and I can withdraw any time.</label>
        <div class="err" id="rs-err"></div>
        <button class="btn" id="rs-go">Submit for Splendor Radio</button>
        <p class="muted small">Prototype: saved in this browser. The live version signs your submission with WebAuth and records it on chain.</p></div>
    </div>
    ${subs.length ? `<div class="row-head"><h2>Your submissions</h2></div><div class="tracks">${subs.map(s => { const t = byId.get(String(s.id)); return t ? `<div class="trk" style="grid-template-columns:minmax(0,1.6fr) 1fr auto"><span class="ti"><img class="th" src="${esc(ipfs(t.img))}" alt=""><span><b>${esc(t.title)}</b><span class="sub">${esc(s.station)} · ${date(s.at)}</span></span></span><span class="muted small">${esc(s.pitch || "")}</span><button class="btn ghost sm" data-withdraw="${esc(t.id)}">Withdraw</button></div>` : ""; }).join("")}</div>` : ""}`}`;
  if ($("#rs-sign")) $("#rs-sign").onclick = accountMenu;
  if ($("#rs-go")) $("#rs-go").onclick = () => {
    const ids = $$('.m-list input[type=checkbox]:checked:not(:disabled)').map(x => x.value);
    if (!ids.length) { $("#rs-err").textContent = "Pick at least one song."; return; }
    if (!$("#rs-ok").checked) { $("#rs-err").textContent = "Tick the box to confirm."; return; }
    const all = store.get("radioSubs", []), station = $("#rs-st").selectedOptions[0]?.textContent || "New Talent", pitch = $("#rs-pitch").value.trim();
    ids.forEach(id => all.push({ id, by: m, station, pitch, at: Date.now() })); store.set("radioSubs", all);
    toast(`Submitted ${plural(ids.length, "song")} for Splendor Radio`); route(true);
  };
  $$("[data-withdraw]").forEach(b => b.onclick = () => { store.set("radioSubs", store.get("radioSubs", []).filter(s => s.id !== b.dataset.withdraw)); toast("Withdrawn"); route(true); });
}
VIEWS.radio = parts => parts[1] === "submit" ? radioSubmit() : parts[1] ? stationPage(parts[1]) : radioHome();
document.addEventListener("click", e => { const b = e.target.closest("[data-station]"); if (b) { e.preventDefault(); playStation(b.dataset.station); } });
