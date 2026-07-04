#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'manifest.json');
const codePath = resolve(root, 'dist/code.js');
const uiPath = resolve(root, 'dist/ui.html');

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

if (!existsSync(manifestPath)) {
  fail('manifest.json is missing');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const uiManifestPath = resolve(root, manifest.ui ?? '');
const codeManifestPath = resolve(root, manifest.main ?? '');

if (!manifest.ui) {
  fail('manifest.json is missing a "ui" entry');
} else if (!existsSync(uiManifestPath)) {
  fail(`manifest ui file not found: ${manifest.ui}`);
} else {
  pass(`manifest ui file exists (${manifest.ui})`);
}

if (!manifest.main) {
  fail('manifest.json is missing a "main" entry');
} else if (!existsSync(codeManifestPath)) {
  fail(`manifest main file not found: ${manifest.main}`);
} else {
  pass(`manifest main file exists (${manifest.main})`);
}

if (!existsSync(codePath)) {
  fail('dist/code.js is missing — run pnpm build');
} else {
  const code = readFileSync(codePath, 'utf8');

  if (!code.includes('figma.showUI(__html__')) {
    fail('dist/code.js must call figma.showUI(__html__, ...)');
  } else {
    pass('code.js uses figma.showUI(__html__)');
  }

  if (code.includes('<!doctype html>') || code.includes('<!DOCTYPE html>')) {
    fail('dist/code.js embeds HTML — remove Vite define for __html__');
  } else {
    pass('code.js does not embed HTML');
  }

  try {
    new Function(code);
    pass('code.js parses as JavaScript');
  } catch (error) {
    fail(`code.js has a syntax error: ${error.message}`);
  }
}

if (!existsSync(uiPath)) {
  fail('dist/ui.html is missing — run pnpm build');
} else {
  const ui = readFileSync(uiPath, 'utf8');

  if (ui.includes('type="module"')) {
    fail('dist/ui.html still uses type="module" scripts');
  } else {
    pass('ui.html avoids ES module scripts');
  }

  if (!ui.includes('<script defer>')) {
    fail('dist/ui.html is missing a deferred classic script tag');
  } else {
    pass('ui.html uses a deferred classic script');
  }

  if (!ui.includes('id="root"')) {
    fail('dist/ui.html is missing #root');
  } else {
    pass('ui.html contains #root mount point');
  }

  const scriptMatch = ui.match(/<script defer>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    fail('dist/ui.html script bundle could not be parsed');
  } else {
    const bundle = scriptMatch[1];

    try {
      new Function(bundle);
      pass('ui.html script bundle parses as JavaScript');
    } catch (error) {
      fail(
        `ui.html script bundle has a syntax error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (bundle.includes('</script>')) {
      fail('ui.html script bundle contains "</script>" which can break Figma injection');
    } else {
      pass('ui.html script bundle avoids "</script>" sequences');
    }

    if (
      !bundle.includes('Generate Context') &&
      !bundle.includes('Export AI-ready design context')
    ) {
      warn('ui.html bundle may be missing expected React app code');
    } else {
      pass('ui.html bundle contains React app code');
    }
  }
}

console.log('');

if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach((message) => console.log(`  ! ${message}`));
  console.log('');
}

if (errors.length > 0) {
  console.log('Verification failed:');
  errors.forEach((message) => console.log(`  ✗ ${message}`));
  process.exit(1);
}

console.log('All checks passed. Safe to reload the plugin in Figma.');
console.log('Tip: close and reopen the plugin — re-import manifest only when manifest.json changes.');
