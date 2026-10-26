// worker.js
// Serves the static site as-is for everyone, EXCEPT social-media link-preview
// crawlers (Facebook, WhatsApp, LinkedIn, etc.) requesting a news or CPD
// event detail page. Those pages are a client-rendered SPA -- the actual
// article title/photo only appear after JS runs, which crawlers don't do,
// so they were always seeing the generic static <title>/favicon instead of
// the real article. For crawler requests only, this fetches the article
// from the backend API and returns a small HTML document with real
// og:title / og:description / og:image tags (and a refresh/canonical link
// back to the real page, for the rare crawler that also renders it).
//
// Real browsers are completely unaffected -- they always fall through to
// env.ASSETS.fetch(request), i.e. the normal static dist/ build.

const API_BASE = 'https://slna-backend-production.up.railway.app/api';
const BACKEND_ORIGIN = 'https://slna-backend-production.up.railway.app';
const FALLBACK_IMAGE = '/images/slna-logo-footer.png';
const SITE_ORIGIN = 'https://slna.lk';

const CRAWLER_UA_PATTERN =
  /facebookexternalhit|facebookcatalog|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|vkshare|redditbot|skypeuripreview|embedly|quora link preview|w3c_validator|google-inspectiontool/i;

// Every page that's actually reachable from the live site navigation (see
// partials/header.html and partials/footer.html) -- i.e. excludes the two
// admin/staff pages (already noindex'd directly) and the handful of page
// files that exist on disk but aren't linked from any current menu
// (commented out in header.html pending launch). Kept in sync by hand since
// it's a short, slow-moving list; news/event/album detail URLs below are
// generated live from the backend instead, since those change constantly.
const STATIC_PAGES = [
  '/', '/pages/about-slna.html', '/pages/history.html', '/pages/vision-mission.html',
  '/pages/executive-committee.html', '/pages/committees.html', '/pages/past-presidents.html',
  '/pages/membership.html', '/pages/membership-categories.html', '/pages/join-slna.html',
  '/pages/membership-benefits.html', '/pages/member-login.html', '/pages/cpd-programmes.html',
  '/pages/training-workshops.html', '/pages/e-learning.html', '/pages/cpd-resources.html',
  '/pages/nursing-research.html', '/pages/research-publications.html', '/pages/slna-journal.html',
  '/pages/newsletters.html', '/pages/annual-reports.html', '/pages/events-calendar.html',
  '/pages/annual-conference.html', '/pages/international-nurses-day.html', '/pages/past-events.html',
  '/pages/news.html', '/pages/gallery.html', '/pages/contact-slna.html',
  '/pages/contact-secretariat.html', '/pages/location-directions.html',
];

// Old link-hub pages (no unique content of their own) that 301 to the page
// which replaced them. Key is the page's bare name (no extension); value is
// the bare name of its replacement, also under /pages/.
const RETIRED_PAGE_REDIRECTS = {
  'events': 'events-calendar',
  'contact': 'contact-slna',
  'about': 'about-slna',
  'cpd-events': 'training-workshops',
  'professional-development': 'cpd-programmes',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    if (url.pathname === '/sitemap.xml') {
      return buildSitemap();
    }

    // Leftover "hub" pages from an older nav design -- each is just a grid
    // of links to the pages that now live directly in the header dropdowns.
    // Nothing on the current site links to them, so a visitor or crawler
    // landing here is sent straight to the page that replaced them instead
    // of leaving duplicate thin content indexable at two URLs.
    const bareName = url.pathname.replace(/^\/pages\//, '').replace(/\.html$/, '');
    if (/^\/pages\//.test(url.pathname) && RETIRED_PAGE_REDIRECTS[bareName]) {
      return Response.redirect(SITE_ORIGIN + '/pages/' + RETIRED_PAGE_REDIRECTS[bareName], 301);
    }

    const isCrawler = CRAWLER_UA_PATTERN.test(userAgent);
    const id = url.searchParams.get('id');

    // Cloudflare's asset handling serves these pages at both the real
    // ".html" path and the "clean" extensionless path (redirecting browsers
    // from one to the other) -- crawlers can end up requesting either, so
    // both need to be recognized here.
    const isNewsPath = url.pathname === '/pages/news-detail.html' || url.pathname === '/pages/news-detail';
    const isEventPath = url.pathname === '/pages/event-detail.html' || url.pathname === '/pages/event-detail';

    if (isCrawler && id) {
      if (isNewsPath) {
        const response = await buildNewsPreview(url, id);
        if (response) return response;
      } else if (isEventPath) {
        const category = url.searchParams.get('category') === 'other' ? 'other' : 'cpd';
        const response = await buildEventPreview(url, id, category);
        if (response) return response;
      }
    }

    return env.ASSETS.fetch(request);
  },
};

