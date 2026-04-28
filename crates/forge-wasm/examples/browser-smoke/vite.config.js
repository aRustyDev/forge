import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// COOP/COEP headers enable cross-origin isolation. Not strictly
// required for the IDBBatchAtomicVFS chosen in forge-nst6 (no
// SharedArrayBuffer needed), but enabling them here documents the
// production header expectation tracked by forge-4a01 and keeps the
// path open for the OPFS migration in forge-n89p.
const isolationHeaders = {
  name: 'cross-origin-isolation-headers',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      next();
    });
  },
};

// wa-sqlite@1.0.0 has no `exports` field, so Rollup's strict subpath
// resolution refuses `wa-sqlite/dist/...` and `wa-sqlite/src/...` at
// build time. Pin them explicitly via aliases — these are the same
// paths Node's legacy `main`-based resolution would find.
const waSqlitePath = (subpath) =>
  fileURLToPath(new URL(`./node_modules/wa-sqlite/${subpath}`, import.meta.url));

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    isolationHeaders,
  ],
  resolve: {
    alias: {
      'wa-sqlite/dist/wa-sqlite-async.mjs': waSqlitePath('dist/wa-sqlite-async.mjs'),
      'wa-sqlite/src/examples/IDBBatchAtomicVFS.js': waSqlitePath('src/examples/IDBBatchAtomicVFS.js'),
      // Bare `wa-sqlite` import (used by the wasm-bindgen-emitted
      // `import { Factory } from 'wa-sqlite'`). Rollup's strict
      // resolution refuses it without an explicit alias.
      'wa-sqlite': waSqlitePath('src/sqlite-api.js'),
    },
  },
  // wa-sqlite ships large .wasm files in dist/. Pre-bundling adds
  // friction without value — let Vite serve them straight.
  optimizeDeps: {
    exclude: ['wa-sqlite'],
  },
  server: {
    port: 5180,
  },
});
