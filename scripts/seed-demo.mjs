// @ts-nocheck
/**
 * Demo data seeder for the Contact Portal.
 *
 * Creates 5 fictional Yorkshire customer *accounts*, each with 5–25 *contacts*,
 * directly in Dataverse via the Web API using the service-principal creds in
 * `.env`. This is a provisioning script — it talks to Dataverse directly and is
 * NOT part of the SPA (the app only ever calls the Contact API).
 *
 *   npm run seed          # create the demo data (idempotent — skips existing accounts)
 *   npm run seed:clean    # delete everything this script created
 *
 * Everything is fake by construction:
 *   • Company/person names are invented Yorkshire-flavoured names.
 *   • Phone numbers use Ofcom's reserved drama ranges (01632 960xxx landline,
 *     07700 900xxx mobile) which can never connect to a real line.
 *   • Emails use the reserved `.example` TLD (RFC 2606) — non-routable.
 *   • Every record is tagged "[DEMO-RCPORTAL]" in its description so clean can
 *     find and remove exactly what we made, touching nothing else.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const here = dirname(fileURLToPath(import.meta.url))

// ─── tiny .env loader (no dependency) ───────────────────────────────────────
function loadEnv(path) {
  const out = {}
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return out
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

const env = loadEnv(join(here, '..', '.env'))
const TENANT = env.VITE_TENANT_ID
const CLIENT_ID = env.VITE_CLIENT_ID
const SECRET = env.CLIENT_SECRET
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const CLEAN = process.argv.includes('--clean')

if (!TENANT || !CLIENT_ID || !SECRET || !DV) {
  console.error('Missing VITE_TENANT_ID / VITE_CLIENT_ID / CLIENT_SECRET / VITE_DATAVERSE_URL in .env')
  process.exit(1)
}

// ─── auth ────────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: SECRET,
      scope: `${DV}/.default`,
    }),
  })
  const json = await res.json()
  if (!json.access_token) {
    throw new Error(`Token request failed: ${json.error} — ${json.error_description || ''}`)
  }
  return json.access_token
}

function api(token) {
  const base = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  }
  return {
    async get(path) {
      const res = await fetch(`${API}/${path}`, { headers: base })
      if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`)
      return res.json()
    },
    async create(entitySet, body) {
      const res = await fetch(`${API}/${entitySet}`, {
        method: 'POST',
        headers: { ...base, Prefer: 'return=representation' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`POST ${entitySet} → ${res.status} ${await res.text()}`)
      return res.json()
    },
    async del(entitySet, id) {
      const res = await fetch(`${API}/${entitySet}(${id})`, { method: 'DELETE', headers: base })
      if (!res.ok && res.status !== 404) throw new Error(`DELETE ${entitySet}(${id}) → ${res.status}`)
    },
  }
}

// ─── fictional Yorkshire dataset ─────────────────────────────────────────────
// Plausible RedCentric-style customers (managed IT / cloud / connectivity buyers),
// but entirely invented — not RedCentric and not any real company.
const ACCOUNTS = [
  { name: 'Aire Valley Logistics Ltd', code: 'av', slug: 'airevalleylogistics', line1: 'Unit 7, Hunslet Distribution Park', city: 'Leeds', county: 'West Yorkshire', postcode: 'LS10 1AB', tel: '01632 960121' },
  { name: 'Wharfedale Textiles Ltd', code: 'wt', slug: 'wharfedaletextiles', line1: 'Riverside Mill, Bridge Lane', city: 'Ilkley', county: 'West Yorkshire', postcode: 'LS29 8QR', tel: '01632 960245' },
  { name: 'Ebor Manufacturing Group', code: 'em', slug: 'ebormanufacturing', line1: 'Clifton Moor Industrial Estate', city: 'York', county: 'North Yorkshire', postcode: 'YO26 4TX', tel: '01632 960388' },
  { name: 'Ridings Mutual Building Society', code: 'rm', slug: 'ridingsmutual', line1: '3 Bull Ring', city: 'Wakefield', county: 'West Yorkshire', postcode: 'WF1 3RG', tel: '01632 960502' },
  { name: 'Calder & Ryburn Care Group', code: 'cr', slug: 'calderryburncare', line1: 'Ryburn House, Skircoat Road', city: 'Halifax', county: 'West Yorkshire', postcode: 'HX1 2QT', tel: '01632 960674' },
  { name: 'Chevin Print & Packaging Ltd', code: 'cp', slug: 'chevinprint', line1: 'Wharfebank Works, Bridge Street', city: 'Otley', county: 'West Yorkshire', postcode: 'LS21 1AB', tel: '01632 960788' },
]

// Demo login identities: the operator signs in as themselves via plus-aliases,
// one per company (steve+av@…, steve+wt@…). These are INTENTIONALLY real (the
// operator's own inbox) so the portal's me-tier matches the token email — the
// one deliberate exception to the no-real-data rule.
const LOGIN_BASE = 'steve@drakey.co.uk'
const loginEmail = (code) => LOGIN_BASE.replace('@', `+${code}@`)

// GBP transaction currency (only currency in this environment).
const GBP_CURRENCY_ID = '4677622c-e96d-f111-ab0d-000d3ad5aafe'
const PRICELIST_NAME = `${MARKER} Standard Price List (GBP)`
const CHEVIN_TARGET = 17 // top Chevin Print up to this many contacts

// RedCentric-style services — used as opportunity/quote subjects.
const SERVICES = [
  'Cloud hosting migration', 'Managed network refresh', 'Cyber security assessment',
  'Data centre colocation', 'Backup & DR service', 'SD-WAN connectivity upgrade',
  'Microsoft 365 rollout', 'Unified communications deployment', 'Managed firewall service',
  'Infrastructure as a Service platform', 'Secure internet breakout', 'Disaster Recovery as a Service',
]

const FIRST_NAMES = [
  'Arthur', 'Alfred', 'Harold', 'Stanley', 'Wilfred', 'Norman', 'Ernest', 'Clifford', 'Herbert', 'Walter',
  'Edna', 'Doris', 'Betty', 'Nora', 'Marjorie', 'Hilda', 'Gladys', 'Mavis', 'Brenda', 'Pauline',
  'Callum', 'Lewis', 'Kayleigh', 'Shannon', 'Liam', 'Chelsea', 'Bradley', 'Jordan', 'Megan', 'Connor',
  'Amber', 'Reece', 'Paige', 'Kieran', 'Demi', 'Ryan', 'Leah', 'Scott', 'Hollie', 'Dylan',
]
const LAST_NAMES = [
  'Sykes', 'Ackroyd', 'Firth', 'Broadbent', 'Greenwood', 'Haigh', 'Sutcliffe', 'Kaye', 'Hirst', 'Womersley',
  'Beaumont', 'Ramsden', 'Oldroyd', 'Crabtree', 'Bottomley', 'Murgatroyd', 'Pickersgill', 'Metcalfe', 'Braithwaite', 'Whitaker',
  'Illingworth', 'Pickles', 'Verity', 'Wadsworth', 'Dyson', 'Holroyd', 'Rhodes', 'Butterworth', 'Earnshaw', 'Sugden',
  'Hepworth', 'Longbottom', 'Micklethwaite', 'Armitage', 'Feather', 'Hardcastle', 'Clough', 'Tetley', 'Threlfall', 'Rawnsley',
]
const JOB_TITLES = [
  'IT Director', 'Head of IT', 'Infrastructure Manager', 'Network Manager', 'IT Support Analyst',
  'Chief Technology Officer', 'Operations Director', 'Finance Director', 'Procurement Manager',
  'Service Desk Lead', 'Systems Administrator', 'Cyber Security Officer', 'Data Protection Officer',
  'Digital Transformation Lead', 'Facilities Manager', 'Managing Director',
]

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pad3 = (n) => String(n).padStart(3, '0')

// ─── seed ─────────────────────────────────────────────────────────────────────
async function seed(client) {
  let mobileSeq = 100 // → 07700 900100, 900101, … (guaranteed-fake mobile range)
  let totalContacts = 0

  for (const acc of ACCOUNTS) {
    // Idempotency: skip if an account with this name already exists.
    // Encode the $filter value so names containing "&" (e.g. "Calder & Ryburn")
    // aren't mis-parsed as extra query-string parameters.
    const nameFilter = encodeURIComponent(`name eq '${acc.name.replace(/'/g, "''")}'`)
    const existing = await client.get(`accounts?$select=accountid&$filter=${nameFilter}`)
    if (existing.value?.length) {
      console.log(`• ${acc.name} — already exists, skipping`)
      continue
    }

    const account = await client.create('accounts', {
      name: acc.name,
      telephone1: acc.tel,
      websiteurl: `https://www.${acc.slug}.example`,
      address1_line1: acc.line1,
      address1_city: acc.city,
      address1_stateorprovince: acc.county,
      address1_postalcode: acc.postcode,
      address1_country: 'United Kingdom',
      description: `${MARKER} Fictional demo customer — not real data.`,
    })

    const n = randInt(5, 25)
    const usedEmails = new Set()
    let made = 0
    for (let i = 0; i < n; i++) {
      const firstname = pick(FIRST_NAMES)
      const lastname = pick(LAST_NAMES)
      let local = `${firstname}.${lastname}`.toLowerCase()
      if (usedEmails.has(local)) local = `${local}${i}`
      usedEmails.add(local)

      await client.create('contacts', {
        firstname,
        lastname,
        emailaddress1: `${local}@${acc.slug}.example`,
        jobtitle: pick(JOB_TITLES),
        telephone1: acc.tel,
        mobilephone: `07700 900${pad3(mobileSeq++)}`,
        address1_city: acc.city,
        address1_stateorprovince: acc.county,
        address1_country: 'United Kingdom',
        description: `${MARKER} Fictional demo contact — not real data.`,
        // Link this contact to its parent account (company).
        'parentcustomerid_account@odata.bind': `/accounts(${account.accountid})`,
      })
      made++
    }
    totalContacts += made
    console.log(`✓ ${acc.name} — created with ${made} contacts`)
  }
  console.log(`\nDone. ${ACCOUNTS.length} accounts, ${totalContacts} contacts.`)
}

// ─── related data (logins, top-up, opportunities, quotes) ───────────────────
const marker = (kind) => `${MARKER} Fictional demo ${kind} — not real data.`

/** Look up an account row by exact name (encoded filter for "&" safety). */
async function accountByName(client, name) {
  const f = encodeURIComponent(`name eq '${name.replace(/'/g, "''")}'`)
  const r = await client.get(`accounts?$select=accountid,name&$filter=${f}`)
  return r.value?.[0] || null
}

