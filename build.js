#!/usr/bin/env node
/**
 * build.js — static site generator for the Daily Brief news blog.
 *
 * Reads articles.json and generates a static site into dist/:
 *   dist/index.html                  (homepage, newest first)
 *   dist/articles/<slug>/index.html (one page per article)
 *   dist/style.css                   (copied from style.css)
 *   dist/sitemap.xml, dist/robots.txt
 *
 * Usage:  node build.js
 *
 * Rules enforced here:
 *  - Every article MUST have an imageUrl (hero image is required).
 *  - Slugs must be unique and URL-safe.
 *  - Warns if more than MAX_PER_DAY articles share one date
 *    (the blog publishes max 2 articles per day).
 */

const fs = require('fs');
const path = require('path');

const SITE = {
  name: 'Daily Brief',
  tagline: 'Top stories, every day.',
  description: 'Daily Brief — short, factual news stories on the topics people are talking about.',
  // TODO: change this to your real deployed Vercel URL after first deploy.
  url: 'https://daily-brief-eight-beta.vercel.app',
  language: 'en',
};

const MAX_PER_DAY = 2;
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ARTICLES_FILE = path.join(ROOT, 'articles.json');

// ---------------------------------------------------------------- helpers

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function readArticles() {
  const raw = fs.readFileSync(ARTICLES_FILE, 'utf8');
  const articles = JSON.parse(raw);
  if (!Array.isArray(articles)) throw new Error('articles.json must contain a JSON array.');
  return articles;
}

