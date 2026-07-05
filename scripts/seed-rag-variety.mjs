// @ts-nocheck
/**
 * Project RAG variety — guarantees every demo company has at least one project
 * in each in-flight RAG state (Due soon / Overdue / Complete), so the Projects
 * pills all light up whichever company the demo is switched to. (On track is
 * always plentiful.)
 *
 * Half the companies had zero of one or more states (their schedules all landed
 * far in the future). This re-dates the furthest-out on-track projects AND
 * rebuilds their plan tasks + diary notes to match, so opening the plan never
 * contradicts the RAG chip:
 *   • complete → whole schedule in the past, actual finish set, every phase and
 *     milestone done, full diary.
 *   • overdue  → scheduled finish in the recent past (deadline missed) but the
 *     plan now runs a little past today: earlier phases done, final phase in
 *     progress, go-live/handover milestones still pending, no actual finish.
 *   • due soon → scheduled finish 10–25 days out; in flight, last phase active,
 *     final milestones still ahead, no actual finish.
 *
 * Idempotent: a company already having both states is skipped untouched.
 * Deterministic per project id. Demo projects only ([DEMO-RCPORTAL] marker).
 *
 *   node scripts/seed-rag-variety.mjs
 *
 * NB: re-dating is not auto-reversible — to reset, re-run seed-projects
 * --reschedule + seed-detail-fields + seed-project-tasks/notes (--clean first).
 * Do NOT run seed-detail-fields AFTER this (it would set actualend on the
 * overdue project and flip it to complete).
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
const enc = encodeURIComponent
async function getToken() { const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }) }); const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`); return j.access_token }
function api(token) { const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-Version': '4.0' }; return {
  async getAll(p) { const out = []; let url = `${API}/${p}`; while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); const j = await r.json(); out.push(...(j.value || [])); url = j['@odata.nextLink'] || null } return out },
  async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
  async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
} }

const DAY = 86_400_000
const dateOnly = (ms) => new Date(ms).toISOString().slice(0, 10)
const isoT = (ms) => new Date(ms).toISOString()
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

const COMPANIES = ['Aire Valley Logistics Ltd', 'Wharfedale Textiles Ltd', 'Ebor Manufacturing Group', 'Ridings Mutual Building Society', 'Calder & Ryburn Care Group', 'Chevin Print & Packaging Ltd']
const PHASES = ['Discovery & design', 'Build & configure', 'Migration', 'Testing & UAT', 'Go-live & handover']
const MILESTONES = ['Kick-off', 'Discovery complete', 'Build complete', 'UAT sign-off', 'Go-live', 'Handover & close']
const AUTHORS = ['Priya Shah (Project Manager)', 'Tom Fletcher (Delivery Lead)', 'Rachel Owen (Lead Engineer)', 'Sam Doyle (Solution Architect)']
const UPDATES = [
  (a) => ({ subject: 'Weekly status', text: `Weekly update from ${a}: progressing to plan, no blockers this week.` }),
  (a) => ({ subject: 'Weekly status', text: `Weekly update from ${a}: minor slippage on one workstream; recovery plan agreed.` }),
  (a) => ({ subject: 'Steering call', text: `Fortnightly steering call held; ${a} walked the customer through progress.` }),
  (a) => ({ subject: 'Risk logged', text: `${a} logged a risk: third-party circuit lead time flagged; mitigation in progress.` }),
  (a) => ({ subject: 'Risk closed', text: `${a} closed a previously raised risk following supplier confirmation.` }),
  (a) => ({ subject: 'Change request', text: `Small scope change agreed with the customer and baselined by ${a}.` }),
  (a) => ({ subject: 'Workstream update', text: `${a}: configuration complete, moving into testing.` }),
]

const pctBetween = (ps, pe, now) => (pe <= now ? 100 : ps >= now ? 0 : Math.round(((now - ps) / (pe - ps)) * 100))

/** Plan rows spanning [spanStart, spanEnd]; pct/done derived from now. For an
 * overdue project spanEnd is in the future, so the last phase reads as in
 * progress and the final milestones stay pending. */
function buildTaskRows(spanStart, spanEnd, now) {
  const span = spanEnd - spanStart
  const rows = []
  PHASES.forEach((name, i) => {
    const ps = spanStart + (span * i) / PHASES.length
    const pe = spanStart + (span * (i + 1)) / PHASES.length
    rows.push({ new_name: name, new_startdate: dateOnly(ps), new_enddate: dateOnly(pe - DAY), new_ismilestone: false, new_percentcomplete: pctBetween(ps, pe, now), new_sequence: i + 1 })
  })
  MILESTONES.forEach((name, i) => {
    const t = spanStart + (span * i) / (MILESTONES.length - 1)
    rows.push({ new_name: name, new_startdate: dateOnly(t), new_enddate: dateOnly(t), new_ismilestone: true, new_percentcomplete: t <= now ? 100 : 0, new_sequence: 100 + i })
  })
  return rows
}

/** Diary entries across [spanStart, spanEnd]: milestone-reached notes for past
 * stages only, plus periodic updates up to today/finish. */
