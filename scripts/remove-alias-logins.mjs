// @ts-nocheck
/**
 * Remove the per-company steve+<code>@drakey.co.uk alias login contacts — they
 * were superseded by the single multi-company steve@drakey.co.uk (company
 * switcher). Leaves steve@drakey.co.uk (no plus) and martin.court untouched.
 *
 * Nulls any account.primarycontactid that points at an alias first, then
 * deletes the contact (Dataverse also RemoveLinks opp/case references).
 *
 *   node scripts/remove-alias-logins.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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
const enc = (s) => encodeURIComponent(s)

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`)
  return j.access_token
}

async function main() {
  console.log(`Target: ${DV}`)
  const token = await getToken()
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }

  // Alias logins only: emailaddress1 starts with "steve+" (excludes the plain
  // steve@drakey.co.uk and martin.court@redcentricplc.com).
  const found = (await (await fetch(
    `${API}/contacts?$select=contactid,emailaddress1&$filter=${enc("startswith(emailaddress1,'steve+')")}`,
    { headers: H },
  )).json()).value || []
  console.log(`${found.length} alias contacts:`, found.map((c) => c.emailaddress1).join(', '))

  for (const c of found) {
    // Null any account that names this contact as its primary contact.
    const accts = (await (await fetch(
      `${API}/accounts?$select=accountid&$filter=${enc(`_primarycontactid_value eq ${c.contactid}`)}`,
      { headers: H },
    )).json()).value || []
    for (const a of accts) {
      await fetch(`${API}/accounts(${a.accountid})/primarycontactid/$ref`, { method: 'DELETE', headers: H })
    }
    const del = await fetch(`${API}/contacts(${c.contactid})`, { method: 'DELETE', headers: H })
    console.log(`  ${del.ok ? 'deleted' : 'FAILED ' + del.status} ${c.emailaddress1}`)
  }
  console.log('\nDone.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