function validate(articles) {
  const seen = new Set();
  const perDay = {};
  const required = ['id', 'slug', 'title', 'summary', 'category', 'date', 'imageUrl', 'body'];
  for (const a of articles) {
    for (const f of required) {
      if (!a[f] || (Array.isArray(a[f]) && a[f].length === 0)) {
        throw new Error(`Article "${a.id || '(no id)'}" is missing required field: ${f}`);
      }
    }
    if (!/^[a-z0-9-]+$/.test(a.slug)) throw new Error(`Bad slug "${a.slug}" (use lowercase letters, numbers and hyphens only).`);
    if (seen.has(a.slug)) throw new Error(`Duplicate slug: ${a.slug}`);
    seen.add(a.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error(`Bad date "${a.date}" for "${a.slug}" (use YYYY-MM-DD).`);
    perDay[a.date] = (perDay[a.date] || 0) + 1;
  }
  for (const [date, n] of Object.entries(perDay)) {
    if (n > MAX_PER_DAY) {
      console.warn(`WARNING: ${n} articles on ${date} — the blog publishes max ${MAX_PER_DAY} per day.`);
    }
  }
}

// ---------------------------------------------------------------- templates

function adHeadSlots() {
  // Adsterra Social Bar + Popunder codes go just below <head>.
  // These comments stay harmless when empty — paste the real codes
  // between the markers (see README.md).
  return [
    '  <!-- ADSTERRA SOCIAL BAR: paste your Adsterra Social Bar code here -->',
    '  <!-- ADSTERRA POPUNDER: paste your Adsterra Popunder code here -->',
  ].join('\n');
}

function adBannerSlot() {
  // 300x250 banner slot in the sidebar. Empty until the real code is pasted.
  return [
    '    <!-- ADSTERRA BANNER 300x250: paste your Adsterra Banner (300x250) code inside the div below -->',
    '    <div class="ad-slot ad-300x250" data-ad-slot="banner-300x250"></div>',
  ].join('\n');
}

function layout({ title, description, ogImage, canonical, body }) {
  return `<!DOCTYPE html>
<html lang="${SITE.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/style.css">
${adHeadSlots()}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="site-name" href="/">${esc(SITE.name)}</a>
    <span class="site-tagline">${esc(SITE.tagline)}</span>
  </div>
</header>
<main class="wrap layout">
  <div class="content">
${body}
  </div>
  <aside class="sidebar">
${adBannerSlot()}
    <div class="about-box">
      <h3>About ${esc(SITE.name)}</h3>
      <p>Short, factual news stories on the topics people are talking about — published twice a day at most.</p>
    </div>
  </aside>
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>&copy; ${new Date().getFullYear()} ${esc(SITE.name)}. All stories are written from publicly reported news. Images are used under free licences — see the credit under each photo.</p>
  </div>
</footer>
</body>
</html>
`;
}

function articleCard(a) {
  const url = `/articles/${a.slug}/`;
  return `<article class="card">
  <a href="${esc(url)}"><img class="card-img" src="${esc(a.imageUrl)}" alt="" loading="lazy"></a>
  <div class="card-body">
    <span class="tag">${esc(a.category)}</span>
    <time datetime="${esc(a.date)}">${esc(formatDate(a.date))}</time>
    <h2><a href="${esc(url)}">${esc(a.title)}</a></h2>
    <p>${esc(a.summary)}</p>
    <a class="read-more" href="${esc(url)}">Read more &rarr;</a>
  </div>
</article>`;
}

function sampleBadge(a) {
  return a.sample ? '\n<p class="sample-note">Sample article — written from publicly reported news for testing the blog.</p>' : '';
}

// ---------------------------------------------------------------- build

function build() {
  const articles = readArticles();
  validate(articles);
  articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? -1 : 1));

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'articles'), { recursive: true });

  // Homepage
  const cards = articles.map(articleCard).join('\n');
  const homeBody = `<h1 class="page-title">Latest stories</h1>\n${cards}`;
  fs.writeFileSync(
    path.join(DIST, 'index.html'),
    layout({
      title: `${SITE.name} — ${SITE.tagline}`,
      description: SITE.description,
      ogImage: articles[0] ? articles[0].imageUrl : '',
      canonical: SITE.url + '/',
      body: homeBody,
    })
  );

  // Article pages
  for (const a of articles) {
    const url = `${SITE.url}/articles/${a.slug}/`;
    const others = articles.filter((x) => x.slug !== a.slug);
    const related = [
      ...others.filter((x) => x.category === a.category),
      ...others.filter((x) => x.category !== a.category),
    ].slice(0, 3);
    const relatedHtml = related.length
      ? `<section class="related"><h2>Related stories</h2>\n${related.map(articleCard).join('\n')}</section>`
      : '';
    const body = `<nav class="crumbs"><a href="/">Home</a> &rsaquo; ${esc(a.category)}</nav>
<article class="article">
  <span class="tag">${esc(a.category)}</span>
  <time datetime="${esc(a.date)}">${esc(formatDate(a.date))}</time>
  <h1>${esc(a.title)}</h1>${sampleBadge(a)}
  <figure class="hero">
    <img src="${esc(a.imageUrl)}" alt="">
    ${a.imageCredit ? `<figcaption>${esc(a.imageCredit)}</figcaption>` : ''}
  </figure>
  ${a.body.map((p) => `<p>${esc(p)}</p>`).join('\n  ')}
  ${a.source ? `<p class="source">Source: <a href="${esc(a.source)}" rel="nofollow noopener" target="_blank">${esc(a.source)}</a></p>` : ''}
</article>
${relatedHtml}`;
    const dir = path.join(DIST, 'articles', a.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      layout({
        title: `${a.title} — ${SITE.name}`,
        description: a.summary,
        ogImage: a.imageUrl,
        canonical: url,
        body,
      })
    );
  }

  // sitemap.xml
  const urls = [SITE.url + '/'].concat(articles.map((a) => `${SITE.url}/articles/${a.slug}/`));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

  // stylesheet
  fs.copyFileSync(path.join(ROOT, 'style.css'), path.join(DIST, 'style.css'));

  console.log(`Built ${articles.length} article(s) into ${DIST}`);
  console.log(`Homepage: ${path.join(DIST, 'index.html')}`);
}

build();
