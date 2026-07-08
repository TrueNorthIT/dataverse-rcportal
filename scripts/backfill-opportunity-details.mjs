// @ts-nocheck
/**
 * Enrich demo opportunities with realistic descriptions so the detail page's
 * Notes reads richly (the seeder only writes a bare placeholder).
 *
 *   node scripts/backfill-opportunity-details.mjs
 *
 * Idempotent: sets a service-specific description (derived from the opportunity
 * name, "<service> — <company>") on every demo opportunity, keeping the
 * [DEMO-RCPORTAL] marker so cleanup filters and `cleanDescription` still work.
 * Re-runnable — skips rows already carrying the target text.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = '[DEMO-RCPORTAL]'
// Bracket-free search token: Dataverse contains() treats [..] as LIKE wildcards,
// so searching the bracketed marker matches almost everything. The inner text
// is present in every demo description and matches precisely.
const SEARCH = 'DEMO-RCPORTAL'
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
    async patch(s, id, b) { const r = await fetch(`${API}/${s}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(b) }); if (!r.ok) throw new Error(`PATCH ${s}(${id}) → ${r.status} ${await r.text()}`) },
  }
}

// Service → rich description. Keys match the services the seeder names opps with
// ("<service> — <company>"). Multi-line (portal renders whitespace-pre-wrap).
const DESCRIPTIONS = {
  'Cloud hosting migration':
    'Migrate the on-prem server estate into Redcentric’s UK cloud, retiring ageing hardware and its maintenance overhead.\n\n' +
    '• Lift-and-shift of core line-of-business VMs, then right-size\n' +
    '• Private connectivity into the Redcentric cloud — no public exposure\n' +
    '• Managed patching, backup and 24/7 monitoring included',
  'Managed network refresh':
    'Refresh the ageing LAN/WAN across all sites and move day-to-day running onto Redcentric’s managed service.\n\n' +
    '• Replace end-of-life access and core switching\n' +
    '• Resilient dual-uplink core with automatic failover\n' +
    '• Proactive monitoring and a 3-year support wrap',
  'Cyber security assessment':
    'A full security-posture assessment of the current estate, with a prioritised, costed remediation roadmap.\n\n' +
    '• External and internal vulnerability scanning\n' +
    '• Firewall, identity and backup review\n' +
    '• Board-ready findings and next steps',
  'Backup & DR service':
    'Replace unreliable local backups with Redcentric’s managed backup and disaster-recovery service.\n\n' +
    '• Immutable, off-site backups with tested restores\n' +
    '• Defined RPO/RTO per system\n' +
    '• Annual DR invocation test included',
  'SD-WAN connectivity upgrade':
    'Upgrade site connectivity to a managed SD-WAN overlay for resilience and application-aware routing.\n\n' +
    '• Dual-carrier circuits with sub-second failover\n' +
    '• Prioritisation for voice and business apps\n' +
    '• Central policy management by Redcentric',
  'Microsoft 365 rollout':
    'Plan and deliver a full Microsoft 365 rollout — migrating mailboxes and files and hardening the tenant.\n\n' +
    '• Exchange and file-share migration with minimal downtime\n' +
    '• Conditional access and an MFA baseline\n' +
    '• End-user onboarding and adoption support',
  'Managed firewall service':
    'Deploy and manage next-generation firewalls across the estate under a single managed service.\n\n' +
    '• HA firewall pair per key site\n' +
    '• Managed rulebase, IPS and web filtering\n' +
    '• 24/7 change and incident handling',
  'Disaster Recovery as a Service':
    'Stand up Disaster Recovery as a Service so critical workloads can fail over to Redcentric’s cloud on demand.\n\n' +
    '• Continuous replication of priority VMs\n' +
    '• Push-button failover with tested runbooks\n' +
    '• Quarterly non-disruptive DR tests',
}
const GENERIC =
  'A managed-services proposal Redcentric is preparing for you, sized against the current estate.\n\n' +
  '• Discovery and scoping workshop\n' +
  '• Phased delivery to avoid downtime\n' +
  '• Ongoing managed support and monitoring'

/** Rich description for an opp, chosen by the service prefix in its name. */
function describe(name) {
  const svc = Object.keys(DESCRIPTIONS).find((s) => (name || '').startsWith(s))
  return `${MARKER} ${svc ? DESCRIPTIONS[svc] : GENERIC}`
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  const rows = (await client.get(
    `opportunities?$select=opportunityid,name,description&$filter=${enc(`contains(description,'${SEARCH}')`)}`,
  )).value || []
  let n = 0, skipped = 0
  for (const o of rows) {
    const target = describe(o.name)
    if (o.description === target) { skipped++; continue }
    await client.patch('opportunities', o.opportunityid, { description: target })
    console.log(`✓ ${o.name}`)
    n++
  }
  console.log(`\nDone. ${n} enriched, ${skipped} already up to date (of ${rows.length} demo opportunities).`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
