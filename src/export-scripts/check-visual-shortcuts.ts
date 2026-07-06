/** Bundled CI script content — written to context/scripts/check-visual-shortcuts.mjs on export */
export const CHECK_VISUAL_SHORTCUTS_SCRIPT = `#!/usr/bin/env node
/**
 * CI guard — rejects common visual shortcuts that diverge from OpenContext exports.
 *
 * Usage (from app repo root):
 *   node context/scripts/check-visual-shortcuts.mjs
 *   node context/scripts/check-visual-shortcuts.mjs --src src/screens
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = process.argv.includes('--src')
  ? process.argv[process.argv.indexOf('--src') + 1]
  : 'src/screens';

const CONTEXT_DIR = 'context';
const violations = [];

function walk(dir, files = []) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, files);
      } else if (/\\.(tsx|ts|jsx|js)$/.test(entry)) {
        files.push(full);
      }
    }
  } catch {
    // src dir may not exist yet
  }
  return files;
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const screenFiles = walk(SRC_DIR);

for (const file of screenFiles) {
  const content = readFileSync(file, 'utf8');

  if (/FormScreenView|MapScreen|MapRenderer|screenDefinitions\\.json/i.test(content)) {
    violations.push({ file, rule: 'FORBIDDEN_TEMPLATE', message: 'Generic template/map renderer detected' });
  }

  if (/@expo\\/vector-icons|Ionicons\\.|MaterialIcons\\./i.test(content)) {
    violations.push({ file, rule: 'GENERIC_ICONS', message: 'Generic icon library — use PNG paths from assets.json' });
  }

  if (/assets\\/icons\\/.*\\.svg/i.test(content)) {
    violations.push({ file, rule: 'SVG_ON_RN', message: 'SVG icon path on React Native — use PNG from assets.json' });
  }
}

try {
  const catalog = loadJson(join(CONTEXT_DIR, 'catalog/screens.json'));
  if (catalog?.screens) {
    for (const screen of catalog.screens) {
      const slug = screen.slug ?? screen.id;
      const assetsPath = join(CONTEXT_DIR, 'screens', slug, 'assets.json');
      const decorativePath = join(CONTEXT_DIR, 'screens', slug, 'decorative.json');
      const assets = loadJson(assetsPath);
      const decorative = loadJson(decorativePath);
      const screenSrc = join(SRC_DIR, slug, 'index.tsx');
      let srcContent = '';
      try {
        srcContent = readFileSync(screenSrc, 'utf8');
      } catch {
        violations.push({ file: screenSrc, rule: 'MISSING_SCREEN', message: \`No implementation at \${screenSrc}\` });
        continue;
      }

      if (decorative?.layers?.length > 0 && !/decorative|DesignImage|expo-image/i.test(srcContent)) {
        violations.push({
          file: screenSrc,
          rule: 'MISSING_DECORATIVE',
          message: \`\${slug} has decorative.json but implementation may omit decorative layers\`,
        });
      }

      for (const assetPath of assets?.assets ?? []) {
        const fileName = assetPath.split('/').pop();
        if (fileName && !srcContent.includes(fileName) && !srcContent.includes(assetPath)) {
          violations.push({
            file: screenSrc,
            rule: 'ASSET_NOT_WIRED',
            message: \`\${slug} lists \${assetPath} in assets.json but index.tsx may not reference it\`,
          });
        }
      }
    }
  }
} catch {
  // context not present — skip catalog checks
}

if (violations.length === 0) {
  console.log('✓ No visual shortcut violations detected.');
  process.exit(0);
}

console.error(\`✗ \${violations.length} visual shortcut violation(s):\\n\`);
for (const v of violations) {
  console.error(\`  [\${v.rule}] \${v.file}\`);
  console.error(\`    \${v.message}\`);
}
process.exit(1);
`;
