/* Splendor Music: artist profiles (v0.8, 24 Nov 2026).
   What an artist shows on their page beyond the chain: bio, photos, links, Artist Pick, videos, lyrics and the story behind
   each song, and the releases that aren't minted yet (fans can ask for them). Keyed by the artist name used on chain.
   Artists edit their own page in the app (Edit artist page): saved on their device and shown straight away.
   Live version: artist-signed profiles published through Vibrr, so every listener sees the same page. */
"use strict";
const ARTIST_PROFILES = {
  "Lachlan Grant Splendor": {
    tagline: "NZ-born singer-songwriter living by the sea",
    location: "Bargara, Queensland, Australia",
    bio: `Lachlan Grant Splendor is an independent Australian musician creating soul-driven folk-rock, alternative singer-songwriter, and indie rock music shaped by guitar, lived experience, spiritual reflection, and raw emotional honesty.

His new album Splendor is a 12-track journey through wandering, grief, pressure, relapse, self-reliance, surfing, romance, shadow work, and final reflection. Written, performed, produced, and mixed independently, the album reflects Lachlan's identity as a musician first: songs carried by voice, guitar, meaning, and the road that shaped them.

From the desert to the water, Splendor is about reclaiming the soul from false roles, fear, loneliness, and systems of control.`,
    banner: "img/lgs-banner.jpg",
    avatar: "img/lgs-avatar.jpg",
    photoCredit: "Photos: Shaun Watson Photography",
    photos: ["img/lgs-1.jpg", "img/lgs-2.jpg", "img/lgs-3.jpg", "img/lgs-4.jpg"],
    links: {
      instagram: "https://www.instagram.com/lachlangrantsplendor",
      facebook: "https://www.facebook.com/profile.php?id=100089955953670",
      youtube: "https://www.youtube.com/@lachlangrantsplendor",
      x: "https://x.com/LachlanGrant90",
      spotify: "https://open.spotify.com/artist/7iGfpj0ch7DzxoMFps58bk",
      apple: "https://music.apple.com/au/artist/lachlan-grant-splendor/1424199435",
      bandcamp: "https://lachlangrantsplendor.bandcamp.com"
    },
    // the artist chooses which videos to show (Edit artist page): his best performances
    videos: [
      { id: "eQC1-2Y8X1c", title: "Me and My Guitar", kind: "Official music video" },
      { id: "ZzPnHGLjG90", title: "The Wanderer", kind: "Official music video" },
      { id: "RgmDvoY_cA4", title: "Leave Your Man For Me", kind: "Live in the music room" }
    ],
    pick: { release: "The Choice Is Yours", note: "My 2018 album, now collectable with its full Music Passport. Every song is yours to keep." },
    releaseDates: { "The Choice Is Yours": "2018-11-30", "The Drifting EP": "2014-01-15" },
    // released everywhere but not minted on Vibrr yet: fans can ask for them (dates + covers from Apple Music)
    notYet: [
      { title: "Splendor", type: "Album", released: "2026-07-31", img: "img/cover-splendor-2026.jpg" },
      { title: "Cordial", type: "Album", released: "2015-07-31", img: "img/cover-cordial.jpg" }
    ],
    credits: {},        // template id -> credits the artist adds here ("Produced: Name" per line)
    albumCredits: {},   // release title -> credits for every song on that release
    lyrics: {},     // template id -> lyrics text (the artist adds these in the app)
    stories: {}     // template id -> "About this song", in the artist's words
  }
};
const LINK_NAMES = { website: "Website", spotify: "Spotify", apple: "Apple Music", bandcamp: "Bandcamp", youtube: "YouTube", instagram: "Instagram",
  facebook: "Facebook", x: "X", tiktok: "TikTok", soundcloud: "SoundCloud", telegram: "Telegram", vibrr: "Vibrr" };
const STREAMING = ["spotify", "apple", "bandcamp", "soundcloud"];   // shown as "Also on"; everything else is "Follow"
