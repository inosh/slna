const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'pages');

// Patterns to detect old-style full header/footer
const HAS_OLD_HEADER = /<header\s+class="site-header"/i;
const HAS_OLD_FOOTER = /<footer\s+class="site-footer"/i;

// Shared layout snippets
const HEADER_PLACEHOLDER = `<div id="site-header">\n  <!-- Shared header will be inserted here -->\n</div>`;
const FOOTER_PLACEHOLDER = `<div id="site-footer">\n  <!-- Shared footer will be inserted here -->\n</div>`;

const SCRIPT_BLOCK = `<script src="../js/config.js"></script>\n<script src="../js/include-header.js"></script>\n<script src="../js/main.js"></script>`;

function findHtmlFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            findHtmlFiles(fullPath, files);
        } else if (entry.isFile() && /\.html$/i.test(entry.name)) {
            files.push(fullPath);
        }
    }

    return files;
}

function convertFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Skip if already using shared layout markers
    if (content.includes('id="site-header"') && content.includes('id="site-footer"')) {
        console.log('[SKIP] Already shared layout:', filePath);
        return false;
    }

    // Only convert if it looks like a full page with header+footer
    if (!HAS_OLD_HEADER.test(content) || !HAS_OLD_FOOTER.test(content)) {
        console.log('[SKIP] No full header/footer found:', filePath);
        return false;
    }

    // Remove old <header class="site-header"> ... </header>
    content = content.replace(
        /<header\s+class="site-header"[\s\S]*?<\/header>/i,
        HEADER_PLACEHOLDER
    );

    // Remove old <footer class="site-footer"> ... </footer>
    content = content.replace(
        /<footer\s+class="site-footer"[\s\S]*?<\/footer>/i,
        FOOTER_PLACEHOLDER
    );

    // Ensure there is a closing </body>
    if (!/<\/body>/i.test(content)) {
        console.log('[WARN] No </body> tag found, skipping scripts insertion:', filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }

    // Remove any existing include-header/config/main script tags to avoid duplicates
    content = content.replace(
        /<script\s+src=["']\.\.\/js\/config\.js["']\s*><\/script>/gi,
        ''
    );
    content = content.replace(
        /<script\s+src=["']\.\.\/js\/include-header\.js["']\s*><\/script>/gi,
        ''
    );
    content = content.replace(
        /<script\s+src=["']\.\.\/js\/main\.js["']\s*><\/script>/gi,
        ''
    );

    // Insert script block just before </body>
    const beforeBody = content.lastIndexOf('</body>');
    if (beforeBody === -1) {
        console.log('[WARN] Could not find </body> to insert scripts:', filePath);
        fs.writeFileSync(filePath, content, 'utf8');
        return true;
    }

    const before = content.slice(0, beforeBody);
    const after = content.slice(beforeBody);

    const newScripts = `\n${SCRIPT_BLOCK}\n`;

    content = before + newScripts + after;

    // Clean up multiple blank lines around the new sections
    content = content.replace(/\n{3,}/g, '\n\n');

    if (content === original) {
        console.log('[SKIP] No changes made:', filePath);
        return false;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[OK] Converted:', filePath);
    return true;
}

function main() {
    if (!fs.existsSync(PAGES_DIR)) {
        console.error('pages folder not found at:', PAGES_DIR);
        process.exit(1);
    }

    const htmlFiles = findHtmlFiles(PAGES_DIR);
    console.log('Found', htmlFiles.length, 'HTML files in pages/');

    let convertedCount = 0;

    for (const file of htmlFiles) {
        const changed = convertFile(file);
        if (changed) convertedCount++;
    }

    console.log('Converted', convertedCount, 'files to shared layout.');
}

main();