// @ts-nocheck
/**
 * Multi-company demo identity — creates a `steve@drakey.co.uk` (no plus-alias)
 * contact under several companies, so signing in as that email exercises the
 * multi-company switcher (`client.me.companies()` keys off the token email).
 *
 *   node scripts/seed-multicompany.mjs
 *   node scripts/seed-multicompany.mjs --clean
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const EMAIL = 'steve@drakey.co.uk'
const COMPANIES = [
  'Aire Valley Logistics Ltd',
  'Ridings Mutual Building Society',
  'Calder & Ryburn Care Group',
]
const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  const out = {}
  let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue
    const i = l.indexOf('='); if (i === -1) continue
    out[l.slice(0, i).trim()] = l.slice(i + 1).trim()
  }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const CLEAN = process.argv.includes('--clean')
const enc = (s) => encodeURIComponent(s)

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
    async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
  }
}
async function accountByName(client, name) {
  const r = await client.get(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  if (CLEAN) {
    const rows = (await client.get(`contacts?$select=contactid&$filter=${enc(`emailaddress1 eq '${EMAIL}'`)}`)).value || []
    for (const c of rows) await client.del('contacts', c.contactid)
    console.log(`✓ removed ${rows.length} ${EMAIL} contacts`)
    return
  }
  for (const name of COMPANIES) {
    const acc = await accountByName(client, name)
    if (!acc) { console.log(`• ${name} — no account`); continue }
    // Idempotency: skip if steve@ already a contact under this account.
    const existing = (await client.get(`contacts?$select=contactid&$filter=${enc(`emailaddress1 eq '${EMAIL}' and _parentcustomerid_value eq ${acc.accountid}`)}`)).value || []
    if (existing.length) { console.log(`• ${name} — already linked`); continue }
    await client.create('contacts', {
      firstname: 'Steve', lastname: 'Drake', emailaddress1: EMAIL, jobtitle: 'IT Manager',
      description: `${MARKER} Multi-company demo identity.`,
      'parentcustomerid_account@odata.bind': `/accounts(${acc.accountid})`,
    })
    console.log(`✓ ${name} — linked ${EMAIL}`)
  }
  console.log('\nDone.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
