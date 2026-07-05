// @ts-nocheck
/**
 * Sites top-up — the base seed-sites.mjs gives each company only 2–3 sites, so
 * the Sites page looks thin and most connectivity pills are greyed out per
 * company. This adds a handful more real customeraddress rows per account, one
 * for each of the five connectivity types, fully enriched on create (county,
 * phone, lat/long, connectivity) so every connectivity pill has a member for
 * every company. Idempotent (skips a site if its name already exists for the
 * account); demo sites tagged "[DEMO-RCPORTAL]" in line3 for safe cleanup.
 *
 *   node scripts/seed-sites-topup.mjs           # add missing top-up sites
 *   node scripts/seed-sites-topup.mjs --clean   # remove just the top-up sites
 *
 * Connectivity values match create-plan-schema.mjs / seed-connectivity.mjs:
 *   FTTP=0, FTTC=1, Leased Line=2, Dark Fibre=3, EFM=4  → 100000000 + idx.
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
const enc = (s) => encodeURIComponent(s)
async function getToken() { const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }) }); const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`); return j.access_token }
function api(token) { const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }; return {
  async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
  async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
  async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
} }

// deterministic per-name RNG for phone / lat-long jitter
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

// conn index → choice value; each company gets one site of each type.
const CONN = { FTTP: 0, FTTC: 1, 'Leased Line': 2, 'Dark Fibre': 3, EFM: 4 }
const AREA_BY_CITY = {
  Leeds: '0113', Bradford: '01274', York: '01904', Wakefield: '01924', Halifax: '01422', Harrogate: '01423',
  Barnsley: '01226', Huddersfield: '01484', Skipton: '01756', Keighley: '01535', Otley: '01943', Ilkley: '01943',
}
const NY = 'North Yorkshire', WY = 'West Yorkshire'

// Five extra sites per company (name, line1, city, pc, county, conn).
const EXTRA = {
  'Aire Valley Logistics Ltd': [
    { name: 'Castleford Depot', line1: 'Whitwood Enterprise Park', city: 'Castleford', pc: 'WF10 5PX', county: WY, conn: 'FTTP' },
    { name: 'Morley Transport Hub', line1: 'Peel Street', city: 'Morley', pc: 'LS27 8QP', county: WY, conn: 'FTTC' },
    { name: 'Pontefract Warehouse', line1: 'Park Road', city: 'Pontefract', pc: 'WF8 4PW', county: WY, conn: 'Leased Line' },
    { name: 'Dewsbury Cross-Dock', line1: 'Mill Street East', city: 'Dewsbury', pc: 'WF12 9AH', county: WY, conn: 'Dark Fibre' },
    { name: 'Keighley Depot', line1: 'Dalton Lane', city: 'Keighley', pc: 'BD21 4JY', county: WY, conn: 'EFM' },
  ],
  'Wharfedale Textiles Ltd': [
    { name: 'Skipton Finishing Works', line1: 'Broughton Road', city: 'Skipton', pc: 'BD23 1RT', county: NY, conn: 'FTTP' },
    { name: 'Keighley Spinning Mill', line1: 'Aireworth Road', city: 'Keighley', pc: 'BD21 4DH', county: WY, conn: 'FTTC' },
    { name: 'Guiseley Warehouse', line1: 'Springfield Works', city: 'Guiseley', pc: 'LS20 9AB', county: WY, conn: 'Leased Line' },
    { name: 'Shipley Dye House', line1: 'Salts Mill Road', city: 'Shipley', pc: 'BD17 7EF', county: WY, conn: 'Dark Fibre' },
    { name: 'Bingley Store', line1: 'Myrtle Walk', city: 'Bingley', pc: 'BD16 2LF', county: WY, conn: 'EFM' },
  ],
  'Ebor Manufacturing Group': [
    { name: 'Harrogate Assembly', line1: 'Hookstone Park', city: 'Harrogate', pc: 'HG2 7DB', county: NY, conn: 'FTTP' },
    { name: 'Thirsk Components', line1: 'Sowerby Gateway', city: 'Thirsk', pc: 'YO7 3DA', county: NY, conn: 'FTTC' },
    { name: 'Tadcaster Plant', line1: 'Wetherby Road', city: 'Tadcaster', pc: 'LS24 9JH', county: NY, conn: 'Leased Line' },
    { name: 'Pocklington Fabrication', line1: 'The Balk', city: 'Pocklington', pc: 'YO42 2NX', county: NY, conn: 'Dark Fibre' },
    { name: 'Easingwold Store', line1: 'Stillington Road', city: 'Easingwold', pc: 'YO61 3FA', county: NY, conn: 'EFM' },
  ],
  'Ridings Mutual Building Society': [
    { name: 'Huddersfield Branch', line1: 'Cloth Hall Street', city: 'Huddersfield', pc: 'HD1 2EW', county: WY, conn: 'FTTP' },
    { name: 'Dewsbury Branch', line1: 'Northgate', city: 'Dewsbury', pc: 'WF13 1DS', county: WY, conn: 'FTTC' },
    { name: 'Pontefract Branch', line1: 'Beastfair', city: 'Pontefract', pc: 'WF8 1AL', county: WY, conn: 'Leased Line' },
    { name: 'Castleford Branch', line1: 'Carlton Street', city: 'Castleford', pc: 'WF10 1AP', county: WY, conn: 'Dark Fibre' },
    { name: 'Morley Branch', line1: 'Queen Street', city: 'Morley', pc: 'LS27 9DN', county: WY, conn: 'EFM' },
  ],
  'Calder & Ryburn Care Group': [
    { name: 'Brighouse Care Home', line1: 'Bradford Road', city: 'Brighouse', pc: 'HD6 4DH', county: WY, conn: 'FTTP' },
    { name: 'Todmorden Care Home', line1: 'Halifax Road', city: 'Todmorden', pc: 'OL14 5AA', county: WY, conn: 'FTTC' },
    { name: 'Hebden Bridge Lodge', line1: 'Market Street', city: 'Hebden Bridge', pc: 'HX7 6AA', county: WY, conn: 'Leased Line' },
    { name: 'Ripponden House', line1: 'Halifax Road', city: 'Ripponden', pc: 'HX6 4AJ', county: WY, conn: 'Dark Fibre' },
    { name: 'Mytholmroyd Home', line1: 'Burnley Road', city: 'Mytholmroyd', pc: 'HX7 5AF', county: WY, conn: 'EFM' },
  ],
  'Chevin Print & Packaging Ltd': [
    { name: 'Yeadon Print Room', line1: 'Harrogate Road', city: 'Yeadon', pc: 'LS19 7BN', county: WY, conn: 'FTTP' },
    { name: 'Menston Studio', line1: 'Main Street', city: 'Menston', pc: 'LS29 6HS', county: WY, conn: 'FTTC' },
    { name: 'Burley Works', line1: 'Main Street', city: 'Burley in Wharfedale', pc: 'LS29 7BT', county: WY, conn: 'Leased Line' },
    { name: 'Pool Bindery', line1: 'Arthington Lane', city: 'Pool in Wharfedale', pc: 'LS21 1LH', county: WY, conn: 'Dark Fibre' },
    { name: 'Bramhope Depot', line1: 'Old Lane', city: 'Bramhope', pc: 'LS16 9AY', county: WY, conn: 'EFM' },
  ],
}

async function accountByName(client, name) {
  const r = await client.get(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}
async function siteByName(client, accountId, name) {
  const r = await client.get(`customeraddresses?$select=customeraddressid&$filter=${enc(`_parentid_value eq ${accountId} and name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}

async function clean(client) {
  let n = 0
  for (const [name, sites] of Object.entries(EXTRA)) {
    const acc = await accountByName(client, name); if (!acc) continue
    for (const s of sites) {
      const ex = await siteByName(client, acc.accountid, s.name)
      if (ex) { await client.del('customeraddresses', ex.customeraddressid); n++ }
    }
  }
  console.log(`✓ removed ${n} top-up sites`)
}

async function seed(client) {
  let total = 0
  for (const [name, sites] of Object.entries(EXTRA)) {
    const acc = await accountByName(client, name)
    if (!acc) { console.log(`• ${name} — no account`); continue }
    let added = 0
    for (const s of sites) {
      if (await siteByName(client, acc.accountid, s.name)) continue // idempotent by name
      const P = mulberry32(hashStr(s.name))
      const area = AREA_BY_CITY[s.city] || '0113'
      await client.create('customeraddresses', {
        name: s.name, line1: s.line1, line3: MARKER, city: s.city, postalcode: s.pc,
        stateorprovince: s.county, country: 'United Kingdom', addresstypecode: 4,
        telephone1: `${area} ${200 + Math.floor(P() * 799)} ${1000 + Math.floor(P() * 8999)}`,
        latitude: +(53.8 + (P() - 0.5) * 0.7).toFixed(5),
        longitude: +(-1.7 + (P() - 0.5) * 0.9).toFixed(5),
        new_connectivitytype: 100000000 + CONN[s.conn],
        'parentid_account@odata.bind': `/accounts(${acc.accountid})`,
      })
      added++; total++
    }
    console.log(`✓ ${name} — +${added} sites (all 5 connectivity types now present)`)
  }
  console.log(`\nDone. ${total} top-up sites added.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  if (CLEAN) await clean(client)
  else await seed(client)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
