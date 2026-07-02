// @ts-nocheck
/**
 * Description seeder — replaces the placeholder "[DEMO-RCPORTAL] Fictional
 * demo … not real data." filler with realistic, record-specific copy so the
 * portal tiles can show a genuine one-line summary.
 *
 * Copy is keyed to each record's real name/title (project subject, quote
 * service, case title) and interpolates the customer's company name. The
 * "[DEMO-RCPORTAL]" marker is kept at the END of every field so the existing
 * cleanup/idempotency filters (contains(description,'[DEMO-RCPORTAL]')) still
 * work; the UI strips it via cleanDescription().
 *
 *   node scripts/seed-descriptions.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
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
    async getAll(path) {
      const rows = []
      let url = `${API}/${path}`
      while (url) {
        const res = await fetch(url, { headers: base })
        if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${await res.text()}`)
        const json = await res.json()
        rows.push(...(json.value || []))
        url = json['@odata.nextLink'] || null
      }
      return rows
    },
    async patch(set, id, body) {
      const res = await fetch(`${API}/${set}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`PATCH ${set}(${id}) → ${res.status} ${await res.text()}`)
    },
  }
}

const enc = (s) => encodeURIComponent(s)
const tag = (text) => `${text} ${MARKER}`

// ── Copy, keyed to the real record names ────────────────────────────────────

/** Project scope blurbs, keyed on msdyn_subject. `co` = customer company. */
function projectDesc(subject, co) {
  const C = co || 'the customer'
  const map = {
    'Cloud Migration Programme': `Phased migration of ${C}'s on-premise workloads to Redcentric's UK cloud platform — sizing, migration waves, cutover runbooks and post-migration optimisation.`,
    'Network Refresh Rollout': `Replacement of end-of-life switching and routing across ${C}'s sites, with a resilient core, VLAN redesign and structured-cabling remediation.`,
    'Cyber Security Uplift': `Programme to strengthen ${C}'s security posture — MFA rollout, endpoint hardening, vulnerability remediation and onboarding to 24/7 monitoring.`,
    'Data Centre Migration': `Migration of ${C}'s server estate into Redcentric's Tier 3 UK data centres — discovery, dependency mapping, phased moves and DR validation.`,
    'Microsoft 365 Deployment': `Rollout of Microsoft 365 to ${C} — Exchange Online migration, Teams, SharePoint and OneDrive adoption, with conditional access and data-protection policies.`,
    'SD-WAN Rollout': `Deployment of managed SD-WAN across ${C}'s branch network for application-aware routing, resilient connectivity and centralised policy control.`,
    'Disaster Recovery Implementation': `Design and build of ${C}'s DR capability — replication to a secondary Redcentric site, documented runbooks and scheduled failover testing.`,
    'Managed Firewall Onboarding': `Onboarding ${C} to Redcentric's managed firewall service — rule-base migration, HA pair deployment and change-managed policy control.`,
    'Backup Modernisation': `Modernisation of ${C}'s backup estate to immutable, policy-based protection with off-site copies and regular recovery-assurance testing.`,
    'Unified Comms Deployment': `Deployment of a unified communications platform for ${C} — cloud voice, contact centre and Teams integration with number porting.`,
  }
  return map[subject] || `${subject} for ${C}, delivered and managed by Redcentric.`
}

/** Support-case detail, keyed on incident title. */
function caseDesc(title, co) {
  const C = co || 'the customer'
  const map = {
    'Email delivery delays': `Outbound email to external recipients at ${C} is delayed by 20–40 minutes, with intermittent bounce-backs. Suspected mail-flow/queue issue — please review connector health.`,
    'VPN connection dropping': `Remote users at ${C} are dropped from the VPN every few minutes, disrupting home working. Reconnecting works but drops again shortly after.`,
    'New starter account setup': `Please provision a new starter for ${C} — AD account, Microsoft 365 licence, mailbox and standard security groups. Start date confirmed for Monday.`,
    'Firewall rule change request': `${C} requests a firewall change to allow inbound access for a new line-of-business application. Source ranges, ports and destination host attached; change window flexible.`,
    'Backup job failing overnight': `${C}'s overnight backup has failed two nights running with a target/media error — no clean restore point since. Please investigate as a priority.`,
    'Slow network performance at branch': `Users at ${C}'s branch office report slow file access and poor video-call quality since Monday. The core site is unaffected — likely WAN/link contention.`,
    'Slow network at branch': `Users at ${C}'s branch office report slow file access and poor video-call quality since Monday. The core site is unaffected — likely WAN/link contention.`,
    'Locked out — password reset': `A user at ${C} is locked out after repeated failed sign-ins and needs an urgent password reset and account unlock to resume work.`,
    'Microsoft 365 licence request': `${C} requests three additional Microsoft 365 licences for new team members, plus reassignment of two unused licences. Please advise on cost.`,
    'Server disk space alert': `Monitoring has flagged ${C}'s application server at 92% disk usage. Please review, reclaim space and advise on a longer-term capacity plan.`,
    'Phishing email reported': `A member of staff at ${C} reported a suspicious email requesting credentials. No links believed clicked — please review and confirm containment.`,
  }
  return map[title] || `Support request from ${C} regarding "${title}". Please review and advise on next steps.`
}

