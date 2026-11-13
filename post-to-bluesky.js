#!/usr/bin/env node
/**
 * post-to-bluesky.js — post the newest blog article to Bluesky.
 *
 * Flow: reads articles.json, takes the newest article (or --slug <slug>),
 * signs in to Bluesky with an app password, and posts the article title
 * + link. Bluesky unfurls the link card itself from the article page's
 * Open Graph tags, so no image upload is needed.
 *
 * Credentials come ONLY from environment variables — never hardcoded,
 * never written to any file:
 *   BSKY_HANDLE        your Bluesky handle, e.g. example.bsky.social
 *   BSKY_APP_PASSWORD  an app password (Bluesky Settings -> Privacy and
 *                      Security -> App Passwords). NOT your real password.
 *
 * Optional:
 *   BLOG_URL           your deployed blog URL, e.g. https://daily-brief.vercel.app
 *                      (defaults to the placeholder below — set it before posting)
 *
 * Usage:
 *   BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
 *     BLOG_URL=https://daily-brief.vercel.app node post-to-bluesky.js
 *   node post-to-bluesky.js --dry-run            # print what would be posted, post nothing
 *   node post-to-bluesky.js --slug <slug>        # post a specific article instead of the newest
 *
 * Exit codes: 0 = posted (or dry-run printed), 1 = missing credentials/config or API error.
 */

const fs = require('fs');
const path = require('path');

const BSKY_API = 'https://bsky.social/xrpc';
const DEFAULT_BLOG_URL = 'https://daily-brief.vercel.app'; // TODO: change to your real Vercel URL

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slugIdx = args.indexOf('--slug');
const wantedSlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// Byte offset of a character index (Bluesky facets use UTF-8 byte offsets).
function byteOffset(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

async function main() {
  const articles = JSON.parse(fs.readFileSync(path.join(__dirname, 'articles.json'), 'utf8'));
  if (!Array.isArray(articles) || articles.length === 0) fail('No articles found in articles.json.');

  let article;
  if (wantedSlug) {
    article = articles.find((a) => a.slug === wantedSlug);
    if (!article) fail(`No article with slug "${wantedSlug}" in articles.json.`);
  } else {
    article = [...articles].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
  }

  const blogUrl = (process.env.BLOG_URL || DEFAULT_BLOG_URL).replace(/\/$/, '');
  const articleUrl = `${blogUrl}/articles/${article.slug}/`;

  // Bluesky posts are max 300 graphemes; keep title + link well under that.
  let text = `${article.title}\n\n${articleUrl}`;
  if (text.length > 280) {
    const cut = 280 - articleUrl.length - 5; // room for "…" + blank line + URL
    text = `${article.title.slice(0, Math.max(0, cut))}…\n\n${articleUrl}`;
  }
  const urlStart = text.indexOf(articleUrl);
  const facets = [
    {
      index: { byteStart: byteOffset(text, urlStart), byteEnd: byteOffset(text, urlStart + articleUrl.length) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: articleUrl }],
    },
  ];

  if (dryRun) {
    console.log('[dry-run] Would post this to Bluesky (nothing was posted):');
    console.log('---');
    console.log(text);
    console.log('---');
    console.log(`Article: ${article.title} (${article.date}, ${article.category})`);
    return;
  }

  const handle = process.env.BSKY_HANDLE;
  const appPassword = process.env.BSKY_APP_PASSWORD;
  if (!handle || !appPassword) {
    fail(
      'Bluesky credentials are missing.\n' +
        'Set BSKY_HANDLE and BSKY_APP_PASSWORD as environment variables first.\n' +
        'Example:\n' +
        '  BSKY_HANDLE=you.bsky.social BSKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx node post-to-bluesky.js\n' +
        'The app password is created in Bluesky: Settings -> Privacy and Security -> App Passwords.\n' +
        'It is NOT your real Bluesky password and can be deleted any time.'
    );
  }
  if (!process.env.BLOG_URL) {
    console.warn(`WARNING: BLOG_URL is not set — using default ${blogUrl}. Set BLOG_URL to your real Vercel URL.`);
  }

  // 1. Sign in (app password only — never the real password).
  const sessionRes = await fetch(`${BSKY_API}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password: appPassword }),
  });
  if (!sessionRes.ok) {
    fail(`Bluesky sign-in failed (HTTP ${sessionRes.status}). Check BSKY_HANDLE and BSKY_APP_PASSWORD.`);
  }
  const session = await sessionRes.json();

  // 2. Create the post.
  const postRes = await fetch(`${BSKY_API}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        facets,
      },
    }),
  });
  if (!postRes.ok) {
    const err = await postRes.text();
    fail(`Bluesky post failed (HTTP ${postRes.status}): ${err}`);
  }
  const post = await postRes.json();
  console.log(`Posted to Bluesky: ${post.uri}`);
  console.log(text);
}

main().catch((err) => fail(err.message || String(err)));