function buildNoteEntries(spanStart, spanEnd, now, projectId) {
  const rng = mulberry32(hashStr(projectId))
  const last = Math.min(now, spanEnd)
  const span = spanEnd - spanStart
  const entries = []
  MILESTONES.forEach((stage, i) => {
    const t = spanStart + (span * i) / (MILESTONES.length - 1)
    if (t <= now) entries.push({ date: t, subject: `Milestone: ${stage}`, text: `Milestone reached — ${stage}. Signed off by ${AUTHORS[0]}.` })
  })
  let t = spanStart + 5 * DAY
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

async function activeProjects(c, accountId) {
  return c.getAll(`msdyn_projects?$select=msdyn_projectid,msdyn_subject,msdyn_scheduledstart,msdyn_finish,msdyn_actualend&$filter=${enc(`_msdyn_customer_value eq ${accountId} and contains(msdyn_description,'${MARKER}') and statecode eq 0`)}&$orderby=msdyn_finish asc`)
}
async function delTasks(c, pid) { for (const t of await c.getAll(`new_projecttasks?$select=new_projecttaskid&$filter=${enc(`_new_projectid_value eq ${pid}`)}`)) await c.del('new_projecttasks', t.new_projecttaskid) }
async function delNotes(c, pid) { for (const a of await c.getAll(`annotations?$select=annotationid&$filter=${enc(`_objectid_value eq ${pid} and objecttypecode eq 'msdyn_project' and contains(notetext,'${MARKER}')`)}`)) await c.del('annotations', a.annotationid) }

async function convert(c, p, mode, now) {
  const rng = mulberry32(hashStr(p.msdyn_projectid))
  const duration = (80 + Math.floor(rng() * 60)) * DAY
  let finish, actualEnd, spanEnd
  if (mode === 'complete') {
    finish = now - (30 + Math.floor(rng() * 60)) * DAY          // 30–89 days ago
    actualEnd = finish + Math.floor((rng() - 0.3) * 12) * DAY   // delivered around finish
    spanEnd = finish                                            // whole plan in the past
  } else if (mode === 'duesoon') {
    finish = now + (10 + Math.floor(rng() * 16)) * DAY          // due in 10–25 days
    actualEnd = null
    spanEnd = finish                                            // in flight; plan runs to finish
  } else {
    finish = now - (8 + Math.floor(rng() * 22)) * DAY           // deadline missed 8–29 days ago
    actualEnd = null
    spanEnd = now + (10 + Math.floor(rng() * 12)) * DAY         // plan now runs late, into the future
  }
  const scheduledStart = finish - duration
  const actualStart = scheduledStart + Math.floor((rng() - 0.5) * 6) * DAY

  await c.patch('msdyn_projects', p.msdyn_projectid, {
    msdyn_scheduledstart: dateOnly(scheduledStart),
    msdyn_finish: dateOnly(finish),
    msdyn_actualstart: isoT(actualStart),
    msdyn_actualend: actualEnd == null ? null : isoT(actualEnd),
  })

  await delTasks(c, p.msdyn_projectid)
  await delNotes(c, p.msdyn_projectid)
  for (const r of buildTaskRows(scheduledStart, spanEnd, now)) {
    await c.create('new_projecttasks', { ...r, 'new_ProjectId@odata.bind': `/msdyn_projects(${p.msdyn_projectid})` })
  }
  for (const en of buildNoteEntries(scheduledStart, spanEnd, now, p.msdyn_projectid)) {
    await c.create('annotations', { subject: en.subject, notetext: `${en.text} ${MARKER}`, overriddencreatedon: isoT(en.date), 'objectid_msdyn_project@odata.bind': `/msdyn_projects(${p.msdyn_projectid})` })
  }
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  const now = Date.now()
  const in30 = now + 30 * DAY
  for (const name of COMPANIES) {
    const acc = (await c.getAll(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`))[0]
    if (!acc) { console.log(`• ${name} — no account`); continue }
    const projects = await activeProjects(c, acc.accountid)
    const fin = (p) => (p.msdyn_finish ? Date.parse(p.msdyn_finish) : null)
    const complete = projects.filter((p) => p.msdyn_actualend)
    const overdue = projects.filter((p) => !p.msdyn_actualend && fin(p) != null && fin(p) < now)
    const duesoon = projects.filter((p) => !p.msdyn_actualend && fin(p) != null && fin(p) >= now && fin(p) <= in30)
    const needC = complete.length === 0
    const needO = overdue.length === 0
    const needD = duesoon.length === 0
    if (!needC && !needO && !needD) { console.log(`• ${name} — has ${complete.length} complete / ${overdue.length} overdue / ${duesoon.length} due-soon, skipping`); continue }
    // victims: furthest-out on-track projects, so we never cannibalise an
    // existing due-soon / overdue / complete when creating a missing state.
    const farFutures = projects
      .filter((p) => !p.msdyn_actualend && fin(p) != null && fin(p) > in30)
      .sort((a, b) => fin(b) - fin(a))
    const jobs = []
    if (needC) jobs.push('complete')
    if (needO) jobs.push('overdue')
    if (needD) jobs.push('duesoon')
    let vi = 0
    for (const mode of jobs) {
      const victim = farFutures[vi++]
      if (!victim) { console.log(`  ! ${name} — not enough spare on-track projects for ${mode}`); continue }
      await convert(c, victim, mode, now)
      console.log(`  ✓ ${name} — "${victim.msdyn_subject}" → ${mode}`)
    }
  }
  console.log('\nDone.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
