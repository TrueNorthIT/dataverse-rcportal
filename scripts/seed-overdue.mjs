// @ts-nocheck
/**
 * Makes a few demo projects genuinely OVERDUE (scheduled finish in the recent
 * past, not yet delivered) by clearing msdyn_actualend — so the Overdue RAG /
 * pill has real, correct members. Everything else stays "Delivered late"
 * (actualend set) and reads as Complete.
 *
 *   node scripts/seed-overdue.mjs           # mark ~4 recently-past projects overdue
 *   node scripts/seed-overdue.mjs --clean   # (no-op; re-run seed-detail-fields to restore actual ends)
 *
 * NB: run AFTER seed-detail-fields.mjs (which backfills actual ends).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const COUNT = 4
const here = dirname(fileURLToPath(import.meta.url))
function loadEnv(p) { const o = {}; let t; try { t = readFileSync(p, 'utf8') } catch { return o } for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; o[l.slice(0, i).trim()] = l.slice(i + 1).trim() } return o }
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const enc = encodeURIComponent
async function getToken() { const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }) }); const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`); return j.access_token }
function api(token) { const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-Version': '4.0' }; return {
  async getAll(p) { const out = []; let url = `${API}/${p}`; while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); const j = await r.json(); out.push(...(j.value || [])); url = j['@odata.nextLink'] || null } return out },
  async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
} }

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  const nowIso = new Date().toISOString()
  // Demo projects whose scheduled finish has passed but were "delivered" — pick
  // the most recently-past ones and mark them running-late (clear actual end).
  const rows = await c.getAll(
    `msdyn_projects?$select=msdyn_projectid,msdyn_subject,msdyn_finish,msdyn_actualend` +
    `&$filter=${enc(`contains(msdyn_description,'${MARKER}') and msdyn_finish lt ${nowIso} and msdyn_actualend ne null`)}` +
    `&$orderby=msdyn_finish desc`,
  )
  const pick = rows.slice(0, COUNT)
  for (const p of pick) {
    await c.patch('msdyn_projects', p.msdyn_projectid, { msdyn_actualend: null })
    console.log(`✓ overdue: ${p.msdyn_subject} (finish ${p.msdyn_finish?.slice(0, 10)})`)
  }
  console.log(`\nDone. ${pick.length} projects marked overdue.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