async function fetchJsonSafe(path) {
  try {
    const res = await fetch(API_BASE + path);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

async function buildSitemap() {
  const [news, cpdEvents, otherEvents, albums] = await Promise.all([
    fetchJsonSafe('/news'),
    fetchJsonSafe('/events/cpd'),
    fetchJsonSafe('/events/other'),
    fetchJsonSafe('/albums'),
  ]);

  const urls = STATIC_PAGES.map((loc) => ({ loc: SITE_ORIGIN + loc.replace(/\.html$/, '') }));

  for (const item of news) {
    urls.push({
      loc: SITE_ORIGIN + '/pages/news-detail?id=' + item.id,
      lastmod: item.updated_at || item.event_date,
    });
  }

  for (const event of cpdEvents) {
    urls.push({
      loc: SITE_ORIGIN + '/pages/event-detail?category=cpd&id=' + event.id,
      lastmod: event.updated_at || event.event_date,
    });
  }

  for (const event of otherEvents) {
    urls.push({
      loc: SITE_ORIGIN + '/pages/event-detail?category=other&id=' + event.id,
      lastmod: event.updated_at || event.event_date,
    });
  }

  for (const album of albums) {
    urls.push({
      loc: SITE_ORIGIN + '/pages/album?id=' + album.id,
      lastmod: album.created_at || album.event_date,
    });
  }

  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((entry) => {
      const lastmodTag = entry.lastmod
        ? '<lastmod>' + escapeHtml(String(entry.lastmod).slice(0, 10)) + '</lastmod>'
        : '';
      return '<url><loc>' + escapeHtml(entry.loc) + '</loc>' + lastmodTag + '</url>';
    }).join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=UTF-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}

async function buildNewsPreview(pageUrl, id) {
  try {
    const apiRes = await fetch(API_BASE + '/news/' + encodeURIComponent(id));
    if (!apiRes.ok) return null;

    const item = await apiRes.json();

    // Built from the path + id alone, not pageUrl's full query string --
    // a visitor arriving via Facebook/WhatsApp/an ad carries extra params
    // (?fbclid=..., ?utm_source=...) that would otherwise turn every shared
    // link into its own "distinct" canonical URL for the same article.
    const canonicalUrl = pageUrl.origin + pageUrl.pathname + '?id=' + encodeURIComponent(id);

    return previewResponse(canonicalUrl, pageUrl, {
      title: item.title || 'News Update',
      description: item.summary || stripHtml(item.body),
      imagePath: item.photo_url,
    });
  } catch (err) {
    return null;
  }
}

async function buildEventPreview(pageUrl, id, category) {
  try {
    const apiRes = await fetch(API_BASE + '/events/' + category + '/' + encodeURIComponent(id));
    if (!apiRes.ok) return null;

    const event = await apiRes.json();

    const canonicalUrl = pageUrl.origin + pageUrl.pathname +
      '?category=' + encodeURIComponent(category) + '&id=' + encodeURIComponent(id);

    return previewResponse(canonicalUrl, pageUrl, {
      title: event.title || 'Event Details',
      description: event.summary || '',
      imagePath: event.photo_url || event.photoUrl,
    });
  } catch (err) {
    return null;
  }
}

function previewResponse(canonicalUrl, pageUrl, { title, description, imagePath }) {
  const imageUrl = resolveImageUrl(pageUrl, imagePath);
  const trimmedDescription = truncate(description, 200);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)} | SLNA</title>
<meta name="description" content="${escapeHtml(trimmedDescription)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:site_name" content="Sri Lanka Nurses' Association">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(trimmedDescription)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}">
</head>
<body></body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

function resolveImageUrl(pageUrl, imagePath) {
  if (!imagePath) return pageUrl.origin + FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return BACKEND_ORIGIN + imagePath;
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, maxLength) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 1).trim() + '…';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
