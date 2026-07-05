// @ts-nocheck
/**
 * Sets new_connectivitytype (real choice column) on each demo site, so the
 * portal's connectivity pills/badges map to Dataverse. Deterministic per site
 * id, idempotent (set-if-empty), demo sites only (line3 marker).
 *
 *   node scripts/seed-connectivity.mjs           # set where empty
 *   node scripts/seed-connectivity.mjs --clean   # clear it on demo sites
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const here = dirname(fileURLToPath(import.meta.url))
const CLEAN = process.argv.includes('--clean')
function loadEnv(p) { const o = {}; let t; try { t = readFileSync(p, 'utf8') } catch { return o } for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; o[l.slice(0, i).trim()] = l.slice(i + 1).trim() } return o }
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const enc = encodeURIComponent
async function getToken() { const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }) }); const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`); return j.access_token }
function api(token) { const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-Version': '4.0' }; return {
  async getAll(p) { const out = []; let url = `${API}/${p}`; while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); const j = await r.json(); out.push(...(j.value || [])); url = j['@odata.nextLink'] || null } return out },
  async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
} }

// choice values from create-plan-schema.mjs (100000000 + index)
const TYPES = ['FTTP', 'FTTC', 'Leased Line', 'Dark Fibre', 'EFM']
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  const sites = await c.getAll(`customeraddresses?$select=customeraddressid,name,new_connectivitytype&$filter=${enc(`line3 eq '${MARKER}'`)}`)
  let n = 0
  for (const s of sites) {
    if (CLEAN) { if (s.new_connectivitytype != null) { await c.patch('customeraddresses', s.customeraddressid, { new_connectivitytype: null }); n++ } continue }
    if (s.new_connectivitytype != null) continue
    const idx = hashStr(s.customeraddressid) % TYPES.length
    await c.patch('customeraddresses', s.customeraddressid, { new_connectivitytype: 100000000 + idx })
    n++
  }
  console.log(CLEAN ? `✓ cleared ${n}/${sites.length}` : `✓ set connectivity on ${n}/${sites.length} sites`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
