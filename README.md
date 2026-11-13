# Daily Brief — News Blog (Vercel, static)

A small, fast, static news blog. Every day up to 2 short news articles are
added, the site is rebuilt, and the newest article is shared on Bluesky.
The blog shows Adsterra ads. No framework, no database, no AI API in the
build — articles are written by a person (Muse) from real, checked news.

## Files

| File | What it is |
| --- | --- |
| `articles.json` | All articles (the only file you edit daily) |
| `build.js` | Node script that generates the static site into `dist/` |
| `style.css` | The blog's stylesheet |
| `post-to-bluesky.js` | Posts the newest article to Bluesky (AT Protocol) |
| `vercel.json` | Vercel settings: build with `node build.js`, serve `dist/` |
| `dist/` | Generated site (do not edit by hand — rebuilt every time) |

## Daily workflow (max 2 articles per day)

1. Check Bluesky trending topics for the day and pick 1–2 real news stories
   (celebrity, crypto, fitness and general news do best with this audience).
2. Verify the facts with a web search. Never invent quotes, figures or
   details. Every article should link its `source` (the news page you
   checked).
3. Add one JSON entry per article to `articles.json` (see format below).
   Keep `date` as the publish date (`YYYY-MM-DD`).
4. Run the build: `node build.js`
5. Post the newest article to Bluesky (see below).
6. Deploy: `git push` (Vercel rebuilds automatically) — or deploy the
   `dist/` folder (see Deploy).

## Adding an article — `articles.json` entry

```json
{
  "id": "trump-white-house-ballroom-2026",
  "slug": "trump-white-house-ballroom",
  "title": "Trump Showcases White House Ballroom as Final Steel Beam Is Raised",
  "summary": "One or two sentences shown on the homepage.",
  "category": "Politics",
  "date": "2026-11-12",
  "imageUrl": "https://upload.wikimedia.org/...jpg",
  "imageCredit": "The White House, Washington, D.C. — Photo: Wikimedia Commons (CC BY-SA 3.0)",
  "imageNote": "Optional note if the image is generic rather than the exact subject.",
  "source": "https://example.com/the-news-page-you-checked",
  "sample": false,
  "body": [
    "First paragraph...",
    "Second paragraph..."
  ]
}
```

Field rules:

- `slug` — lowercase letters, numbers and hyphens only, unique. It becomes
  the article URL: `/articles/<slug>/`.
- `date` — `YYYY-MM-DD`. The homepage lists newest first.
- `body` — an array of paragraphs (3–5 is enough).
- `imageUrl` — **required**. Every article MUST have a hero image.
- `sample` — set `false` for real articles. The 2 seed articles have
  `"sample": true` and show a "Sample article" note on the page; delete
  them (or set `sample` to `false`) once real articles exist.
- The build **fails** if a required field is missing, and **warns** if more
  than 2 articles share one date.

## Image rules (important)

Images must come **only** from free-licence sources — Pexels, Pixabay,
Unsplash or Wikimedia Commons — or be generated illustrations. **Never**
copy news-agency photos (AP, Getty, Reuters, AFP, etc.) or game/movie
artwork. For CC-licensed images (e.g. CC BY-SA), always fill in
`imageCredit` with the source and licence — the build shows it under the
photo. If no fitting free image exists for a topic, use a relevant generic
free image and explain it in `imageNote`.

## Build

```bash
node build.js
```

Requirements: Node 18 or newer (uses only built-in modules, no `npm install`).
Output goes to `dist/`:

- `dist/index.html` — homepage
- `dist/articles/<slug>/index.html` — one page per article
- `dist/style.css`, `dist/sitemap.xml`, `dist/robots.txt`

Preview locally:

```bash
cd dist && python3 -m http.server 8123
# open http://localhost:8123/
```

## Deploy on Vercel (static)

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project → Import** the repo.
3. Vercel detects a static site. `vercel.json` already sets:
   - Build command: `node build.js`
   - Output directory: `dist`
4. Deploy. Your URL will be `https://<project>.vercel.app`.
5. After the first deploy, update the `SITE.url` in `build.js` to your real
   Vercel URL (it is used for canonical links, the sitemap and Bluesky
   post links), then redeploy.
6. To change the site name/tagline, edit the `SITE` object at the top of
   `build.js`.

## Adsterra ads — where the codes go

No real Adsterra codes are in this project yet — the slots are placeholders
and are harmless when empty. When the user supplies the codes:

1. **Social Bar + Popunder** — paste them in `build.js`, in the `adHeadSlots()`
   function, replacing the two `<!-- ADSTERRA ... -->` comments. They are
   injected just below `<head>` on every page. Then rebuild.
2. **Banner 300×250** — paste the code in `build.js`, in the `adBannerSlot()`
   function, inside the `<div class="ad-slot ad-300x250">`. It shows in the
   sidebar on every page. Then rebuild.

Adsterra setup (done in the Adsterra dashboard, not here): create a
Publisher account, add the blog URL under Websites, pick the formats
(Social Bar, Popunder, Native Banner, Banner), wait for approval, then
copy each code from the dashboard.

## Bluesky posting — `post-to-bluesky.js`

Posts the **newest** article (by date) to Bluesky. Credentials come only
from environment variables — never hardcode them, never write them to a
file:

```bash
BSKY_HANDLE=you.bsky.social \
BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
BLOG_URL=https://daily-brief.vercel.app \
node post-to-bluesky.js
```

- `BSKY_HANDLE` — your Bluesky handle (not your email).
- `BSKY_APP_PASSWORD` — an **app password**, created in Bluesky under
  Settings → Privacy and Security → App Passwords. It is NOT your real
  Bluesky password, it cannot log in to your account, and you can delete
  it any time.
- `BLOG_URL` — your deployed blog URL (used for the link in the post).
  If unset, the placeholder in the script is used and a warning is shown.

Other options:

```bash
node post-to-bluesky.js --dry-run        # print what would be posted, post nothing
node post-to-bluesky.js --slug <slug>    # post a specific article, not the newest
```

Without credentials the script prints a clear message and posts nothing.
The post text is the article title + link; Bluesky builds the link card
from the article page's Open Graph tags. Keep it to **2 posts per day
maximum** — more risks a Bluesky suspension.

## Notes

- Articles must be based on real, checked news. Read every article once
  before publishing; if a fact looks wrong, fix it or delete the article.
- The seed articles in `articles.json` are marked `"sample": true`.
