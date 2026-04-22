// packages/extension/build.ts — builds both browser targets sequentially

import { $ } from 'bun'

console.log('Building Chrome...')
await $`BROWSER=chrome bun run vite build`

console.log('Building Firefox...')
await $`BROWSER=firefox bun run vite build`

console.log('Done. Outputs:')
console.log('  dist/chrome/  — load in chrome://extensions')
console.log('  dist/firefox/ — load in about:debugging')
