// @ts-nocheck
/**
 * Backfill site coordinates — geocode each demo site's postcode via postcodes.io
 * (free, no API key, UK) and write latitude/longitude onto the customeraddress,
 * so the portal's site map reads *real* Dataverse fields rather than geocoding
 * in the browser.
 *
 *   node scripts/backfill-site-geo.mjs           # fill sites missing lat/long
 *   node scripts/backfill-site-geo.mjs --force   # re-geocode every demo site
 *
 * Targets the same demo rows as seed-sites.mjs (line3 = [DEMO-RCPORTAL]).
 * Run seed-sites.mjs first so the rows exist.
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
const FORCE = process.argv.includes('--force')

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
    async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

/**
 * Geocode UK postcodes → { [POSTCODE]: { lat, lon } } via postcodes.io.
 * Bulk full-postcode lookup first (one request); any that don't resolve
 * (fictional/partial) fall back to the outward-code centroid, e.g.
 * "LS10 1AB" → "LS10" — close enough for a location map.
 */
async function geocode(postcodes) {
  const clean = [...new Set(postcodes.map((p) => p.trim().toUpperCase()).filter(Boolean))]
  const out = {}
  const r = await fetch('https://api.postcodes.io/postcodes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcodes: clean }),
  })
  const j = await r.json()
  const misses = []
  for (const row of j.result || []) {
    if (row.result) out[row.query.toUpperCase()] = { lat: row.result.latitude, lon: row.result.longitude }
    else misses.push(row.query)
  }
  for (const pc of misses) {
    const outcode = pc.split(' ')[0]
    try {
      const or = await (await fetch(`https://api.postcodes.io/outcodes/${enc(outcode)}`)).json()
      if (or.result) out[pc.toUpperCase()] = { lat: or.result.latitude, lon: or.result.longitude }
      else console.log(`  ! no geocode for ${pc}`)
    } catch { console.log(`  ! outcode lookup failed for ${pc}`) }
  }
  return out
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  const rows = (await client.get(
    `customeraddresses?$select=customeraddressid,name,postalcode,latitude,longitude&$filter=${enc(`line3 eq '${MARKER}'`)}`,
  )).value || []
  const todo = rows.filter((r) => r.postalcode && (FORCE || r.latitude == null || r.longitude == null))
  if (!todo.length) { console.log('Nothing to backfill — all demo sites already have coordinates.'); return }

  const geo = await geocode(todo.map((r) => r.postalcode))
  let n = 0
  for (const r of todo) {
    const g = geo[r.postalcode.trim().toUpperCase()]
    if (!g) { console.log(`• ${r.name} (${r.postalcode}) — skipped, no coordinates`); continue }
    await client.patch('customeraddresses', r.customeraddressid, { latitude: g.lat, longitude: g.lon })
    console.log(`✓ ${r.name} — ${g.lat.toFixed(4)}, ${g.lon.toFixed(4)}`)
    n++
  }
  console.log(`\nDone. ${n} site(s) geocoded.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
