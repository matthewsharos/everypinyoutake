# EveryPinYouTake — Migration & Rebuild Spec

> Source of truth reverse-engineered from the live site + Supabase (free tier, no Horizons code export).
> Goal: move frontend hosting Hostinger → Cloudflare Pages, **bold redesign on Astro + React islands**,
> fundamentally improve speed & UI, reuse existing Supabase backend, lose zero images.

## Data safety constraint (no backup — additive only, by owner request)
- The rebuild **only ever INSERTs and SELECTs** against existing Supabase tables/buckets. **Never** drop, truncate, overwrite existing rows, or delete Storage objects as part of the migration/build.
- New data (re-hosted banner image, cached thumbnails, etc.) is **added** alongside existing data.
- The admin's own "remove" is an intentional owner action → implement as **reversible/soft delete** (status flag or move-to-archive) with a confirm, not a hard delete.

## Current architecture (as-is)
- **Hostinger Horizons** app = **Vite + React SPA**, static files served by Hostinger (LiteSpeed), already proxied through Cloudflare DNS.
- No server logic on Hostinger — the React bundle talks **directly to Supabase from the browser**.
- Horizons project id: `a58eb794-eeaa-46e8-9304-22fb05965263`
- Supabase project: `jbjwuudoeueujsmkvyeh` → `https://jbjwuudoeueujsmkvyeh.supabase.co`
  - anon key is public (shipped in bundle). service_role key + DB connection string: grab from Supabase dashboard (Settings → API / Database) for backups.

## Measured performance problems (what we're fixing)
- **Single JS bundle, 193 KB gzipped, ZERO code-splitting** — entire app incl. admin + auth ships to every anonymous visitor.
- **Pure client-side rendering** — empty HTML shell → slow First Contentful Paint, weak SEO / link previews.
- **Unoptimized images** — the *favicon* is an 88 KB PNG; pin photos are full-res, no responsive sizes / AVIF-WebP / lazy-load.
- **HTML not edge-cached** (`cf-cache-status: DYNAMIC`).
- **~23K-row dataset** almost certainly loaded/filtered client-side → the dominant cause of "slow".

## Data model (Supabase / PostgREST)
| Table | Rows | Notes |
|---|---|---|
| `pins` | 3,075 | active collection |
| `pin_archive` | 19,775 | **admin-only reference catalog** (goal: every Disney pin ever made); ever-growing; the source for "add from archive"; **never displayed publicly**. Extra col `cached_image_url` |
| `banner_images` | 38 | homepage carousel — **37 already in Supabase Storage; only 1 still on Hostinger CDN (AT RISK)** |
| `tiktok_urls` | 3 | embedded TikTok videos |
| `contact_submissions` | (RLS-protected) | contact form writes; anon cannot read — secure |

**pins / pin_archive columns:** `id, pin_name, image_url, image_url2, image_url3, year, series, origin, edition, tags, notes, external_pin_id, external_url, is_limited_edition, is_mystery, is_ap, is_pp, created_at, updated_at, user_id, collected_type` (+ `cached_image_url` on archive).
- `image_url` → Supabase Storage (primary, owned). `image_url2/3` → pinpics.com thumbnails (hotlinked, fragile).
- `collected_type` values: **`Collected`** (the bulk → collection/archive), **`For Trade`** (~45 → `/for-trade`), **`ISO`** (tiny curated wishlist → `/iso`). `pin_archive` is mostly `Collected`/null.

## Image inventory (the "don't lose images" goal)
- ✅ **Supabase Storage `pin-images/pins/...`** — primary pin photos. Safe, stays.
- ✅ **Supabase Storage `banner-images/favorites/...`** — safe, stays.
- ⚠️ **`horizons-cdn.hostinger.com/a58eb794.../`** — just **1** `banner_images` row + favicon/brand (the other 37 banners are already in Supabase Storage). **Re-host these in Supabase Storage before cancelling Hostinger.** Trivial.
- 🔶 **pinpics.com** thumbnails in `image_url2/3` — third-party hotlinks; finish caching into Supabase (`cached_image_url` pattern already started).

