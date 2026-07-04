import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const alias = {
  '@': resolve(__dirname, 'src'),
};

const uiHtmlPath = resolve(__dirname, 'dist/ui.html');

function readUiHtml(): string {
  return readFileSync(uiHtmlPath, 'utf8');
}

/**
 * Figma's plugin iframe does not reliably execute ES module scripts.
 * Convert the inlined bundle to a classic script after the UI build.
 */
function figmaUiHtmlFix(): Plugin {
  return {
    name: 'figma-ui-html-fix',
    closeBundle() {
      const html = readUiHtml();
      const fixed = html.replace(/<script type="module"( crossorigin)?>/g, '<script defer>');

      if (fixed === html) {
        throw new Error('Expected module script tag in dist/ui.html but none was found.');
      }

      writeFileSync(uiHtmlPath, fixed, 'utf8');
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode === 'code') {
    return {
      resolve: { alias },
      build: {
        emptyOutDir: false,
        lib: {
          entry: resolve(__dirname, 'src/code.ts'),
          formats: ['iife'],
          name: 'OpenContextPlugin',
          fileName: () => 'code.js',
        },
        rollupOptions: {
          output: {
            extend: true,
          },
        },
        target: 'es2017',
        outDir: 'dist',
      },
    };
  }

  return {
    plugins: [
      react(),
      viteSingleFile({
        removeViteModuleLoader: true,
        useRecommendedBuildConfig: true,
      }),
      figmaUiHtmlFix(),
    ],
    resolve: { alias },
    build: {
      emptyOutDir: true,
      target: 'es2017',
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
      modulePreload: false,
      rollupOptions: {
        input: resolve(__dirname, 'ui.html'),
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'assets/ui.js',
        },
      },
      outDir: 'dist',
    },
  };
});