/** Contacts belonging to an account (excluding the login identity by default). */
async function accountContacts(client, accountId) {
  const f = encodeURIComponent(`_parentcustomerid_value eq ${accountId}`)
  const r = await client.get(`contacts?$select=contactid,fullname,emailaddress1&$filter=${f}&$top=100`)
  return r.value || []
}

/** One "Steve Drake" login contact per account, keyed by the plus-alias email. */
async function seedLogins(client) {
  for (const acc of ACCOUNTS) {
    const account = await accountByName(client, acc.name)
    if (!account) {
      console.log(`• ${acc.name} — no account, skipping login`)
      continue
    }
    const email = loginEmail(acc.code)
    const f = encodeURIComponent(`emailaddress1 eq '${email}'`)
    const existing = await client.get(`contacts?$select=contactid&$filter=${f}`)
    if (existing.value?.length) {
      console.log(`• ${email} — already exists`)
      continue
    }
    await client.create('contacts', {
      firstname: 'Steve',
      lastname: 'Drake',
      emailaddress1: email,
      jobtitle: 'IT Manager',
      telephone1: acc.tel,
      address1_city: acc.city,
      address1_stateorprovince: acc.county,
      address1_country: 'United Kingdom',
      description: `${MARKER} Demo login identity (operator's own alias).`,
      'parentcustomerid_account@odata.bind': `/accounts(${account.accountid})`,
    })
    console.log(`✓ ${acc.name} — login contact ${email}`)
  }
}

