#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const url = require('url');

const BASE = 'https://www.encounterchurch.com';

async function fetchHTML(pathOrFullUrl) {
  const full = pathOrFullUrl.startsWith('http')
    ? pathOrFullUrl
    : `${BASE}${pathOrFullUrl}`;
  const resp = await axios.get(full);
  return resp.data;
}

async function scrapeBlogIndex(pagePath = '/blog') {
  const html = await fetchHTML(pagePath);
  const $ = cheerio.load(html);
  const posts = [];

  // Adjust the selector below to match your blog index markup
  // e.g. maybe blog items are under <article> or .blog-item, etc.
  $('a[href*="/blog/"]').each((i, el) => {
    const a = $(el);
    const href = a.attr('href');
    const title = a.text().trim();

    // Try to find a nearby excerpt or snippet
    const excerpt = a.closest('article').find('.excerpt, .summary').text().trim() || '';

    // Try to find a thumbnail image in the same container
    let img = null;
    const imgEl = a.closest('article').find('img').first();
    if (imgEl && imgEl.attr('src')) {
      const src = imgEl.attr('src');
      img = src.startsWith('http') ? src : (BASE + src);
    }

    if (href && title) {
      posts.push({
        title,
        url: href.startsWith('http') ? href : href,  // we’ll canonicalize later
        excerpt,
        image: img,
      });
    }
  });

  // Pagination: detect "Next" or older posts link if exists
  let nextPage = null;
  const nextLink = $('a[rel="next"], .pagination .next, a.pagination-next').attr('href');
  if (nextLink) {
    nextPage = nextLink.startsWith('http') ? nextLink : nextLink;
  }

  return { posts, nextPage };
}

async function scrapePostDetails(post) {
  try {
    const html = await fetchHTML(post.url);
    const $ = cheerio.load(html);

    // OG image or meta image
    let ogImg = $('meta[property="og:image"]').attr('content');
    if (!ogImg) {
      // fallback to any <img> in content
      const firstImg = $('article img, .post-image img').first().attr('src');
      if (firstImg) ogImg = firstImg.startsWith('http') ? firstImg : (BASE + firstImg);
    }

    // Tags (categories) from meta or visible tags
    const tags = [];
    $('meta[name="keywords"]').each((i, el) => {
      const c = $(el).attr('content');
      if (c) tags.push(...c.split(',').map(s => s.trim()));
    });
    $('.tags a, .post-tags a, .taglist a').each((i, el) => {
      const t = $(el).text().trim();
      if (t) tags.push(t);
    });

    // Deduplicate tags
    const uniqTags = Array.from(new Set(tags));

    return {
      ...post,
      image: ogImg || post.image,
      tags: uniqTags,
    };
  } catch (err) {
    console.warn(`Warning: failed to fetch details for ${post.url}: ${err.message}`);
    return { ...post, tags: [] };
  }
}

async function buildFullFeed() {
  let pagePath = '/blog';
  const allPosts = [];

  // Crawl index pages
  while (pagePath) {
    console.log('Crawling index:', pagePath);
    const { posts, nextPage } = await scrapeBlogIndex(pagePath);
    allPosts.push(...posts);
    pagePath = nextPage;
  }

  // Deduplicate by URL
  const map = new Map();
  allPosts.forEach(p => {
    const key = p.url;
    if (!map.has(key)) {
      map.set(key, p);
    }
  });
  const deduped = Array.from(map.values());

  // Scrape individual post detail for tags & images
  const enriched = [];
  for (const p of deduped) {
    console.log('Fetching post detail:', p.url);
    const ed = await scrapePostDetails(p);
    enriched.push(ed);
    // Optional: small delay to be courteous
    await new Promise(r => setTimeout(r, 200));
  }

  // Normalize URL paths: make sure `url` is relative path for widget usage
  const normalized = enriched.map(p => {
    let u = p.url;
    if (u.startsWith(BASE)) {
      u = u.replace(BASE, '');
    }
    return {
      title: p.title,
      url: u,
      tags: p.tags || [],
      image: p.image || null,
      excerpt: p.excerpt || '',
    };
  });

  // Write to file
  await fs.writeFile('recs.json', JSON.stringify(normalized, null, 2), 'utf-8');
  console.log(`Wrote ${normalized.length} posts to recs.json`);
}

// Run
buildFullFeed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});