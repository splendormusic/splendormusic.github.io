# Splendor Music

**Mint on Vibrr. Listen, share and earn on Splendor Music.**

Splendor Music is a listening app for music NFTs on the XPR Network, conceived and designed by
Lachlan Grant Splendor, an independent folk-rock artist from Bargara, Queensland (@splendor on XPR).

- **Listen:** releases play in order, playlists, Liked Songs, free Splendor Radio stations picked by open rules.
- **Music Passport:** every song shows who made it, who owns the recording and the song, its permissions,
  and a public ledger of who got paid.
- **Own it, keep it:** collect a song in one tap with WebAuth, save the songs you own for offline listening,
  and download the file any time.
- **My Corner:** your profile, Top 8 and a poster wall of every NFT you hold.
- **The playlisting economy (proposed):** artists keep 80% through their Passport split; 20% flows back to the
  curators and sharers who brought the song to a new fan.

## Trust

Splendor Music never holds keys or money. Sign-in and every payment happen in WebAuth (Metallicus), which shows
exactly what you're approving. Collecting uses Vibrr's split contract (`vibrrsplit`): one transaction pays the
artist's split and mints a fresh copy to your account, visible on any XPR explorer. There are no servers or
accounts holding your data: playlists and offline songs live on your device, and ownership is read from the chain.
This code is public so anyone can check it.

## Built with

Plain HTML, CSS and JavaScript (no build step). Data: AtomicAssets API (schema `cxcmus`), Hyperion history,
AtomicMarket, XPR profiles. Sign-in: Proton Web SDK. Installable as an app (PWA) with offline support.

© 2026 Lachlan Grant Splendor. All rights reserved.
