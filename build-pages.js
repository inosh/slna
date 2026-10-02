const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const HEADER = fs.readFileSync(path.join(ROOT, 'partials', 'header.html'), 'utf8').trim();
const FOOTER = fs.readFileSync(path.join(ROOT, 'partials', 'footer.html'), 'utf8').trim();

const HEADER_RE = /<div id="site-header">[\s\S]*?<\/div>/i;
const FOOTER_RE = /<div id="site-footer">[\s\S]*?<\/div>/i;

// Plain asset/content folders copied into dist/ as-is.
const COPY_DIRS = ['css', 'js', 'images'];

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

function buildPage(srcPath, destPath) {
  const content = fs.readFileSync(srcPath, 'utf8');

  if (!HEADER_RE.test(content) || !FOOTER_RE.test(content)) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    console.log('[COPY] no header/footer markers, copied as-is:', srcPath);
    return;
  }

  const built = content
      .replace(HEADER_RE, () => HEADER)
      .replace(FOOTER_RE, () => FOOTER);

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

  buildPage(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));

  const pageFiles = findHtmlFiles(path.join(ROOT, 'pages'));
  for (const file of pageFiles) {
    const relative = path.relative(ROOT, file);
    buildPage(file, path.join(DIST, relative));
  }

  console.log(`Built ${pageFiles.length + 1} page(s) into dist/.`);
}

main();