/** Top Chevin Print up to CHEVIN_TARGET contacts. */
async function topUpChevin(client) {
  const acc = ACCOUNTS.find((a) => a.code === 'cp')
  const account = await accountByName(client, acc.name)
  if (!account) return console.log('• Chevin not found, skipping top-up')
  const current = await accountContacts(client, account.accountid)
  const need = CHEVIN_TARGET - current.length
  if (need <= 0) return console.log(`• Chevin already has ${current.length} contacts`)
  const used = new Set(current.map((c) => (c.emailaddress1 || '').toLowerCase()))
  let made = 0
  for (let i = 0; made < need; i++) {
    const firstname = pick(FIRST_NAMES)
    const lastname = pick(LAST_NAMES)
    let local = `${firstname}.${lastname}`.toLowerCase()
    const email = `${local}@${acc.slug}.example`
    if (used.has(email)) continue
    used.add(email)
    await client.create('contacts', {
      firstname, lastname, emailaddress1: email,
      jobtitle: pick(JOB_TITLES), telephone1: acc.tel,
      mobilephone: `07700 900${pad3(400 + i)}`,
      address1_city: acc.city, address1_stateorprovince: acc.county, address1_country: 'United Kingdom',
      description: marker('contact'),
      'parentcustomerid_account@odata.bind': `/accounts(${account.accountid})`,
    })
    made++
  }
  console.log(`✓ Chevin Print — added ${made} contacts (now ${current.length + made})`)
}

