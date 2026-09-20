const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, 'pages');

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

function formatSideMenu(asideHtml, baseIndent) {
    const openingAsideMatch = asideHtml.match(/<aside\s+class=["']side-menu["'][^>]*>/i);
    const titleMatch = asideHtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const listMatch = asideHtml.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i);

    // Skip any unusual sidebar instead of risking its content.
    if (!openingAsideMatch || !titleMatch || !listMatch) {
        return asideHtml;
    }

    const openingAside = openingAsideMatch[0];
    const title = titleMatch[1].trim();
    const listItems = [];
    const itemRegex = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;

    let itemMatch;

    while ((itemMatch = itemRegex.exec(listMatch[1])) !== null) {
        const liAttributes = itemMatch[1].trim();
        const itemContent = itemMatch[2]
            .replace(/\s+/g, ' ')
            .trim();

        const liOpeningTag = liAttributes ? `<li ${liAttributes}>` : '<li>';

        // Keep each <li>...</li> on one line.
        listItems.push(
            `${baseIndent}    ${liOpeningTag}${itemContent}</li>`
        );
    }

    if (listItems.length === 0) {
        return asideHtml;
    }

    return [
        `${baseIndent}${openingAside}`,
        `${baseIndent}  <h3>${title}</h3>`,
        `${baseIndent}  <ul>`,
        listItems.join('\n'),
        `${baseIndent}  </ul>`,
        `${baseIndent}</aside>`
    ].join('\n');
}

function formatFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf8');
    const content = original.replace(/\r\n/g, '\n');

    const formatted = content.replace(
        /<aside\s+class=["']side-menu["'][^>]*>[\s\S]*?<\/aside>/gi,
        (asideHtml, offset, fullContent) => {
            const beforeAside = fullContent.slice(0, offset);
            const currentLine = beforeAside.slice(beforeAside.lastIndexOf('\n') + 1);
            const baseIndentMatch = currentLine.match(/^\s*/);
            const baseIndent = baseIndentMatch ? baseIndentMatch[0] : '';

            return formatSideMenu(asideHtml, baseIndent);
        }
    );

    if (formatted === original) {
        console.log('[SKIP] No side-menu changes:', filePath);
        return false;
    }

    fs.writeFileSync(filePath, formatted, 'utf8');
    console.log('[OK] Formatted side menu:', filePath);
    return true;
}

function main() {
    if (!fs.existsSync(PAGES_DIR)) {
        console.error('Error: pages folder not found:', PAGES_DIR);
        process.exit(1);
    }

    const htmlFiles = findHtmlFiles(PAGES_DIR);
    console.log(`Found ${htmlFiles.length} HTML file(s) in pages/`);

    let changedCount = 0;

    for (const filePath of htmlFiles) {
        if (formatFile(filePath)) {
            changedCount++;
        }
    }

    console.log(`Done. Formatted side menus in ${changedCount} file(s).`);
}

main();