// forge-nst6 browser smoke test.
//
// Imports the wasm-pack `--target bundler` output of forge-wasm as a
// regular ES module. Vite's wasm + top-level-await plugins handle the
// WebAssembly instantiation; no explicit `await init()` is needed.
//
// What this exercises end-to-end:
//   1. wasm-bindgen import of the wa-sqlite npm package from inside the
//      Rust crate (validates decision A — bundler-resolved npm@1.0.0).
//   2. IDBBatchAtomicVFS registration via vfs_register (the npm@1.0.0
//      main-thread persistent VFS — see forge-n89p for the OPFS swap).
//   3. The Database::open / exec / query / close round-trip (validates
//      forge-nst6 acceptance criteria).
//   4. Browser persistence across page reloads — manual: insert a row,
//      reload, then run again. The second run's SELECT should return
//      the rows from both runs.

import { ForgeRuntime } from 'forge-wasm';

const log = document.getElementById('log');
const rowsEl = document.getElementById('rows');
const runBtn = document.getElementById('run');
const reloadBtn = document.getElementById('reload');

reloadBtn.addEventListener('click', () => window.location.reload());

function emit(message, kind = 'row') {
  const div = document.createElement('div');
  div.className = `row ${kind}`;
  div.textContent = message;
  log.appendChild(div);
  console.log(`[opfs-smoke] ${message}`);
}

async function runRoundTrip() {
  log.replaceChildren();
  rowsEl.textContent = '(running…)';

  const rt = new ForgeRuntime();
  emit(`bundle version: ${rt.version}`);

  let db;
  try {
    db = await rt.openDatabase('forge-poc.db');
    emit('opened forge-poc.db on IDBBatchAtomicVFS', 'ok');
  } catch (err) {
    emit(`openDatabase failed: ${err}`, 'err');
    rowsEl.textContent = String(err);
    return;
  }

  try {
    await db.exec('CREATE TABLE IF NOT EXISTS smoke (k TEXT PRIMARY KEY, v INTEGER)');
    emit('CREATE TABLE smoke ok', 'ok');

    const stamp = new Date().toISOString();
    const value = Math.floor(Math.random() * 100000);
    await db.exec(
      `INSERT OR REPLACE INTO smoke (k, v) VALUES ('${stamp}', ${value})`
    );
    emit(`INSERT smoke('${stamp}', ${value}) ok`, 'ok');

    const rows = await db.query('SELECT k, v FROM smoke ORDER BY k');
    emit(`SELECT returned ${rows.length} row(s)`, 'ok');
    rowsEl.textContent = JSON.stringify(rows, null, 2);

    // Assert: there is at least one row and the latest one matches what
    // we just inserted. Earlier rows (from prior runs) prove OPFS
    // persistence.
    if (rows.length === 0) throw new Error('SELECT returned 0 rows');
    const latest = rows[rows.length - 1];
    if (latest[0] !== stamp || String(latest[1]) !== String(value)) {
      throw new Error(`row mismatch: got ${JSON.stringify(latest)}, expected [${stamp}, ${value}]`);
    }
    emit('round-trip assertions PASSED', 'ok');

    if (rows.length > 1) {
      emit(
        `Browser persistence (IDB) verified — ${rows.length - 1} row(s) carried over from prior runs`,
        'ok'
      );
    } else {
      emit(
        'first run — reload and click "Run round-trip" again to verify IDB persistence'
      );
    }
  } catch (err) {
    emit(`round-trip failed: ${err}`, 'err');
    rowsEl.textContent = String(err);
  } finally {
    if (db) {
      try {
        await db.close();
        emit('database closed cleanly', 'ok');
      } catch (err) {
        emit(`close failed: ${err}`, 'err');
      }
    }
  }
}

runBtn.addEventListener('click', () => {
  runRoundTrip().catch((err) => {
    emit(`unhandled: ${err}`, 'err');
  });
});

// Auto-run on first load to make the smoke test single-click — the
// "Run round-trip" button is for re-runs without reloading.
runRoundTrip().catch((err) => {
  emit(`unhandled: ${err}`, 'err');
});
