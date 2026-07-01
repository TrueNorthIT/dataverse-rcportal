// @ts-nocheck
/**
 * Sites seeder — customer locations/premises as `customeraddress` rows, linked
 * to each account via the native `parentid` (parentid_account nav).
 *
 * `site` (Field Service) is Microsoft-locked (no account link, can't add one),
 * so sites are modelled as customeraddress — the native "More Addresses" table
 * that already parents to account/contact. The Sites route:
 *   team = customeraddress → parentid_account → account
 *   me   = … → account → primarycontactid → contact
 *
 *   node scripts/seed-sites.mjs           # create (idempotent per account)
 *   node scripts/seed-sites.mjs --clean   # remove demo sites
 *
 * Demo sites are addressnumber >= 3 (Dataverse auto-creates 1 & 2 per account)
 * and tagged "[DEMO-RCPORTAL]" in line3 for safe cleanup.
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
const CLEAN = process.argv.includes('--clean')

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
const enc = (s) => encodeURIComponent(s)
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
    async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
  }
}

// Fictional customer locations per account (name, line1, city, postcode, primary?).
const SITES_BY_ACCOUNT = {
  'Aire Valley Logistics Ltd': [
    { name: 'Leeds Head Office', line1: 'Unit 7, Hunslet Distribution Park', city: 'Leeds', pc: 'LS10 1AB', primary: true },
    { name: 'Bradford Depot', line1: 'Canal Road Industrial Estate', city: 'Bradford', pc: 'BD1 4SJ' },
    { name: 'Wakefield Cross-Dock', line1: 'Denby Dale Road', city: 'Wakefield', pc: 'WF2 7AZ' },
  ],
  'Wharfedale Textiles Ltd': [
    { name: 'Ilkley Mill (HQ)', line1: 'Riverside Mill, Bridge Lane', city: 'Ilkley', pc: 'LS29 8QR', primary: true },
    { name: 'Otley Weaving Shed', line1: 'Gay Lane', city: 'Otley', pc: 'LS21 1AH' },
  ],
  'Ebor Manufacturing Group': [
    { name: 'York Head Office', line1: 'Clifton Moor Industrial Estate', city: 'York', pc: 'YO26 4TX', primary: true },
    { name: 'Selby Plant', line1: 'Bondgate', city: 'Selby', pc: 'YO8 3LX' },
    { name: 'Malton Fabrication', line1: 'Northgate', city: 'Malton', pc: 'YO17 7AB' },
  ],
  'Ridings Mutual Building Society': [
    { name: 'Wakefield Head Office', line1: '3 Bull Ring', city: 'Wakefield', pc: 'WF1 3RG', primary: true },
    { name: 'Leeds Branch', line1: '12 Commercial Street', city: 'Leeds', pc: 'LS1 6AL' },
    { name: 'Barnsley Branch', line1: 'Cheapside', city: 'Barnsley', pc: 'S70 1RZ' },
  ],
  'Calder & Ryburn Care Group': [
    { name: 'Halifax Head Office', line1: 'Ryburn House, Skircoat Road', city: 'Halifax', pc: 'HX1 2QT', primary: true },
    { name: 'Sowerby Bridge Care Home', line1: 'Wharf Street', city: 'Sowerby Bridge', pc: 'HX6 2AF' },
    { name: 'Elland Care Home', line1: 'Southgate', city: 'Elland', pc: 'HX5 0DQ' },
  ],
  'Chevin Print & Packaging Ltd': [
    { name: 'Otley Works (HQ)', line1: 'Wharfebank Works, Bridge Street', city: 'Otley', pc: 'LS21 1AB', primary: true },
    { name: 'Guiseley Print Room', line1: 'Otley Road', city: 'Guiseley', pc: 'LS20 8AH' },
  ],
}

async function accountByName(client, name) {
  const r = await client.get(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}

async function clean(client) {
  let n = 0
  for (const name of Object.keys(SITES_BY_ACCOUNT)) {
    const acc = await accountByName(client, name); if (!acc) continue
    const rows = (await client.get(`customeraddresses?$select=customeraddressid&$filter=${enc(`_parentid_value eq ${acc.accountid} and line3 eq '${MARKER}'`)}`)).value || []
    for (const r of rows) { await client.del('customeraddresses', r.customeraddressid); n++ }
  }
  console.log(`✓ removed ${n} demo sites`)
}

async function seed(client) {
  let total = 0
  for (const [name, sites] of Object.entries(SITES_BY_ACCOUNT)) {
    const acc = await accountByName(client, name)
    if (!acc) { console.log(`• ${name} — no account`); continue }
    const existing = (await client.get(`customeraddresses?$select=customeraddressid&$filter=${enc(`_parentid_value eq ${acc.accountid} and line3 eq '${MARKER}'`)}`)).value || []
    if (existing.length) { console.log(`• ${name} — ${existing.length} sites already, skipping`); continue }
    for (const s of sites) {
      await client.create('customeraddresses', {
        name: s.name, line1: s.line1, line3: MARKER, city: s.city, postalcode: s.pc,
        country: 'United Kingdom', addresstypecode: s.primary ? 3 : 4,
        'parentid_account@odata.bind': `/accounts(${acc.accountid})`,
      })
      total++
    }
    console.log(`✓ ${name} — ${sites.length} sites`)
  }
  console.log(`\nDone. ${total} sites.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  // remove any leftover sitetest row
  for (const r of (await client.get(`customeraddresses?$select=customeraddressid&$filter=${enc(`name eq '${MARKER} sitetest'`)}`)).value || []) {
    await client.del('customeraddresses', r.customeraddressid)
  }
  if (CLEAN) await clean(client)
  else await seed(client)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
