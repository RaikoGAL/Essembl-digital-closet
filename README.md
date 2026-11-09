# Digital Closet

Your wardrobe, digitized. An AI stylist that only recommends clothes you already own — built as an installable web app (PWA) so it runs on your phone with no app store and no subscription.

## What it does

| Screen | Features |
|---|---|
| **Today** | Weather-aware daily outfit (geolocation → Open-Meteo), plans + mood input, "Another one", wear/save/share, never-worn carousel |
| **Closet** | Photo → on-device background removal → Claude vision tagging (category, colors, material, seasons, formality, style tags). Multi-item mode detects every piece in a mirror selfie or flat-lay and crops each one. Search, filters, favorites, wear counts, item detail, outfits + folders |
| **Studio** | Drag-and-drop canvas builder, resize / layer pieces, **Rate me** style score with swap suggestions from your own closet, **Get ideas** by occasion/vibe (optionally anchored on one item) |
| **Rate my look** | Selfie → 0-100 score, what works, what to tweak; detect worn items and add them to the closet; score history |
| **Shop** | Closet gap audit with priority, color, pairing items and store search links; **Should I buy it?** — screenshot a product, get a buy-score, near-duplicates you own, and outfits it would make |
| **Travel** | Destination + dates → forecast → capsule packing list + an outfit per day, saved into a trip folder |
| **Settings** | Style profile (used in every prompt), location/units, background removal toggle, JSON backup export/import, install instructions |

## Architecture

- **Next.js 15 (App Router) + Tailwind** — single PWA, mobile-first.
- **Local-first storage** — items (with images), outfits, folders and settings live in IndexedDB on the device via Dexie. No account, no backend database. Export a backup from Settings before changing phones.
- **AI** — Claude via the Anthropic SDK in Next.js route handlers (`app/api/ai/*`). The API key never reaches the browser. Structured outputs are enforced with tool-use schemas.
- **Background removal** — `@imgly/background-removal` runs in the browser (WASM, free). Falls back to the original photo if the model can't load.
- **Weather** — Open-Meteo (no key). Reverse geocoding by BigDataCloud (no key).
- **Offline** — a small service worker caches the app shell; browsing your closet works offline, AI features need network.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

## Deploy (Vercel, free tier)

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → import the repo**. Framework is auto-detected.
3. Add environment variable `ANTHROPIC_API_KEY` (and optionally `AI_MODEL`).
4. Deploy. Open the URL on your phone → **Add to Home Screen** (iOS Safari) / **Install app** (Android Chrome).

AI route handlers set `maxDuration = 60`, which is within Vercel Hobby limits.

## Cost

Only your own Anthropic API usage. A typical item tag or outfit generation is a fraction of a cent; a closet of 100 items costs well under a dollar to catalog.

## Notes

- This is an original implementation inspired by the feature set of AI styling apps. No third-party code, assets or branding are used.
- Images are resized to ≤1024 px before being sent to the AI.
