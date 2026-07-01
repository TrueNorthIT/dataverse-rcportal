// @ts-nocheck
/**
 * Me-tier linkage — makes the demo login contacts OWN records so their
 * "My …" (me-tier) views aren't empty. For each login account:
 *   • set account.primarycontactid = the steve+<code> login contact
 *     (→ me account, me contact, and me projects via account→primarycontact)
 *   • ensure the login contact is parentcontactid on >= TARGET_OPPS opportunities
 *     (→ me opportunities, and me quotes via quote→opportunity→parentcontact)
 *   • ensure >= TARGET_QUOTES quotes on those opportunities
 *
 * Aire Valley is intentionally excluded — Martin Court is its primary contact.
 *
 *   node scripts/seed-me-tier.mjs           # all login accounts (minus av)
 *   node scripts/seed-me-tier.mjs cr         # just one (by code)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const GBP = '4677622c-e96d-f111-ab0d-000d3ad5aafe'
const TARGET_OPPS = 8
const TARGET_QUOTES = 6
const TARGET_CASES = 8
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
    async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

// Login contact per account. Aire Valley uses Martin Court (its primary
// contact); the rest use the steve+<code> aliases.
const ACCOUNTS = [
  { code: 'av', name: 'Aire Valley Logistics Ltd', email: 'martin.court@redcentricplc.com' },
  { code: 'wt', name: 'Wharfedale Textiles Ltd' },
  { code: 'em', name: 'Ebor Manufacturing Group' },
  { code: 'rm', name: 'Ridings Mutual Building Society' },
  { code: 'cr', name: 'Calder & Ryburn Care Group' },
  { code: 'cp', name: 'Chevin Print & Packaging Ltd' },
]
const SERVICES = ['Cloud hosting migration', 'Managed network refresh', 'Cyber security assessment', 'Backup & DR service', 'SD-WAN connectivity upgrade', 'Microsoft 365 rollout', 'Managed firewall service', 'Disaster Recovery as a Service']
const CASE_TITLES = ['Email delivery delays', 'VPN connection dropping', 'New starter account setup', 'Firewall rule change request', 'Backup job failing overnight', 'Slow network performance at branch', 'Locked out — password reset', 'Microsoft 365 licence request', 'Server disk space alert', 'Phishing email reported']
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const isoDate = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

async function priceListId(client) {
  const r = await client.get(`pricelevels?$select=pricelevelid&$filter=${enc(`contains(name,'${MARKER}')`)}`)
  return r.value?.[0]?.pricelevelid || null
}

async function run(client, acc, plId) {
  const af = enc(`name eq '${acc.name.replace(/'/g, "''")}'`)
  const account = (await client.get(`accounts?$select=accountid&$filter=${af}`)).value?.[0]
  if (!account) return console.log(`• ${acc.name} — no account`)
  const email = acc.email || `steve+${acc.code}@drakey.co.uk`
  const ef = enc(`emailaddress1 eq '${email}'`)
  const contact = (await client.get(`contacts?$select=contactid,fullname&$filter=${ef}`)).value?.[0]
  if (!contact) return console.log(`• ${email} — no contact`)

  // 1. primary contact
  await client.patch('accounts', account.accountid, { 'primarycontactid@odata.bind': `/contacts(${contact.contactid})` })

  // 2. ensure login contact owns >= TARGET_OPPS opps for this account
  const owned = (await client.get(`opportunities?$select=opportunityid&$filter=${enc(`_parentcontactid_value eq ${contact.contactid} and _customerid_value eq ${account.accountid}`)}`)).value || []
  let ownedIds = owned.map((o) => o.opportunityid)
  if (ownedIds.length < TARGET_OPPS) {
    // reassign existing account opps first
    const acctOpps = (await client.get(`opportunities?$select=opportunityid&$filter=${enc(`_customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)}&$top=20`)).value || []
    for (const o of acctOpps) {
      if (ownedIds.length >= TARGET_OPPS) break
      if (ownedIds.includes(o.opportunityid)) continue
      await client.patch('opportunities', o.opportunityid, { 'parentcontactid@odata.bind': `/contacts(${contact.contactid})` })
      ownedIds.push(o.opportunityid)
    }
    // create more if still short
    while (ownedIds.length < TARGET_OPPS) {
      const svc = SERVICES[randInt(0, SERVICES.length - 1)]
      const o = await client.create('opportunities', {
        name: `${svc} — ${acc.name}`, estimatedvalue: randInt(8, 140) * 1000, estimatedclosedate: isoDate(randInt(15, 160)),
        description: `${MARKER} Fictional demo opportunity — not real data.`,
        'customerid_account@odata.bind': `/accounts(${account.accountid})`,
        'parentcontactid@odata.bind': `/contacts(${contact.contactid})`,
        'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP})`,
      })
      ownedIds.push(o.opportunityid)
    }
  }

  // 3. ensure >= TARGET_QUOTES quotes on the owned opps
  let quoteCount = 0
  for (const oppId of ownedIds) {
    const qf = enc(`_opportunityid_value eq ${oppId}`)
    quoteCount += ((await client.get(`quotes?$select=quoteid&$filter=${qf}`)).value || []).length
  }
  let qi = 0
  while (quoteCount < TARGET_QUOTES) {
    const oppId = ownedIds[qi % ownedIds.length]; qi++
    await client.create('quotes', {
      name: `Quote: ${SERVICES[randInt(0, SERVICES.length - 1)]}`,
      description: `${MARKER} Fictional demo quote — not real data.`,
      'customerid_account@odata.bind': `/accounts(${account.accountid})`,
      'pricelevelid@odata.bind': `/pricelevels(${plId})`,
      'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP})`,
      'opportunityid@odata.bind': `/opportunities(${oppId})`,
    })
    quoteCount++
  }
  // 4. support cases (incident): customer = account (team), primary contact = login (me)
  const caseFilter = enc(`_primarycontactid_value eq ${contact.contactid} and _customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
  let caseCount = ((await client.get(`incidents?$select=incidentid&$filter=${caseFilter}`)).value || []).length
  const titles = [...CASE_TITLES].sort(() => Math.random() - 0.5)
  while (caseCount < TARGET_CASES) {
    await client.create('incidents', {
      title: titles[caseCount % titles.length],
      description: `${MARKER} Fictional demo support case — not real data.`,
      prioritycode: randInt(1, 3),
      'customerid_account@odata.bind': `/accounts(${account.accountid})`,
      'primarycontactid@odata.bind': `/contacts(${contact.contactid})`,
    })
    caseCount++
  }

  console.log(`✓ ${acc.name} — primary=${contact.fullname}, ${ownedIds.length} opps, ${quoteCount} quotes, ${caseCount} cases`)
}

async function main() {
  const only = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : null
  const client = api(await getToken())
  const plId = await priceListId(client)
  if (!plId) throw new Error('No demo price list found — run the main seeder first.')
  const targets = only ? ACCOUNTS.filter((a) => a.code === only) : ACCOUNTS
  for (const acc of targets) await run(client, acc, plId)
  console.log('\nMe-tier linkage done.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
