// @ts-nocheck
/**
 * Project seeder — loads msdyn_project (Project Operations) demo data and links
 * each project to a customer account via the custom lookup new_accountid
 * (relationship new_account_msdyn_project, nav property `new_AccountId`).
 *
 * msdyn_project has no native account/contact link, so we added new_accountid
 * (account 1:N msdyn_project). Team-tier scopes projects by account; me-tier
 * via account → primarycontactid → contact.
 *
 *   node scripts/seed-projects.mjs          # create (idempotent per account)
 *   node scripts/seed-projects.mjs --clean  # remove demo projects
 *
 * Marker "[DEMO-RCPORTAL]" lives in msdyn_description for safe cleanup.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
const TARGET_PROJECTS = 5
const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  const out = {}
  let text
  try { text = readFileSync(path, 'utf8') } catch { return out }
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

async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials', client_id: CLIENT_ID,
      client_secret: SECRET, scope: `${DV}/.default`,
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Token failed: ${json.error} — ${json.error_description || ''}`)
  return json.access_token
}

function api(token) {
  const base = {
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
    Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
  }
  return {
    async get(path) {
      const res = await fetch(`${API}/${path}`, { headers: base })
      if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`)
      return res.json()
    },
    async create(set, body) {
      const res = await fetch(`${API}/${set}`, {
        method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`POST ${set} → ${res.status} ${await res.text()}`)
      return res.json()
    },
    async del(set, id) {
      const res = await fetch(`${API}/${set}(${id})`, { method: 'DELETE', headers: base })
      if (!res.ok && res.status !== 404) throw new Error(`DELETE ${set}(${id}) → ${res.status}`)
    },
  }
}

const ACCOUNTS = [
  'Aire Valley Logistics Ltd', 'Wharfedale Textiles Ltd', 'Ebor Manufacturing Group',
  'Ridings Mutual Building Society', 'Calder & Ryburn Care Group', 'Chevin Print & Packaging Ltd',
]

const PROJECT_NAMES = [
  'Cloud Migration Programme', 'Network Refresh Rollout', 'Cyber Security Uplift',
  'Data Centre Migration', 'Microsoft 365 Deployment', 'SD-WAN Rollout',
  'Disaster Recovery Implementation', 'Managed Firewall Onboarding',
  'Backup Modernisation', 'Unified Comms Deployment',
]

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const enc = (s) => encodeURIComponent(s)

async function accountByName(client, name) {
  const r = await client.get(`accounts?$select=accountid&$filter=${enc(`name eq '${name.replace(/'/g, "''")}'`)}`)
  return r.value?.[0] || null
}

async function clean(client) {
  const found = await client.get(`msdyn_projects?$select=msdyn_projectid&$filter=${enc(`contains(msdyn_description,'${MARKER}')`)}`)
  const rows = found.value || []
  for (const p of rows) await client.del('msdyn_projects', p.msdyn_projectid)
  console.log(`✓ removed ${rows.length} demo projects`)
}

async function seed(client) {
  let total = 0
  for (const name of ACCOUNTS) {
    const acc = await accountByName(client, name)
    if (!acc) { console.log(`• ${name} — no account, skipping`); continue }
    // Idempotency: top up to TARGET_PROJECTS per account.
    const existing = await client.get(
      `msdyn_projects?$select=msdyn_projectid&$filter=${enc(`_new_accountid_value eq ${acc.accountid} and contains(msdyn_description,'${MARKER}')`)}`,
    )
    const have = existing.value?.length || 0
    const need = TARGET_PROJECTS - have
    if (need <= 0) { console.log(`• ${name} — already has ${have} projects`); continue }
    const names = [...PROJECT_NAMES].sort(() => Math.random() - 0.5).slice(0, need)
    for (const pn of names) {
      await client.create('msdyn_projects', {
        msdyn_subject: pn,
        msdyn_description: `${MARKER} Fictional demo project for ${name}.`,
        'new_AccountId@odata.bind': `/accounts(${acc.accountid})`,
      })
      total++
    }
    console.log(`✓ ${name} — +${need} projects (now ${have + need})`)
  }
  console.log(`\nDone. ${total} projects.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  // Remove any leftover probe/bindtest projects regardless of mode.
  for (const s of ['[DEMO-RCPORTAL] probe', '[DEMO-RCPORTAL] bindtest', '[DEMO-RCPORTAL] bindtest2']) {
    const r = await client.get(`msdyn_projects?$select=msdyn_projectid&$filter=${enc(`msdyn_subject eq '${s}'`)}`)
    for (const p of r.value || []) await client.del('msdyn_projects', p.msdyn_projectid)
  }
  if (CLEAN) await clean(client)
  else await seed(client)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
