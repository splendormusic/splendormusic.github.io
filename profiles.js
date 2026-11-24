/* Splendor Music: artist profiles (v0.6, 24 Nov 2026).
   What an artist shows on their page beyond the chain: bio, photos, links, Artist Pick, lyrics and the story behind each song,
   plus releases that are out everywhere but not minted yet. Keyed by the artist name used on chain.
   Artists edit their own page in the app (Edit artist page): their edits are saved on their device and shown straight away.
   Live version: artist-signed profiles published to Vibrr / the chain, so every listener sees them. */
"use strict";
const ARTIST_PROFILES = {
  "Lachlan Grant Splendor": {
    tagline: "Soul-driven folk-rock from the Queensland coast",
    location: "Bargara, Queensland, Australia",
    bio: `Lachlan Grant Splendor is an independent Australian musician creating soul-driven folk-rock, alternative singer-songwriter, and indie rock music shaped by guitar, lived experience, spiritual reflection, and raw emotional honesty.

His new album Splendor is a 12-track journey through wandering, grief, pressure, relapse, self-reliance, surfing, romance, shadow work, and final reflection. Written, performed, produced, and mixed independently, the album reflects Lachlan's identity as a musician first: songs carried by voice, guitar, meaning, and the road that shaped them.

From the desert to the water, Splendor is about reclaiming the soul from false roles, fear, loneliness, and systems of control.`,
    banner: "img/lgs-banner.jpg",
    avatar: "img/lgs-avatar.jpg",
    photoCredit: "Photos: Shaun Watson Photography",
    photos: ["img/lgs-1.jpg", "img/lgs-2.jpg", "img/lgs-3.jpg", "img/lgs-4.jpg"],
    links: {
      spotify: "https://open.spotify.com/artist/7iGfpj0ch7DzxoMFps58bk",
      apple: "https://music.apple.com/au/album/splendor/6786724139",
      bandcamp: "https://lachlangrantsplendor.bandcamp.com",
      youtube: "https://www.youtube.com/@lachlangrantsplendor",
      instagram: "https://www.instagram.com/lachlangrantsplendor",
      facebook: "https://www.facebook.com/profile.php?id=100089955953670",
      x: "https://x.com/LachlanGrant90"
    },
    pick: { release: "The Choice Is Yours", note: "My 2018 album, now collectable with its full Music Passport. Every song is yours to keep." },
    releaseDates: { "The Choice Is Yours": "2018-11-30" },
    elsewhere: [
      { title: "Splendor", type: "Album", released: "2026-07-31", img: "img/splendor-2026-cover.jpg",
        links: { spotify: "https://open.spotify.com/album/7K6lURjlnQ0OLG6J4iOmcW", apple: "https://music.apple.com/au/album/splendor/6786724139", bandcamp: "https://lachlangrantsplendor.bandcamp.com/album/splendor" } }
    ],
    lyrics: {},     // template id -> lyrics text (the artist adds these in the app)
    stories: {}     // template id -> the story behind the song, in the artist's words
  }
};
const LINK_NAMES = { website: "Website", spotify: "Spotify", apple: "Apple Music", bandcamp: "Bandcamp", youtube: "YouTube", instagram: "Instagram",
  facebook: "Facebook", x: "X", tiktok: "TikTok", soundcloud: "SoundCloud", telegram: "Telegram", vibrr: "Vibrr" };
