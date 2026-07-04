// @ts-nocheck
/**
 * Fails if the committed generated types (src/types/dataverse.generated.ts) no
 * longer match the live API schema — i.e. someone changed a route/table but
 * didn't re-run `npm run generate:types`.
 *
 * The codegen doesn't emit tables/enums in a stable order, so we compare a
 * NORMALISED form (trimmed, non-empty lines, sorted) — order-insensitive, but
 * still catches any added/removed/changed field or enum.
 *
 *   node scripts/check-types-drift.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const API_URL = 'https://api.dataverse-contact.tnapps.co.uk'
const SCOPE = 'rcportal'
const committed = join(root, 'src/types/dataverse.generated.ts')
const tmp = join(root, 'src/types/.dataverse.generated.check.ts')

execFileSync(
  'npx',
  ['dataverse-client', 'generate', '--url', API_URL, '--scope', SCOPE, '--output', tmp],
  { stdio: 'inherit', shell: true, cwd: root },
)

const normalise = (file) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .sort()
    .join('\n')

let fresh, current
try {
  fresh = normalise(tmp)
  current = normalise(committed)
} finally {
  rmSync(tmp, { force: true })
}

if (fresh !== current) {
  console.error('\n✗ Generated types are out of date with the live schema.')
  console.error('  Run: npm run generate:types  (and commit src/types/dataverse.generated.ts)')
  process.exit(1)
}
console.log('✓ Generated types match the live schema.')