## Functionality map (routes — to verify against live UI/admin)
**Public** (Vite routes found: `/`, `/about`, `/for-trade`, `/iso`, `*`)
- `/` Home — banner carousel (`banner_images`), featured/recent pins, TikTok embeds (`tiktok_urls`).
- `/iso` — "In Search Of" pins.
- `/for-trade` — pins available to trade.
- `/about` — static content.
- Pin search/browse over **`pins` only** (the active collection). **`pin_archive` is NEVER shown publicly** — it's admin-only.
- Contact form → `contact_submissions`.
- External: TikTok `@everypinyoutake2`, Instagram, PinPics.

**Admin** (Supabase email/password auth; `signInWithPassword`)
- Login + dashboard.
- CRUD `pins`, `pin_archive`, `banner_images`, `tiktok_urls`; view `contact_submissions`.
- Image upload to Supabase Storage (`pin-images` bucket).
- Manage ISO / for-trade designations.
> Admin flows need confirmation by rendering the live admin or deeper bundle analysis.

## Key features (must-have) — owner workflows
1. **Add a pin** — two paths: **(a) From archive** — search the ~20K `pin_archive` catalog, pick a pin, add it to the active collection (`pins`) with a `collected_type` (copies metadata + image ref). **(b) Manual** — enter pin data by hand (name, year, series, origin, edition, tags, notes, flags) + upload image, for pins not in the archive.
2. **Manage pins** — for any pin in `pins`: **remove** (reversible/soft — never a silent hard delete), **label** `collected_type` = ISO / For Trade / Collected, **edit** any metadata field, **add/replace** the pin image (upload to Supabase Storage).
3. **Search pins** — robust, fast search across ALL metadata (`pin_name, series, origin, edition, tags, notes, year, external_pin_id`, flags), server-side (Postgres full-text + `pg_trgm`), paginated, sub-second. **Two scopes:** public browse/search runs over **`pins`** (the displayed collection, ~3K growing); the admin add-flow searches **`pin_archive`** (the reference catalog, ~20K+ growing).

## Target architecture (to-be)
- **Astro + React islands** on **Cloudflare Pages**.
- Static/prerender public pages (instant load, SEO); React islands only for interactive search grid + admin.
- **Server-side search & pagination** — public over `pins` (~3K, growing); admin archive-search over `pin_archive` (~20K+, growing). Supabase RPC + Postgres FTS + `pg_trgm` indexes. Virtualized image grid.
- **Image pipeline**: responsive AVIF/WebP, lazy-load; Supabase image transforms or Cloudflare Images.
- Same Supabase project; **review/tighten RLS**; admin via Supabase auth; add new domain to Auth redirect URLs.
- Bold new visual identity (design system TBD).

## Plan / phases
0. **Data safety** — additive-only: never delete/overwrite existing Supabase rows or Storage objects (no backup taken, by request).
1. **Discovery & spec** — this doc. *(in progress)*
2. **Rescue at-risk images** — re-host the 1 Hostinger-CDN banner image + favicon → Supabase Storage; update that `banner_images` row; (optional) cache pinpics thumbnails.
3. **Scaffold Astro app + design system** (bold redesign); build public pages (SSG + search islands).
4. **Admin** islands — the three key workflows: **add pin (archive search OR manual)**, **manage pins (remove/label/edit/replace image)**, plus banners/tiktok/submissions. Reversible (soft) deletes.
5. **Cloudflare Pages** wiring — env vars, routing, Supabase auth redirect URLs.
6. **Performance & search** — robust server-side full-text search across all pin metadata (Postgres FTS + `pg_trgm`) over pins+archive, pagination/virtualized grid, AVIF/WebP image pipeline, edge caching, code-splitting.
7. **Parity verification** vs. live baseline + QA.
8. **DNS cutover** → monitor → decommission Hostinger.

## Open items
- ✅ Cloudflare + GitHub accounts exist; domain `everypinyoutake.com` already transferring Hostinger → Cloudflare.
- ✅ Data model confirmed: `pins` = displayed collection; `pin_archive` = admin-only ever-growing reference catalog (never shown publicly).
- ✅ `collected_type`: Collected / For Trade / ISO.
- Bold redesign: build a distinctive direction directly, iterate with owner on the running site.
- Admin micro-UX: refine while building task #5.
