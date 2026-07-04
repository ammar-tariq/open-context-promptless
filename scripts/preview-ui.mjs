#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { execSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const uiPath = resolve(root, 'dist/ui.html');
const port = Number(process.env.PORT ?? 4173);

if (!existsSync(uiPath)) {
  console.error('dist/ui.html not found. Run pnpm build first.');
  process.exit(1);
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': mimeTypes['.html'] });
  response.end(readFileSync(uiPath));
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`OpenContext UI preview: ${url}`);
  console.log('');
  console.log('This previews the React UI only (no Figma API).');
  console.log('Expect selection/messaging errors — that is normal here.');
  console.log('Press Ctrl+C to stop.');

  try {
    execSync(`open "${url}"`, { stdio: 'ignore' });
  } catch {
    // Non-macOS or open unavailable — user can visit URL manually.
  }
});
