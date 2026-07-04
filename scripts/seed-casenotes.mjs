// @ts-nocheck
/**
 * Case-notes seeder — adds a realistic update timeline (Dataverse `annotation`
 * records regarding each demo incident) so the case detail page has something
 * to show. Notes progress logged → investigating → fix → resolved, back-dated
 * across the case's life via overriddencreatedon. Deterministic per case.
 *
 * Marker "[DEMO-RCPORTAL]" lives in notetext for cleanup.
 *   node scripts/seed-casenotes.mjs
 *   node scripts/seed-casenotes.mjs --clean
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  const out = {}; let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const CLEAN = process.argv.includes('--clean')
const enc = (s) => encodeURIComponent(s)

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function picker(id) { const r = mulberry32(hashStr(id)); return { int: (a, b) => a + Math.floor(r() * (b - a + 1)) } }

// Ordered support progression — the first K are used per case.
const UPDATES = [
  { s: 'Ticket logged', t: 'Logged with the service desk and assigned to an engineer. We’ll be in touch with an update shortly.' },
  { s: 'Investigating', t: 'We’ve reproduced the issue and are investigating the root cause.' },
  { s: 'Update', t: 'Applied an initial fix to the affected area and are monitoring for any recurrence.' },
  { s: 'Awaiting your confirmation', t: 'Could you confirm whether things have settled at your end? Happy to keep digging if not.' },
  { s: 'Resolved', t: 'Root cause has been addressed and we’re satisfied the ticket is resolved. Please let us know if anything recurs.' },
]

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
    async getAll(path) { const rows = []; let u = `${API}/${path}`; while (u) { const r = await fetch(u, { headers: base }); if (!r.ok) throw new Error(`GET ${u} → ${r.status} ${await r.text()}`); const j = await r.json(); rows.push(...(j.value || [])); u = j['@odata.nextLink'] || null } return rows },
    async create(set, body) { const r = await fetch(`${API}/${set}`, { method: 'POST', headers: base, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${set} → ${r.status} ${await r.text()}`) },
    async del(set, id) { const r = await fetch(`${API}/${set}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${set}(${id}) → ${r.status}`) },
  }
}

async function clean(client) {
  const notes = await client.getAll(`annotations?$select=annotationid&$filter=${enc(`contains(notetext,'${MARKER}')`)}`)
  for (const n of notes) await client.del('annotations', n.annotationid)
  console.log(`✓ removed ${notes.length} demo notes`)
}

async function seed(client) {
  const cases = await client.getAll(`incidents?$select=incidentid,createdon&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  // Keep well clear of "now" — overriddencreatedon rejects future dates and
  // client/server clock skew makes exactly-now risky.
  const safeNow = Date.now() - 3_600_000
  let created = 0, skipped = 0
  for (const c of cases) {
    const existing = await client.getAll(`annotations?$select=annotationid&$filter=${enc(`_objectid_value eq ${c.incidentid} and contains(notetext,'${MARKER}')`)}&$top=1`)
    if (existing.length) { skipped++; continue }
    const P = picker(c.incidentid)
    const k = P.int(1, 4)
    const base = new Date(c.createdon).getTime()
    for (let i = 0; i < k; i++) {
      const u = UPDATES[i]
      let d = base + (i + 1) * P.int(1, 3) * 86_400_000
      if (d > safeNow) d = safeNow
      await client.create('annotations', {
        subject: u.s,
        notetext: `${u.t} ${MARKER}`,
        overriddencreatedon: new Date(d).toISOString(),
        'objectid_incident@odata.bind': `/incidents(${c.incidentid})`,
      })
      created++
    }
  }
  console.log(`\nDone. ${created} notes created across ${cases.length - skipped} cases (${skipped} already had notes).`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  if (CLEAN) return clean(client)
  await seed(client)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
