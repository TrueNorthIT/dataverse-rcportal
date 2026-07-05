// @ts-nocheck
/**
 * Seeds real new_projecttask rows (delivery plan = phase bars + milestones) for
 * each demo project, so the portal's Gantt maps to Dataverse. Dates/percent are
 * computed from each project's real schedule. Idempotent (skips projects that
 * already have tasks), demo projects only (msdyn_description marker).
 *
 *   node scripts/seed-project-tasks.mjs           # create
 *   node scripts/seed-project-tasks.mjs --clean   # delete demo tasks
 *
 * (Project for the Web blocks msdyn_projecttask writes, so plan items live in
 * the custom new_projecttask table — real rows, visible in DV.)
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
  async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
  async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
} }

const DAY = 86_400_000
const dateOnly = (ms) => new Date(ms).toISOString().slice(0, 10)
const PHASES = ['Discovery & design', 'Build & configure', 'Migration', 'Testing & UAT', 'Go-live & handover']
const MILESTONES = ['Kick-off', 'Discovery complete', 'Build complete', 'UAT sign-off', 'Go-live', 'Handover & close']
const pctBetween = (start, end, now) => (end <= now ? 100 : start >= now ? 0 : Math.round(((now - start) / (end - start)) * 100))

async function projects(c) {
  return c.getAll(`msdyn_projects?$select=msdyn_projectid,msdyn_subject,msdyn_scheduledstart,msdyn_actualstart,msdyn_finish&$filter=${enc(`contains(msdyn_description,'${MARKER}')`)}`)
}
async function existingTasks(c, projectId) {
  return c.getAll(`new_projecttasks?$select=new_projecttaskid&$filter=${enc(`_new_projectid_value eq ${projectId}`)}`)
}

async function clean(c) {
  let n = 0
  for (const p of await projects(c)) { for (const t of await existingTasks(c, p.msdyn_projectid)) { await c.del('new_projecttasks', t.new_projecttaskid); n++ } }
  console.log(`✓ removed ${n} demo project tasks`)
}

function buildRows(p) {
  const startStr = p.msdyn_actualstart || p.msdyn_scheduledstart
  if (!startStr || !p.msdyn_finish) return []
  const s = new Date(startStr).getTime()
  const e = new Date(p.msdyn_finish).getTime()
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return []
  const now = Date.now()
  const span = e - s
  const rows = []
  // phase bars (sequential, equal split)
  PHASES.forEach((name, i) => {
    const ps = s + (span * i) / PHASES.length
    const pe = s + (span * (i + 1)) / PHASES.length
    rows.push({ new_name: name, new_startdate: dateOnly(ps), new_enddate: dateOnly(pe - DAY), new_ismilestone: false, new_percentcomplete: pctBetween(ps, pe, now), new_sequence: i + 1 })
  })
  // milestones (points)
  MILESTONES.forEach((name, i) => {
    const t = s + (span * i) / (MILESTONES.length - 1)
    rows.push({ new_name: name, new_startdate: dateOnly(t), new_enddate: dateOnly(t), new_ismilestone: true, new_percentcomplete: t <= now ? 100 : 0, new_sequence: 100 + i })
  })
  return rows
}

async function seed(c) {
  const ps = await projects(c)
  let total = 0
  for (const p of ps) {
    if ((await existingTasks(c, p.msdyn_projectid)).length) { console.log(`• ${p.msdyn_subject} — tasks exist, skipping`); continue }
    const rows = buildRows(p)
    for (const r of rows) { await c.create('new_projecttasks', { ...r, 'new_ProjectId@odata.bind': `/msdyn_projects(${p.msdyn_projectid})` }); total++ }
    if (rows.length) console.log(`✓ ${p.msdyn_subject} — ${rows.length} tasks`)
  }
  console.log(`\nDone. ${total} project tasks across ${ps.length} projects.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  if (CLEAN) await clean(c); else await seed(c)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
