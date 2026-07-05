// @ts-nocheck
/**
 * Project delivery history — adds a back-catalogue of COMPLETED projects per
 * company so the dashboard's "Deliveries by month" trend is a rich, smooth
 * cumulative curve and the "Projects by health" donut has a healthy Complete
 * slice. Each has msdyn_actualend stepped one month further back (1..TARGET
 * months ago) so every monthly bucket is populated.
 *
 * These stay statecode=Active with actualend set — that's the portal's model of
 * "Complete" (the project route filters statecode eq 0, so they must remain
 * active to be shown). Real rows, visible in Dataverse.
 *
 *   node scripts/seed-project-history.mjs           # top up to TARGET_HIST per company
 *   node scripts/seed-project-history.mjs --clean   # remove the history projects
 *
 * IMPORTANT: identity is a bracket-FREE token ("HISTSEED") in msdyn_description.
 * Dataverse contains() compiles to SQL LIKE, where '[...]' is a character-class
 * wildcard — so a bracketed marker like '[HIST]' matches almost everything. We
 * therefore filter client-side on `.includes()` and tag with a plain token.
 * Run AFTER this: node scripts/seed-project-tasks.mjs && node scripts/seed-project-notes.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const TOKEN = 'HISTSEED'          // bracket-free — safe for identification
const LEGACY = '[HIST]'           // the mis-created bracketed marker to sweep up
const TARGET_HIST = 15
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
const dateOnly = (d) => new Date(d).toISOString().slice(0, 10)
const isoT = (d) => new Date(d).toISOString()

const COMPANIES = ['Aire Valley Logistics Ltd', 'Wharfedale Textiles Ltd', 'Ebor Manufacturing Group', 'Ridings Mutual Building Society', 'Calder & Ryburn Care Group', 'Chevin Print & Packaging Ltd']
const BASE_NAMES = ['Cloud Migration Programme', 'Network Refresh Rollout', 'Cyber Security Uplift', 'Data Centre Migration', 'Microsoft 365 Deployment', 'SD-WAN Rollout', 'Disaster Recovery Implementation', 'Managed Firewall Onboarding', 'Backup Modernisation', 'Unified Comms Deployment']
const SUFFIXES = ['2024 rollout', '2024 programme', 'legacy retire', 'first wave', 'early adopters', 'core network', 'pilot sites', 'foundation', 'branch phase', 'HQ refresh', 'south region', 'north region', 'stabilisation', 'consolidation', 'modernisation']

/** Completed-project schedule for the i-th history project: actual end stepped
 * ~1 month further back each time so the monthly delivery buckets fill evenly. */
function historyDates(i) {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() - (i + 1))         // 1..TARGET months ago
  end.setDate(4 + ((i * 7) % 22))                // spread day-of-month
  const actualEnd = end.getTime()
  const duration = (80 + (i * 13) % 70) * DAY     // 80–149 days
  const finish = actualEnd - (2 + (i * 5) % 12) * DAY  // scheduled finish just before delivery
  const scheduledStart = finish - duration
  const actualStart = scheduledStart + ((i % 6) - 2) * DAY
  return { scheduledStart, finish, actualStart, actualEnd }
}

async function accountByName(c, name) {
  return (await c.getAll(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`))[0] || null
}
async function accountProjects(c, accountId) {
  return c.getAll(`msdyn_projects?$select=msdyn_projectid,msdyn_description&$filter=${enc(`_msdyn_customer_value eq ${accountId} and statecode eq 0`)}`)
}
async function deleteProject(c, pid) {
  for (const t of await c.getAll(`new_projecttasks?$select=new_projecttaskid&$filter=${enc(`_new_projectid_value eq ${pid}`)}`)) await c.del('new_projecttasks', t.new_projecttaskid)
  for (const a of await c.getAll(`annotations?$select=annotationid&$filter=${enc(`_objectid_value eq ${pid} and objecttypecode eq 'msdyn_project'`)}`)) await c.del('annotations', a.annotationid)
  await c.del('msdyn_projects', pid)
}

async function seed(c) {
  let total = 0
  for (const name of COMPANIES) {
    const acc = await accountByName(c, name)
    if (!acc) { console.log(`• ${name} — no account`); continue }
    const projects = await accountProjects(c, acc.accountid)
    // Sweep up the earlier mis-created bracket-marked history projects (+ their
    // tasks/notes) so we start from a clean, evenly-spread set.
    const legacy = projects.filter((p) => (p.msdyn_description || '').includes(LEGACY) && !(p.msdyn_description || '').includes(TOKEN))
    for (const p of legacy) await deleteProject(c, p.msdyn_projectid)
    const have = projects.filter((p) => (p.msdyn_description || '').includes(TOKEN)).length
    if (have >= TARGET_HIST) { console.log(`• ${name} — ${have} history projects (removed ${legacy.length} legacy), skipping`); continue }
    let added = 0
    for (let i = have; i < TARGET_HIST; i++) {
      const d = historyDates(i)
      await c.create('msdyn_projects', {
        msdyn_subject: `${BASE_NAMES[i % BASE_NAMES.length]} — ${SUFFIXES[i % SUFFIXES.length]}`,
        msdyn_description: `${MARKER} ${TOKEN} Fictional completed demo project for ${name}.`,
        msdyn_scheduledstart: dateOnly(d.scheduledStart),
        msdyn_finish: dateOnly(d.finish),
        msdyn_actualstart: isoT(d.actualStart),
        msdyn_actualend: isoT(d.actualEnd),
        'msdyn_customer@odata.bind': `/accounts(${acc.accountid})`,
      })
      added++; total++
    }
    console.log(`✓ ${name} — +${added} completed history projects (removed ${legacy.length} legacy, now ${have + added})`)
  }
  console.log(`\nDone. ${total} history projects created.`)
  console.log('Next: node scripts/seed-project-tasks.mjs && node scripts/seed-project-notes.mjs')
}

async function clean(c) {
  let n = 0
  for (const name of COMPANIES) {
    const acc = await accountByName(c, name); if (!acc) continue
    const projects = await accountProjects(c, acc.accountid)
    for (const p of projects.filter((x) => (x.msdyn_description || '').includes(TOKEN) || (x.msdyn_description || '').includes(LEGACY))) { await deleteProject(c, p.msdyn_projectid); n++ }
  }
  console.log(`✓ removed ${n} history projects (+ their tasks/notes)`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  if (CLEAN) await clean(c)
  else await seed(c)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