/** Get-or-create the demo GBP price list; returns its id. */
async function ensurePriceList(client) {
  const f = encodeURIComponent(`name eq '${PRICELIST_NAME.replace(/'/g, "''")}'`)
  const existing = await client.get(`pricelevels?$select=pricelevelid&$filter=${f}`)
  if (existing.value?.length) return existing.value[0].pricelevelid
  const pl = await client.create('pricelevels', {
    name: PRICELIST_NAME,
    description: marker('price list'),
    'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP_CURRENCY_ID})`,
  })
  console.log(`✓ created price list ${PRICELIST_NAME}`)
  return pl.pricelevelid
}

const isoDate = (daysFromNow) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

/** 2–5 opportunities per account, linked to the account + one of its contacts. */
async function seedOpportunities(client) {
  for (const acc of ACCOUNTS) {
    const account = await accountByName(client, acc.name)
    if (!account) continue
    const f = encodeURIComponent(`_customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
    const existing = await client.get(`opportunities?$select=opportunityid&$filter=${f}`)
    if (existing.value?.length) {
      console.log(`• ${acc.name} — ${existing.value.length} opportunities already, skipping`)
      continue
    }
    const contacts = (await accountContacts(client, account.accountid)).filter(
      (c) => !(c.emailaddress1 || '').startsWith('steve+'),
    )
    const n = randInt(2, 5)
    const shuffled = [...SERVICES].sort(() => Math.random() - 0.5)
    let made = 0
    for (let i = 0; i < n; i++) {
      const service = shuffled[i % shuffled.length]
      const contact = contacts.length ? pick(contacts) : null
      const body = {
        name: `${service} — ${acc.name}`,
        estimatedvalue: randInt(5, 120) * 1000,
        estimatedclosedate: isoDate(randInt(20, 180)),
        description: marker('opportunity'),
        'customerid_account@odata.bind': `/accounts(${account.accountid})`,
        'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP_CURRENCY_ID})`,
      }
      if (contact) body['parentcontactid@odata.bind'] = `/contacts(${contact.contactid})`
      await client.create('opportunities', body)
      made++
    }
    console.log(`✓ ${acc.name} — ${made} opportunities`)
  }
}

