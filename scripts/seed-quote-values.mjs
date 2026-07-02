// @ts-nocheck
/**
 * Give demo quotes realistic values + status variety.
 *
 * Quotes roll up `totalamount` from line items (quotedetail); with none they
 * show £0. For each demo quote this adds 1–3 write-in line items (varied
 * service prices) so the total is a real number, then sets a mix of statuses
 * (most Active = "sent to customer", some left Draft).
 *
 * Idempotent: skips quotes that already have line items; only activates Drafts.
 *   node scripts/seed-quote-values.mjs
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
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

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
    async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`) },
    async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

// Write-in service lines (description + unit price £).
const LINES = [
  { desc: 'Cloud hosting — annual', price: 18000 },
  { desc: 'Managed network — annual', price: 24000 },
  { desc: 'Cyber security assessment', price: 6500 },
  { desc: 'Backup & DR service — annual', price: 14000 },
  { desc: 'SD-WAN connectivity — multi-site', price: 32000 },
  { desc: 'Microsoft 365 licences', price: 21600 },
  { desc: 'Managed firewall — annual', price: 9800 },
  { desc: 'Onboarding & professional services', price: 7500 },
  { desc: 'Disaster Recovery as a Service', price: 15400 },
]

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  const quotes = (await client.get(
    `quotes?$select=quoteid,statecode&$filter=${enc(`contains(description,'${MARKER}')`)}&$top=500`,
  )).value || []
  console.log(`${quotes.length} demo quotes`)

  let valued = 0, activated = 0
  let idx = 0
  for (const q of quotes) {
    // 1. line items (skip if any already exist)
    const details = (await client.get(`quotedetails?$select=quotedetailid&$filter=${enc(`_quoteid_value eq ${q.quoteid}`)}&$top=5`)).value || []
    if (details.length === 0) {
      const picks = [...LINES].sort(() => Math.random() - 0.5).slice(0, randInt(1, 3))
      for (const line of picks) {
        await client.create('quotedetails', {
          'quoteid@odata.bind': `/quotes(${q.quoteid})`,
          isproductoverridden: true,
          productdescription: line.desc,
          priceperunit: line.price,
          quantity: randInt(1, 3),
        })
      }
      valued++
    }
    // 2. status variety — activate ~2/3, leave the rest Draft. Only from Draft.
    if (q.statecode === 0 && idx % 3 !== 2) {
      await client.patch('quotes', q.quoteid, { statecode: 1, statuscode: 2 })
      activated++
    }
    idx++
  }
  console.log(`\nDone. Added line items to ${valued} quotes; activated ${activated}.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