/** Quote scope summary. Quote names are "Quote: <service>". */
function quoteDesc(name, co) {
  const C = co || 'the customer'
  const service = (name || '').replace(/^Quote:\s*/i, '').trim()
  const map = {
    'Cloud hosting migration': `Proposal to migrate ${C}'s key workloads to Redcentric's UK cloud — sizing, migration effort and ongoing managed-hosting costs.`,
    'Managed network refresh': `Quotation to refresh ${C}'s LAN/WAN hardware and support — equipment, installation and a 3-year managed service.`,
    'Cyber security assessment': `Scope and pricing for a security assessment for ${C} — external/internal testing, gap analysis and a prioritised remediation roadmap.`,
    'Data centre colocation': `Colocation proposal for ${C} — rack space, power and cross-connects in Redcentric's UK data centres, with remote-hands options.`,
    'Backup & DR service': `Managed backup and disaster-recovery pricing for ${C} — retention tiers, off-site copies and scheduled recovery testing.`,
    'SD-WAN connectivity upgrade': `Proposal for an SD-WAN upgrade across ${C}'s sites — circuits, appliances and a managed service with application-aware routing.`,
    'Microsoft 365 rollout': `Quotation for ${C}'s Microsoft 365 licensing and rollout — migration, adoption support and a security baseline.`,
    'Unified communications deployment': `Pricing for a unified-comms deployment at ${C} — cloud voice, handsets, number porting and Teams integration.`,
    'Managed firewall service': `Managed firewall proposal for ${C} — HA appliances, rule management and 24/7 monitoring under a managed service.`,
    'Disaster Recovery as a Service': `DRaaS proposal for ${C} — replication, orchestration and scheduled failover testing to a secondary Redcentric site.`,
  }
  return map[service] || `Proposal covering ${service || 'the requested service'} for ${C} — scope, effort and pricing.`
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())

  // Company lookup (only ~6 accounts) → id → name.
  const accounts = await client.getAll('accounts?$select=accountid,name&$top=100')
  const coName = new Map(accounts.map((a) => [a.accountid, a.name]))

  const f = enc(`contains(msdyn_description,'${MARKER}')`)
  const projects = await client.getAll(
    `msdyn_projects?$select=msdyn_projectid,msdyn_subject,_msdyn_customer_value&$filter=${f}`,
  )
  for (const p of projects) {
    const desc = tag(projectDesc(p.msdyn_subject, coName.get(p._msdyn_customer_value)))
    await client.patch('msdyn_projects', p.msdyn_projectid, { msdyn_description: desc })
  }
  console.log(`✓ projects: ${projects.length}`)

  const df = enc(`contains(description,'${MARKER}')`)
  const quotes = await client.getAll(
    `quotes?$select=quoteid,name,_customerid_value&$filter=${df}`,
  )
  for (const q of quotes) {
    const desc = tag(quoteDesc(q.name, coName.get(q._customerid_value)))
    await client.patch('quotes', q.quoteid, { description: desc })
  }
  console.log(`✓ quotes: ${quotes.length}`)

  const cases = await client.getAll(
    `incidents?$select=incidentid,title,_customerid_value&$filter=${df}`,
  )
  for (const c of cases) {
    const desc = tag(caseDesc(c.title, coName.get(c._customerid_value)))
    await client.patch('incidents', c.incidentid, { description: desc })
  }
  console.log(`✓ cases: ${cases.length}`)

  console.log('\nDone.')
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
