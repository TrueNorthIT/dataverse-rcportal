// @ts-nocheck
/**
 * Vary the marketing opt-out flag on demo contacts so the "opted out of
 * marketing" indicator has something to show. Sets donotbulkemail = true on
 * roughly a third of the demo contacts (deterministic, idempotent).
 *
 *   node scripts/seed-marketing-optout.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
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
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  const rows = []
  let url = `${API}/contacts?$select=contactid,donotbulkemail&$filter=${enc(`contains(description,'${MARKER}')`)}&$top=200`
  while (url) {
    const r = await fetch(url, { headers: H })
    const j = await r.json()
    rows.push(...(j.value || []))
    url = j['@odata.nextLink'] || null
  }
  let optedOut = 0
  for (let i = 0; i < rows.length; i++) {
    const want = i % 3 === 0 // ~1 in 3 opted out
    if (rows[i].donotbulkemail === want) { if (want) optedOut++; continue }
    await fetch(`${API}/contacts(${rows[i].contactid})`, { method: 'PATCH', headers: H, body: JSON.stringify({ donotbulkemail: want }) })
    if (want) optedOut++
  }
  console.log(`Done. ${rows.length} demo contacts; ${optedOut} opted out of marketing.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