/** 1–3 quotes per account, linked to the account (+ its opportunity when present). */
async function seedQuotes(client, priceListId) {
  for (const acc of ACCOUNTS) {
    const account = await accountByName(client, acc.name)
    if (!account) continue
    const f = encodeURIComponent(`_customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
    const existing = await client.get(`quotes?$select=quoteid&$filter=${f}`)
    if (existing.value?.length) {
      console.log(`• ${acc.name} — ${existing.value.length} quotes already, skipping`)
      continue
    }
    const of = encodeURIComponent(`_customerid_value eq ${account.accountid} and contains(description,'${MARKER}')`)
    const opps = (await client.get(`opportunities?$select=opportunityid,name&$filter=${of}&$top=50`)).value || []
    const n = randInt(1, 3)
    let made = 0
    for (let i = 0; i < n; i++) {
      const opp = opps[i % Math.max(opps.length, 1)]
      const subject = opp ? opp.name.split(' — ')[0] : pick(SERVICES)
      const body = {
        name: `Quote: ${subject}`,
        description: marker('quote'),
        'customerid_account@odata.bind': `/accounts(${account.accountid})`,
        'pricelevelid@odata.bind': `/pricelevels(${priceListId})`,
        'transactioncurrencyid@odata.bind': `/transactioncurrencies(${GBP_CURRENCY_ID})`,
      }
      if (opp) body['opportunityid@odata.bind'] = `/opportunities(${opp.opportunityid})`
      await client.create('quotes', body)
      made++
    }
    console.log(`✓ ${acc.name} — ${made} quotes`)
  }
}

async function seedRelated(client) {
  console.log('— Login contacts —')
  await seedLogins(client)
  console.log('\n— Chevin top-up —')
  await topUpChevin(client)
  console.log('\n— Opportunities —')
  await seedOpportunities(client)
  console.log('\n— Quotes —')
  const priceListId = await ensurePriceList(client)
  await seedQuotes(client, priceListId)
  console.log('\nRelated data done.')
}

// ─── clean ──────────────────────────────────────────────────────────────────
async function clean(client) {
  // Delete children before parents: quotes/opps reference accounts; contacts too.
  const sets = [
    ['quotes', 'quoteid'],
    ['opportunities', 'opportunityid'],
    ['pricelevels', 'pricelevelid'],
    ['contacts', 'contactid'],
    ['accounts', 'accountid'],
  ]
  for (const [set, idField] of sets) {
    const descFilter = encodeURIComponent(`contains(description,'${MARKER}')`)
    const found = await client.get(`${set}?$select=${idField}&$filter=${descFilter}`)
    const rows = found.value || []
    for (const row of rows) await client.del(set, row[idField])
    console.log(`✓ removed ${rows.length} ${set}`)
  }
  console.log('\nClean complete.')
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Target: ${DV}`)
  const token = await getToken()
  const client = api(token)

  // Connectivity gate — the SP must be an Application User in this environment.
  try {
    const who = await client.get('WhoAmI')
    console.log(`Connected as UserId ${who.UserId}\n`)
  } catch (err) {
    console.error('\nCannot connect to Dataverse:', err.message)
    console.error(
      '\nIf you see 0x80072560 "user is not a member of the organization", the\n' +
        'service principal is not an Application User in this environment yet.\n' +
        'Add it in Power Platform Admin Center → Environments → (this env) →\n' +
        `Settings → Users + permissions → Application users → New app user →\n` +
        `App ID ${CLIENT_ID}, with a security role (e.g. System Administrator).`,
    )
    process.exit(1)
  }

  const cmd = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
  if (CLEAN) await clean(client)
  else if (cmd === 'related') await seedRelated(client)
  else await seed(client)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
