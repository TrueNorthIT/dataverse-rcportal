// @ts-nocheck
/**
 * Seeds `new_portaldomains` on every active account so the self-serve join can
 * match people to companies. Every company gets the operator/staff domains, so
 * Redcentric and TrueNorth staff can join any company. Idempotent.
 *
 *   node scripts/seed-portal-domains.mjs
 *
 * (The scope's join config must set domain_field = "new_portaldomains" for the
 * API to match on this field.)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Domains added to every company (space separated in the field).
const DOMAINS = ['redcentric.com', 'truenorthit.co.uk']

const here = dirname(fileURLToPath(import.meta.url))
function loadEnv(path) {
  const out = {}; let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
if (!DV) { console.error('Missing VITE_DATAVERSE_URL'); process.exit(1) }

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}

const token = await getToken()
const h = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
const value = DOMAINS.join(' ')

const accounts = await fetch(
  `${API}/accounts?$select=accountid,name&$filter=statecode eq 0&$orderby=name asc&$top=200`,
  { headers: h },
).then((r) => r.json())
if (!accounts.value) { console.error('Could not read accounts:', JSON.stringify(accounts).slice(0, 300)); process.exit(1) }

console.log(`Target: ${DV}\nSetting new_portaldomains = "${value}" on ${accounts.value.length} active accounts …\n`)
for (const a of accounts.value) {
  const res = await fetch(`${API}/accounts(${a.accountid})`, {
    method: 'PATCH', headers: h, body: JSON.stringify({ new_portaldomains: value }),
  })
  console.log(`${res.ok ? '✓' : '✗ ' + res.status} ${a.name}`)
  if (!res.ok) console.log('   ', (await res.text()).slice(0, 200))
}
console.log('\nDone.')
