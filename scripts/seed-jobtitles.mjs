// @ts-nocheck
/**
 * Job-title sanity pass.
 *
 * The base seeder drew job titles from a small pool, so a single company could
 * end up with several "IT Director"s. In reality a company has ONE of each
 * management/senior role, but can have many rank-and-file staff (several
 * support analysts, engineers, etc.). This reassigns titles per company so:
 *   • management titles are UNIQUE within a company (one MD, one IT Director…);
 *   • staff titles may repeat.
 * The same title can of course appear across DIFFERENT companies.
 *
 * Multi-company demo logins (steve/martin/brian) keep their titles; if theirs is
 * a management title it's reserved so no colleague duplicates it. Deterministic
 * per contact/company, so re-runs are stable.
 *
 *   node scripts/seed-jobtitles.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const here = dirname(fileURLToPath(import.meta.url))
const LOGIN_EMAILS = new Set(['steve@drakey.co.uk', 'martin.court@redcentricplc.com', 'brian.bullman@redcentricplc.com'])

// Unique-per-company (management / senior singular roles).
const MGMT_TITLES = [
  'Managing Director', 'IT Director', 'Finance Director', 'Operations Director',
  'Head of IT', 'IT Manager', 'Infrastructure Manager', 'Head of Cyber Security',
  'Data Protection Officer', 'Facilities Manager', 'HR Manager', 'Operations Manager',
  'Head of Finance', 'Digital Transformation Lead', 'Head of Service Delivery',
  'Procurement Manager', 'Head of Projects', 'Network Manager', 'Head of Applications',
  'Office Manager',
]
// May repeat within a company (rank-and-file).
const STAFF_TITLES = [
  'Systems Administrator', 'IT Support Analyst', 'Service Desk Analyst', 'Network Engineer',
  'Software Developer', 'Cyber Security Analyst', 'Project Coordinator', 'Business Analyst',
  'Desktop Support Technician', 'Cloud Engineer', 'Data Analyst', 'Applications Support Analyst',
  'DevOps Engineer', 'QA Engineer', 'Procurement Officer', 'Finance Assistant', 'HR Advisor',
]

function loadEnv(path) {
  const out = {}; let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const enc = (s) => encodeURIComponent(s)

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
/** Deterministic shuffle of a copy of `arr`, seeded by `key`. */
function shuffle(arr, key) {
  const r = mulberry32(hashStr(key)); const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

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
    async patch(set, id, body) { const r = await fetch(`${API}/${set}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${set}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  const accounts = await client.getAll('accounts?$select=accountid,name&$top=100')

  let patched = 0
  for (const acc of accounts) {
    const contacts = await client.getAll(
      `contacts?$select=contactid,emailaddress1,jobtitle&$filter=${enc(`_parentcustomerid_value eq ${acc.accountid} and contains(description,'${MARKER}')`)}`,
    )
    if (!contacts.length) continue

    // Preserve login identities; reserve any management title they hold.
    const logins = contacts.filter((c) => LOGIN_EMAILS.has((c.emailaddress1 || '').toLowerCase()))
    const others = contacts
      .filter((c) => !LOGIN_EMAILS.has((c.emailaddress1 || '').toLowerCase()))
      .sort((a, b) => hashStr(a.contactid) - hashStr(b.contactid))
    const reserved = new Set(logins.map((c) => c.jobtitle).filter((t) => MGMT_TITLES.includes(t)))

    const availMgmt = shuffle(MGMT_TITLES.filter((t) => !reserved.has(t)), acc.accountid)
    // A sensible share are managers (each unique); the rest are staff (may repeat).
    const mgrCount = Math.min(availMgmt.length, Math.max(3, Math.round(others.length * 0.4)))

    for (let i = 0; i < others.length; i++) {
      const c = others[i]
      const title = i < mgrCount
        ? availMgmt[i]
        : STAFF_TITLES[hashStr(c.contactid) % STAFF_TITLES.length]
      if (title !== c.jobtitle) { await client.patch('contacts', c.contactid, { jobtitle: title }); patched++ }
    }
    console.log(`✓ ${acc.name} — ${others.length} colleagues (${mgrCount} unique management)`)
  }
  console.log(`\nDone. Updated ${patched} job titles.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
