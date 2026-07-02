// @ts-nocheck
/**
 * Multi-company demo data.
 *
 * Makes steve@drakey.co.uk and martin.court@redcentricplc.com each a contact
 * under the same set of companies (so both exercise the company switcher), and
 * gives each of their per-company contacts OWNED records so the "My" (me-tier)
 * views are populated when switched to that company:
 *   • opportunities  — parentcontactid = the contact
 *   • quotes         — on those opportunities
 *   • cases          — primarycontactid = the contact
 * "Company" (team-tier) data already exists per account from earlier seeders.
 *
 * Idempotent + non-destructive (does not touch existing primary contacts).
 *   node scripts/seed-multicompany-data.mjs
 *   node scripts/seed-multicompany-data.mjs --clean   # remove the admin contacts + their owned records
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const GBP = '4677622c-e96d-f111-ab0d-000d3ad5aafe'
const TARGET_OPPS = 5
const TARGET_QUOTES = 4
const TARGET_CASES = 5
const here = dirname(fileURLToPath(import.meta.url))

const ADMINS = [
  { email: 'steve@drakey.co.uk', first: 'Steve', last: 'Drake', title: 'Group IT Manager' },
  { email: 'martin.court@redcentricplc.com', first: 'Martin', last: 'Court', title: 'IT Director' },
]
const COMPANIES = [
  'Aire Valley Logistics Ltd',
  'Ridings Mutual Building Society',
  'Calder & Ryburn Care Group',
  'Chevin Print & Packaging Ltd',
]
const SERVICES = ['Cloud hosting migration', 'Managed network refresh', 'Cyber security assessment', 'Backup & DR service', 'SD-WAN connectivity upgrade', 'Microsoft 365 rollout', 'Managed firewall service', 'Disaster Recovery as a Service']
const CASE_TITLES = ['Email delivery delays', 'VPN connection dropping', 'New starter account setup', 'Firewall rule change request', 'Backup job failing overnight', 'Slow network at branch', 'Locked out — password reset', 'Microsoft 365 licence request', 'Server disk space alert', 'Phishing email reported']

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
const enc = (s) => encodeURIComponent(s)
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const isoDate = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

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
    async create(s, b) { const r = await fetch(`${API}/${s}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`POST ${s} → ${r.status} ${await r.text()}`); return r.json() },
    async del(s, id) { const r = await fetch(`${API}/${s}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${s}(${id}) → ${r.status}`) },
  }
}

async function accountByName(client, name) {
  const r = await client.get(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}
async function priceListId(client) {
  const r = await client.get(`pricelevels?$select=pricelevelid&$filter=${enc(`contains(name,'${MARKER}')`)}`)
  return r.value?.[0]?.pricelevelid || null
}
async function ensureContact(client, admin, account) {
  const f = enc(`emailaddress1 eq '${admin.email}' and _parentcustomerid_value eq ${account.accountid}`)
  const existing = (await client.get(`contacts?$select=contactid&$filter=${f}`)).value || []
  if (existing.length) return existing[0].contactid
  const c = await client.create('contacts', {
    firstname: admin.first, lastname: admin.last, emailaddress1: admin.email, jobtitle: admin.title,
    description: `${MARKER} Multi-company demo identity.`,
    'parentcustomerid_account@odata.bind': `/accounts(${account.accountid})`,
  })
  return c.contactid
}

async function seed(client) {
  const plId = await priceListId(client)
  if (!plId) throw new Error('No demo price list — run the base seeder first.')
  for (const name of COMPANIES) {
    const account = await accountByName(client, name)
    if (!account) { console.log(`• ${name} — no account`); continue }
    for (const admin of ADMINS) {
      const contactId = await ensureContact(client, admin, account)
      // opportunities owned by this contact
      const oppF = enc(`_parentcontactid_value eq ${contactId} and _customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
      let opps = ((await client.get(`opportunities?$select=opportunityid&$filter=${oppF}`)).value || []).map((o) => o.opportunityid)
      while (opps.length < TARGET_OPPS) {
        const o = await client.create('opportunities', {
          name: `${SERVICES[randInt(0, SERVICES.length - 1)]} — ${name}`,
          estimatedvalue: randInt(8, 140) * 1000, estimatedclosedate: isoDate(randInt(15, 160)),
          description: `${MARKER} Fictional demo opportunity — not real data.`,
          'customerid_account@odata.bind': `/accounts(${account.accountid})`,
          'parentcontactid@odata.bind': `/contacts(${contactId})`,
          'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP})`,
        })
        opps.push(o.opportunityid)
      }
      // quotes on those opps
      let quoteCount = 0
      for (const oid of opps) quoteCount += ((await client.get(`quotes?$select=quoteid&$filter=${enc(`_opportunityid_value eq ${oid}`)}`)).value || []).length
      let qi = 0
      while (quoteCount < TARGET_QUOTES) {
        await client.create('quotes', {
          name: `Quote: ${SERVICES[randInt(0, SERVICES.length - 1)]}`,
          description: `${MARKER} Fictional demo quote — not real data.`,
          'customerid_account@odata.bind': `/accounts(${account.accountid})`,
          'pricelevelid@odata.bind': `/pricelevels(${plId})`,
          'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP})`,
          'opportunityid@odata.bind': `/opportunities(${opps[qi % opps.length]})`,
        })
        qi++; quoteCount++
      }
      // cases owned (primary contact) by this contact
      const caseF = enc(`_primarycontactid_value eq ${contactId} and _customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
      let caseCount = ((await client.get(`incidents?$select=incidentid&$filter=${caseF}`)).value || []).length
      const titles = [...CASE_TITLES].sort(() => Math.random() - 0.5)
      while (caseCount < TARGET_CASES) {
        await client.create('incidents', {
          title: titles[caseCount % titles.length],
          description: `${MARKER} Fictional demo support case — not real data.`,
          prioritycode: randInt(1, 3),
          'customerid_account@odata.bind': `/accounts(${account.accountid})`,
          'primarycontactid@odata.bind': `/contacts(${contactId})`,
        })
        caseCount++
      }
      console.log(`✓ ${admin.email} @ ${name} — ${opps.length} opps, ${quoteCount} quotes, ${caseCount} cases`)
    }
  }
  console.log('\nDone.')
}

async function clean(client) {
  for (const admin of ADMINS) {
    const contacts = (await client.get(`contacts?$select=contactid&$filter=${enc(`emailaddress1 eq '${admin.email}'`)}`)).value || []
    for (const c of contacts) {
      // delete owned opps/quotes/cases first
      for (const [set, id, fld] of [['quotes', 'quoteid', null], ['opportunities', 'opportunityid', '_parentcontactid_value'], ['incidents', 'incidentid', '_primarycontactid_value']]) {
        if (!fld) continue
        const rows = (await client.get(`${set}?$select=${id}&$filter=${enc(`${fld} eq ${c.contactid}`)}`)).value || []
        for (const r of rows) await client.del(set, r[id])
      }
      await client.del('contacts', c.contactid)
    }
    console.log(`✓ removed ${contacts.length} ${admin.email} contacts + their records`)
  }
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  if (CLEAN) await clean(client)
  else await seed(client)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
