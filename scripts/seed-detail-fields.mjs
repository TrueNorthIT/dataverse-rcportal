// @ts-nocheck
/**
 * Detail-field enricher — fills the columns the new per-area detail pages show
 * but the base seed left blank. Idempotent + deterministic (mulberry32 by id),
 * set-if-empty, demo records only ([DEMO-RCPORTAL] marker). Safe to re-run.
 *
 *   node scripts/seed-detail-fields.mjs
 *
 * Enriches:
 *   sites (customeraddress) — line2, county, phone, lat/long
 *   contacts               — department, address line1 + postcode
 *   projects (msdyn)       — actual start/end (from schedule vs today)
 *   quotes                 — effective from/until, discount, freight; link to a
 *                            same-account opportunity (also makes /me quotes work)
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
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async getAll(p) {
      const out = []; let url = `${API}/${p}`
      while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); const j = await r.json(); out.push(...(j.value || [])); url = j['@odata.nextLink'] || null }
      return out
    },
    async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

// ── deterministic RNG (stable per record id) ─────────────────────────────────
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function picker(id) { const r = mulberry32(hashStr(id)); return { r, pick: (a) => a[Math.floor(r() * a.length)], int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)), chance: (p) => r() < p } }
const isEmpty = (v) => v === null || v === undefined || v === ''
const dayMs = 86400000

// ── reference data ───────────────────────────────────────────────────────────
const COUNTY_BY_CITY = {
  Leeds: 'West Yorkshire', Bradford: 'West Yorkshire', Wakefield: 'West Yorkshire', Halifax: 'West Yorkshire',
  Huddersfield: 'West Yorkshire', Otley: 'West Yorkshire', Ilkley: 'West Yorkshire', Guiseley: 'West Yorkshire',
  Elland: 'West Yorkshire', 'Sowerby Bridge': 'West Yorkshire', York: 'North Yorkshire', Selby: 'North Yorkshire',
  Malton: 'North Yorkshire', Harrogate: 'North Yorkshire', Barnsley: 'South Yorkshire',
}
const AREA_BY_CITY = { Leeds: '0113', Bradford: '01274', York: '01904', Wakefield: '01924', Halifax: '01422', Harrogate: '01423', Barnsley: '01226' }
const DEPARTMENTS = ['IT', 'Finance', 'Operations', 'Sales & Marketing', 'HR', 'Facilities', 'Customer Service', 'Procurement', 'Service Delivery']
const STREETS = ['Wellington Street', 'Park Row', 'Albion Street', 'The Headrow', 'Commercial Street', 'King Street', 'Infirmary Street', 'East Parade', 'Boar Lane', 'Aire Street']

// ── enrichers ─────────────────────────────────────────────────────────────────
async function enrichSites(c) {
  const rows = await c.getAll(`customeraddresses?$select=customeraddressid,name,city,line2,stateorprovince,telephone1,latitude,longitude&$filter=${enc(`line3 eq '${MARKER}'`)}`)
  let n = 0
  for (const s of rows) {
    const P = picker(s.customeraddressid); const patch = {}
    const county = COUNTY_BY_CITY[s.city] || 'West Yorkshire'
    const area = AREA_BY_CITY[s.city] || '0113'
    if (isEmpty(s.stateorprovince)) patch.stateorprovince = county
    if (isEmpty(s.telephone1)) patch.telephone1 = `${area} ${P.int(200, 999)} ${P.int(1000, 9999)}`
    if (isEmpty(s.line2) && P.chance(0.5)) patch.line2 = P.pick(['Unit ' + P.int(1, 24), 'Suite ' + P.int(1, 12), P.int(1, 4) + 'th Floor', 'Building ' + P.pick(['A', 'B', 'C'])])
    if (isEmpty(s.latitude)) patch.latitude = +(53.8 + (P.r() - 0.5) * 0.6).toFixed(5)
    if (isEmpty(s.longitude)) patch.longitude = +(-1.55 + (P.r() - 0.5) * 0.8).toFixed(5)
    if (Object.keys(patch).length) { await c.patch('customeraddresses', s.customeraddressid, patch); n++ }
  }
  console.log(`✓ sites: enriched ${n}/${rows.length}`)
}

async function enrichContacts(c) {
  const rows = await c.getAll(`contacts?$select=contactid,department,address1_line1,address1_postalcode,address1_city&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  let n = 0
  for (const ct of rows) {
    const P = picker(ct.contactid); const patch = {}
    if (isEmpty(ct.department)) patch.department = P.pick(DEPARTMENTS)
    if (isEmpty(ct.address1_line1)) patch.address1_line1 = `${P.int(1, 180)} ${P.pick(STREETS)}`
    if (isEmpty(ct.address1_postalcode)) patch.address1_postalcode = `${P.pick(['LS', 'BD', 'WF', 'HX', 'YO', 'HG'])}${P.int(1, 20)} ${P.int(1, 9)}${P.pick(['AA', 'BQ', 'DL', 'RG', 'TX', 'AF'])}`
    if (Object.keys(patch).length) { await c.patch('contacts', ct.contactid, patch); n++ }
  }
  console.log(`✓ contacts: enriched ${n}/${rows.length}`)
}

async function enrichProjects(c) {
  const rows = await c.getAll(`msdyn_projects?$select=msdyn_projectid,msdyn_scheduledstart,msdyn_finish,msdyn_actualstart,msdyn_actualend&$filter=${enc(`contains(msdyn_description,'${MARKER}')`)}`)
  const now = Date.now(); let n = 0
  for (const p of rows) {
    const P = picker(p.msdyn_projectid); const patch = {}
    const start = p.msdyn_scheduledstart ? Date.parse(p.msdyn_scheduledstart) : null
    const finish = p.msdyn_finish ? Date.parse(p.msdyn_finish) : null
    // Started projects get an actual start near the scheduled start (±3 days).
    if (isEmpty(p.msdyn_actualstart) && start && start < now) {
      patch.msdyn_actualstart = new Date(start + (P.int(-3, 5)) * dayMs).toISOString()
    }
    // Finished projects get an actual end near the scheduled finish (±7 days).
    if (isEmpty(p.msdyn_actualend) && finish && finish < now) {
      patch.msdyn_actualend = new Date(finish + (P.int(-5, 10)) * dayMs).toISOString()
    }
    if (Object.keys(patch).length) { await c.patch('msdyn_projects', p.msdyn_projectid, patch); n++ }
  }
  console.log(`✓ projects: enriched ${n}/${rows.length}`)
}

async function enrichQuotes(c) {
  // Group demo opportunities by their customer account so each quote can link
  // to an opportunity for the same company.
  const opps = await c.getAll(`opportunities?$select=opportunityid,_customerid_value&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  const oppsByAcct = {}
  for (const o of opps) { const a = o._customerid_value; if (!a) continue; (oppsByAcct[a] ||= []).push(o.opportunityid) }

  const rows = await c.getAll(`quotes?$select=quoteid,createdon,totalamount,effectivefrom,effectiveto,discountamount,freightamount,_opportunityid_value,_customerid_value&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  let n = 0
  for (const q of rows) {
    const P = picker(q.quoteid); const patch = {}
    const created = q.createdon ? Date.parse(q.createdon) : Date.now()
    if (isEmpty(q.effectivefrom)) patch.effectivefrom = new Date(created + P.int(1, 7) * dayMs).toISOString()
    if (isEmpty(q.effectiveto)) patch.effectiveto = new Date(created + P.pick([30, 45, 60, 90]) * dayMs).toISOString()
    const total = Number(q.totalamount) || 0
    if (isEmpty(q.discountamount)) patch.discountamount = P.chance(0.4) ? Math.round(total * P.pick([0.05, 0.1, 0.15]) / 10) * 10 : 0
    if (isEmpty(q.freightamount)) patch.freightamount = P.chance(0.5) ? P.int(0, 50) * 10 : 0
    // Link to a same-account opportunity when unset (also enables /me quotes).
    if (isEmpty(q._opportunityid_value)) {
      const pool = oppsByAcct[q._customerid_value]
      if (pool && pool.length) patch['opportunityid@odata.bind'] = `/opportunities(${P.pick(pool)})`
    }
    if (Object.keys(patch).length) { await c.patch('quotes', q.quoteid, patch); n++ }
  }
  console.log(`✓ quotes: enriched ${n}/${rows.length} (${opps.length} opps available to link)`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())
  await enrichSites(c)
  await enrichContacts(c)
  await enrichProjects(c)
  await enrichQuotes(c)
  console.log('\nDone.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
