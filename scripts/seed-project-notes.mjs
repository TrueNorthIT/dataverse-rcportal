// @ts-nocheck
/**
 * Project delivery-diary seeder — real annotations regarding each demo project
 * (objectid_msdyn_project), backdated across the schedule so the portal's
 * project Diary shows genuine, dated updates. Idempotent + deterministic; demo
 * notes carry [DEMO-RCPORTAL] in notetext (stripped in the UI) for safe cleanup.
 *
 *   node scripts/seed-project-notes.mjs           # create (skips projects that already have notes)
 *   node scripts/seed-project-notes.mjs --clean   # remove demo project notes
 *
 * (msdyn_projecttask can't be created via the Web API — Project for the Web
 * blocks it — so the diary is how we surface real per-project updates.)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const here = dirname(fileURLToPath(import.meta.url))
function loadEnv(p) { const o = {}; let t; try { t = readFileSync(p, 'utf8') } catch { return o } for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; o[l.slice(0, i).trim()] = l.slice(i + 1).trim() } return o }
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const CLEAN = process.argv.includes('--clean')
const enc = (s) => encodeURIComponent(s)

async function getToken() { const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }) }); const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`); return j.access_token }
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-Version': '4.0' }
  return {
    async getAll(p) { const out = []; let url = `${API}/${p}`; while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); const j = await r.json(); out.push(...(j.value || [])); url = j['@odata.nextLink'] || null } return out },
    async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
    async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
  }
}

// deterministic RNG
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const DAY = 86_400_000

const AUTHORS = ['Priya Shah (Project Manager)', 'Tom Fletcher (Delivery Lead)', 'Rachel Owen (Lead Engineer)', 'Sam Doyle (Solution Architect)']
const STAGES = ['Kick-off', 'Discovery complete', 'Build', 'Testing & UAT', 'Go-live', 'Handover & close']
const UPDATES = [
  (a) => ({ subject: 'Weekly status', text: `Weekly update from ${a}: progressing to plan, no blockers this week.` }),
  (a) => ({ subject: 'Weekly status', text: `Weekly update from ${a}: minor slippage on one workstream; recovery plan agreed.` }),
  (a) => ({ subject: 'Steering call', text: `Fortnightly steering call held; ${a} walked the customer through progress.` }),
  (a) => ({ subject: 'Risk logged', text: `${a} logged a risk: third-party circuit lead time flagged; mitigation in progress.` }),
  (a) => ({ subject: 'Risk closed', text: `${a} closed a previously raised risk following supplier confirmation.` }),
  (a) => ({ subject: 'Change request', text: `Small scope change agreed with the customer and baselined by ${a}.` }),
  (a) => ({ subject: 'Workstream update', text: `${a}: configuration complete, moving into testing.` }),
]

async function projectsWithMarker(c) {
  return c.getAll(`msdyn_projects?$select=msdyn_projectid,msdyn_subject,msdyn_scheduledstart,msdyn_actualstart,msdyn_finish&$filter=${enc(`contains(msdyn_description,'${MARKER}')`)}`)
}
async function existingNotes(c, projectId) {
  return c.getAll(`annotations?$select=annotationid&$filter=${enc(`_objectid_value eq ${projectId} and objecttypecode eq 'msdyn_project' and contains(notetext,'${MARKER}')`)}`)
}

async function clean(c) {
  let n = 0
  for (const p of await projectsWithMarker(c)) {
    for (const a of await existingNotes(c, p.msdyn_projectid)) { await c.del('annotations', a.annotationid); n++ }
  }
  console.log(`✓ removed ${n} demo project notes`)
}

function buildEntries(p) {
  const startStr = p.msdyn_actualstart || p.msdyn_scheduledstart
  if (!startStr) return []
  const s = new Date(startStr).getTime()
  if (Number.isNaN(s)) return []
  const now = Date.now()
  const e = p.msdyn_finish ? new Date(p.msdyn_finish).getTime() : now
  const last = Math.min(now, e)
  if (last <= s) return []
  const rng = mulberry32(hashStr(p.msdyn_projectid))
  const span = e - s
  const entries = []

  // Milestone-reached notes (past only).
  STAGES.forEach((stage, i) => {
    const t = s + (span * i) / (STAGES.length - 1)
    if (t <= now) entries.push({ date: t, subject: `Milestone: ${stage}`, text: `Milestone reached — ${stage}. Signed off by ${AUTHORS[0]}.` })
  })

  // Periodic updates every ~1–2 weeks up to today/finish.
  let t = s + 5 * DAY
  let i = 0
  while (t <= last && i < 30) {
    const author = AUTHORS[Math.floor(rng() * AUTHORS.length)]
    const u = UPDATES[Math.floor(rng() * UPDATES.length)](author)
    entries.push({ date: t, subject: u.subject, text: u.text })
    t += (8 + Math.floor(rng() * 7)) * DAY
    i++
  }
  return entries
}

async function seed(c) {
  const projects = await projectsWithMarker(c)
  let total = 0
  for (const p of projects) {
    if ((await existingNotes(c, p.msdyn_projectid)).length) { console.log(`• ${p.msdyn_subject} — notes exist, skipping`); continue }
    const entries = buildEntries(p)
    for (const en of entries) {
      await c.create('annotations', {
        subject: en.subject,
        notetext: `${en.text} ${MARKER}`,
        overriddencreatedon: new Date(en.date).toISOString(),
        'objectid_msdyn_project@odata.bind': `/msdyn_projects(${p.msdyn_projectid})`,
      })
      total++
    }
    console.log(`✓ ${p.msdyn_subject} — ${entries.length} notes`)
  }
  console.log(`\nDone. ${total} project notes across ${projects.length} projects.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  if (CLEAN) await clean(c)
  else await seed(c)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
