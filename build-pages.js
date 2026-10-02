const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HEADER = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8').trim();
const FOOTER = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim();

// Matches the unbuilt placeholder (including stray duplicate copies left over
// from an earlier conversion pass) OR an already-inlined header, so running
// this script again after editing partials/header.html re-syncs every page.
const HEADER_RE = new RegExp(
    '(?:<div id="site-header">[\\s\\S]*?<\\/div>(?:\\s*<!--[\\s\\S]*?-->\\s*<\\/div>)*' +
    '|<div class="top-bar">[\\s\\S]*?<\\/header>)',
    'i'
);

// Same idea for the footer. Also absorbs a standalone back-to-top button
// sitting right after it, since partials/footer.html already includes one -
// pages converted by the old script ended up with a duplicate back-to-top div.
const FOOTER_RE = new RegExp(
    '(?:<div id="site-footer">[\\s\\S]*?<\\/div>(?:\\s*<!--[\\s\\S]*?-->\\s*<\\/div>)*' +
    '|<footer class="site-footer">[\\s\\S]*?<\\/footer>)' +
    '(?:\\s*<div class="back-to-top">[\\s\\S]*?<\\/div>)?',
    'i'
);

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

function buildPage(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  if (!HEADER_RE.test(original) || !FOOTER_RE.test(original)) {
    console.log('[SKIP] no header/footer markers found:', filePath);
    return false;
  }

  let content = original
      .replace(HEADER_RE, () => HEADER)
      .replace(FOOTER_RE, () => FOOTER);

  if (content === original) {
    return false;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[OK] built:', filePath);
  return true;
}

function main() {
  const files = [
    path.join(ROOT, 'index.html'),
    ...findHtmlFiles(path.join(ROOT, 'pages')),
  ];

  let count = 0;

  for (const file of files) {
    if (buildPage(file)) count++;
  }

  console.log(`Inlined header/footer into ${count} page(s).`);
}

main();
