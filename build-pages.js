const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const HEADER = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8').trim();
const FOOTER = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim();

const HEADER_RE = /<div id="site-header">[\s\S]*?<\/div>/i;
const FOOTER_RE = /<div id="site-footer">[\s\S]*?<\/div>/i;
const HEAD_CLOSE_RE = /<\/head>/i;

const SITE_ORIGIN = 'https://slna.lk';

// Plain asset/content folders copied into dist/ as-is.
const COPY_DIRS = ['css', 'js', 'images'];

// Plain files copied into dist/ root as-is.
const COPY_FILES = ['robots.txt', 'favicon.ico'];

// news-detail.html / event-detail.html are templates -- the real canonical
// URL depends on the ?id= of the article/event being viewed, which isn't
// known at build time. Each page sets its own canonical client-side once
// the real item loads (see js/news.js and js/event-detail.js); skip the
// generic build-time one for these so it's never left stale/wrong.
const SKIP_CANONICAL = new Set(['pages/news-detail.html', 'pages/event-detail.html']);

// Builds the canonical URL for a dist-relative path, matching the
// extensionless form the site actually serves pages at (Cloudflare's asset
// handling 307-redirects "X.html" to "X", and "index.html" to "/").
function canonicalUrlFor(relativePath) {
  const posixPath = relativePath.split(path.sep).join('/');

  if (posixPath === 'index.html') {
    return SITE_ORIGIN + '/';
  }

  return SITE_ORIGIN + '/' + posixPath.replace(/\.html$/i, '');
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function findHtmlFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (/\.html$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildPage(srcPath, destPath, relativePath) {
  const content = fs.readFileSync(srcPath, 'utf8');

  if (!HEADER_RE.test(content) || !FOOTER_RE.test(content)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log('[COPY] no header/footer markers, copied as-is:', srcPath);
    return;
  }

  let built = content
      .replace(HEADER_RE, () => HEADER)
      .replace(FOOTER_RE, () => FOOTER);

  if (!SKIP_CANONICAL.has(relativePath.split(path.sep).join('/')) && HEAD_CLOSE_RE.test(built)) {
    const canonicalTag = `<link rel="canonical" href="${canonicalUrlFor(relativePath)}">`;
    built = built.replace(HEAD_CLOSE_RE, () => canonicalTag + '</head>');
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, built, 'utf8');
  console.log('[OK] built:', destPath);
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(DIST, dir));
    }
  }

  for (const file of COPY_FILES) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, file));
    }
  }

  buildPage(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'), 'index.html');

  const pageFiles = findHtmlFiles(path.join(ROOT, 'pages'));
  for (const file of pageFiles) {
    const relative = path.relative(ROOT, file);
    buildPage(file, path.join(DIST, relative), relative);
  }

  console.log(`Built ${pageFiles.length + 1} page(s) into dist/.`);
}

main();
