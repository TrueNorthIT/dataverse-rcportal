// @ts-nocheck
/**
 * Top every demo account up to TARGET_CONTACTS colleagues, so the directory and
 * team-tier lists are full. Idempotent — only creates the shortfall. All fake
 * (.example emails, Ofcom 07700 900xxx mobiles), tagged [DEMO-RCPORTAL].
 *
 *   node scripts/seed-contacts-topup.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const TARGET_CONTACTS = 30
// Per-account overrides (by slug). Chevin is bumped so its list clearly
// unfolds under infinite scroll during the demo.
const TARGET_OVERRIDE = { chevinprint: 80 }
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
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error}`)
  return j.access_token
}

const ACCOUNTS = [
  { name: 'Aire Valley Logistics Ltd', slug: 'airevalleylogistics', city: 'Leeds', county: 'West Yorkshire', tel: '01632 960121' },
  { name: 'Wharfedale Textiles Ltd', slug: 'wharfedaletextiles', city: 'Ilkley', county: 'West Yorkshire', tel: '01632 960245' },
  { name: 'Ebor Manufacturing Group', slug: 'ebormanufacturing', city: 'York', county: 'North Yorkshire', tel: '01632 960388' },
  { name: 'Ridings Mutual Building Society', slug: 'ridingsmutual', city: 'Wakefield', county: 'West Yorkshire', tel: '01632 960502' },
  { name: 'Calder & Ryburn Care Group', slug: 'calderryburncare', city: 'Halifax', county: 'West Yorkshire', tel: '01632 960674' },
  { name: 'Chevin Print & Packaging Ltd', slug: 'chevinprint', city: 'Otley', county: 'West Yorkshire', tel: '01632 960788' },
]
const FIRST = ['Arthur', 'Alfred', 'Harold', 'Stanley', 'Wilfred', 'Norman', 'Ernest', 'Clifford', 'Herbert', 'Walter', 'Edna', 'Doris', 'Betty', 'Nora', 'Marjorie', 'Hilda', 'Gladys', 'Mavis', 'Brenda', 'Pauline', 'Callum', 'Lewis', 'Kayleigh', 'Shannon', 'Liam', 'Chelsea', 'Bradley', 'Jordan', 'Megan', 'Connor', 'Amber', 'Reece', 'Paige', 'Kieran', 'Demi', 'Ryan', 'Leah', 'Scott', 'Hollie', 'Dylan']
const LAST = ['Sykes', 'Ackroyd', 'Firth', 'Broadbent', 'Greenwood', 'Haigh', 'Sutcliffe', 'Kaye', 'Hirst', 'Womersley', 'Beaumont', 'Ramsden', 'Oldroyd', 'Crabtree', 'Bottomley', 'Murgatroyd', 'Pickersgill', 'Metcalfe', 'Braithwaite', 'Whitaker', 'Illingworth', 'Pickles', 'Verity', 'Wadsworth', 'Dyson', 'Holroyd', 'Rhodes', 'Butterworth', 'Earnshaw', 'Sugden', 'Hepworth', 'Longbottom', 'Micklethwaite', 'Armitage', 'Feather', 'Hardcastle', 'Clough', 'Tetley', 'Threlfall', 'Rawnsley']
const JOBS = ['IT Director', 'Head of IT', 'Infrastructure Manager', 'Network Manager', 'IT Support Analyst', 'Chief Technology Officer', 'Operations Director', 'Finance Director', 'Procurement Manager', 'Service Desk Lead', 'Systems Administrator', 'Cyber Security Officer', 'Data Protection Officer', 'Digital Transformation Lead', 'Facilities Manager', 'Managing Director']
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const pad3 = (n) => String(n).padStart(3, '0')

async function main() {
  console.log(`Target: ${DV} — up to ${TARGET_CONTACTS} contacts/account`)
  const token = await getToken()
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  let mobileSeq = 500
  let total = 0
  for (const acc of ACCOUNTS) {
    const a = (await (await fetch(`${API}/accounts?$select=accountid&$filter=${enc(`name eq '${acc.name.replace(/'/g, "''")}'`)}`, { headers: H })).json()).value?.[0]
    if (!a) { console.log(`• ${acc.name} — no account`); continue }
    // count existing contacts + collect used emails
    const existing = (await (await fetch(`${API}/contacts?$select=emailaddress1&$filter=${enc(`_parentcustomerid_value eq ${a.accountid}`)}&$top=200`, { headers: H })).json()).value || []
    const used = new Set(existing.map((c) => (c.emailaddress1 || '').toLowerCase()))
    const target = TARGET_OVERRIDE[acc.slug] ?? TARGET_CONTACTS
    let need = target - existing.length
    if (need <= 0) { console.log(`• ${acc.name} — already ${existing.length}`); continue }
    let made = 0
    for (let i = 0; made < need; i++) {
      const fn = pick(FIRST), ln = pick(LAST)
      let local = `${fn}.${ln}`.toLowerCase()
      let email = `${local}@${acc.slug}.example`
      if (used.has(email)) { email = `${local}${i}@${acc.slug}.example` }
      if (used.has(email)) continue
      used.add(email)
      const r = await fetch(`${API}/contacts`, {
        method: 'POST', headers: H, body: JSON.stringify({
          firstname: fn, lastname: ln, emailaddress1: email, jobtitle: pick(JOBS),
          telephone1: acc.tel, mobilephone: `07700 900${pad3(mobileSeq++)}`,
          address1_city: acc.city, address1_stateorprovince: acc.county, address1_country: 'United Kingdom',
          donotbulkemail: Math.random() < 0.3,
          description: `${MARKER} Fictional demo contact — not real data.`,
          'parentcustomerid_account@odata.bind': `/accounts(${a.accountid})`,
        }),
      })
      if (!r.ok) throw new Error(`POST contact → ${r.status} ${await r.text()}`)
      made++
    }
    total += made
    console.log(`✓ ${acc.name} — +${made} (now ${existing.length + made})`)
  }
  console.log(`\nDone. +${total} contacts.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
