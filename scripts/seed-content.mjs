// @ts-nocheck
/**
 * Content variety seeder.
 *
 * Earlier seeders drew names/titles/subjects from tiny pools, so the portal
 * showed the same "Quote: Microsoft 365 rollout" / "VPN connection dropping"
 * over and over, with identical descriptions. This rewrites every demo quote,
 * case and project with a *per-record* name/title/subject and a distinct,
 * realistic description — composed from rich pools using a deterministic RNG
 * seeded by the record id, so results are varied but stable across re-runs.
 *
 * The "[DEMO-RCPORTAL]" cleanup marker is appended to each description (kept for
 * seed idempotency) and stripped for display by cleanDescription().
 *
 *   node scripts/seed-content.mjs
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
const TENANT = env.VITE_TENANT_ID, CLIENT_ID = env.VITE_CLIENT_ID, SECRET = env.CLIENT_SECRET
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
if (!TENANT || !CLIENT_ID || !SECRET || !DV) { console.error('Missing env'); process.exit(1) }

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  return {
    async getAll(path) {
      const rows = []; let url = `${API}/${path}`
      while (url) { const r = await fetch(url, { headers: base }); if (!r.ok) throw new Error(`GET ${url} → ${r.status} ${await r.text()}`); const j = await r.json(); rows.push(...(j.value || [])); url = j['@odata.nextLink'] || null }
      return rows
    },
    async patch(set, id, body) { const r = await fetch(`${API}/${set}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${set}(${id}) → ${r.status} ${await r.text()}`) },
  }
}
const enc = (s) => encodeURIComponent(s)
const tag = (t) => `${t} ${MARKER}`
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// ── Deterministic per-record RNG (stable across runs) ───────────────────────
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function picker(id) {
  const r = mulberry32(hashStr(id))
  return { pick: (a) => a[Math.floor(r() * a.length)], int: (a, b) => a + Math.floor(r() * (b - a + 1)), chance: (p) => r() < p }
}

const SITES = ['Leeds HQ', 'the Otley site', 'the Bradford data centre', 'the Harrogate office', 'the Wakefield branch', 'the Halifax depot', 'the Skipton office', 'head office']
const TEAMS = ['the finance team', 'the warehouse team', 'the sales floor', 'the design studio', 'reception', 'senior management', 'the service desk', 'the night shift']

// ── Cases ───────────────────────────────────────────────────────────────────
const CASE_KINDS = [
  {
    titles: ['VPN connection dropping', 'Slow network performance', 'Wi-Fi blackspots', 'Site-to-site tunnel down', 'Intermittent packet loss'],
    ctx: ['for remote workers', 'at {SITE}', 'on the guest network', 'affecting {TEAM}'],
    symptom: ['Users are being disconnected every few minutes', 'Network throughput has dropped noticeably since this morning', 'Connections keep timing out', 'Latency has spiked and calls are breaking up'],
    detail: ['A reboot of the local router helps briefly before it recurs.', 'No configuration changes were made on our side.', 'It started after the weekend.', 'Wired connections seem less affected than wireless.'],
  },
  {
    titles: ['Email delivery delays', 'Emails going to junk', 'Mailbox near quota', 'Distribution list change', 'Shared mailbox access'],
    ctx: ['for {TEAM}', 'to external recipients', 'on a shared mailbox', 'affecting one user'],
    symptom: ['Outbound email is delayed by 20–40 minutes', 'Legitimate email is landing in junk', 'A mailbox has reached its storage limit', 'Access to a shared mailbox has stopped working'],
    detail: ['Internal email seems unaffected.', 'This began after the last mail-flow change.', 'The user can send but not receive.', 'No non-delivery report is being returned.'],
  },
  {
    titles: ['Phishing email reported', 'Suspicious login alert', 'MFA re-enrolment needed', 'Account lockout', 'Password reset request'],
    ctx: ['from {TEAM}', 'for a senior user', 'flagged by monitoring', 'after a lost device'],
    symptom: ['A member of staff reported a suspicious email requesting credentials', 'An unusual sign-in was flagged from an unfamiliar location', 'A user needs MFA re-enrolled after changing phone', 'A user is locked out after repeated failed sign-ins'],
    detail: ['No links are believed to have been clicked.', 'The account has been disabled as a precaution.', 'Identity was confirmed with the line manager.', 'Please confirm containment.'],
  },
  {
    titles: ['New starter onboarding', 'Leaver offboarding', 'Microsoft 365 licence request', 'Software install request', 'Access rights change'],
    ctx: ['for {TEAM}', 'starting Monday', 'for three new staff', 'ahead of a project'],
    symptom: ['Please provision accounts and access for a new starter', 'Please offboard a leaver and revoke all access', 'Additional Microsoft 365 licences are needed', 'Standard software needs installing on a new device'],
    detail: ['Start date is confirmed.', 'Manager sign-off is attached.', 'Please advise on the cost.', 'The kit is already on site.'],
  },
  {
    titles: ['Backup job failing overnight', 'Restore test request', 'Offsite copy behind schedule', 'Backup capacity planning'],
    ctx: ['on the file server', 'for the SQL estate', 'at {SITE}', 'for the finance share'],
    symptom: ['The overnight backup has failed two nights running', 'A test restore is needed to confirm recoverability', 'The offsite copy is lagging behind schedule', 'Backup storage is filling up'],
    detail: ['There is no clean restore point since Tuesday.', 'This is for an audit requirement.', 'Bandwidth to the DR site looks saturated.', 'Please advise on a longer-term plan.'],
  },
  {
    titles: ['Server disk space alert', 'Slow application performance', 'SQL database blocking', 'Certificate expiry warning'],
    ctx: ['on the app server', 'at {SITE}', 'for the line-of-business app', 'on the web front-end'],
    symptom: ['Monitoring flagged the server at 92% disk usage', 'The application has become sluggish for all users', 'Users are hitting timeouts and blocking in the database', 'A TLS certificate is due to expire shortly'],
    detail: ['Please reclaim space and advise on capacity.', 'It worsens during the afternoon peak.', 'A long-running query may be to blame.', 'Renewal needs scheduling before expiry.'],
  },
  {
    titles: ['Printer offline', 'Teams call quality', 'Phone line fault', 'Headset provisioning'],
    ctx: ['at reception', 'for {TEAM}', 'on the main number', 'for home workers'],
    symptom: ['A shared printer is offline and not accepting jobs', 'Teams calls are dropping and the audio is choppy', 'An inbound phone line has a persistent fault', 'New headsets need configuring'],
    detail: ['Power-cycling has not helped.', 'The Wi-Fi signal is strong where affected.', 'The carrier has been notified.', 'Please ship to the home addresses on file.'],
  },
]
function caseContent(P, co) {
  const k = P.pick(CASE_KINDS)
  const site = P.pick(SITES), team = P.pick(TEAMS)
  const fill = (s) => s.replace('{SITE}', site).replace('{TEAM}', team)
  const title = `${P.pick(k.titles)}${P.chance(0.72) ? ' ' + fill(P.pick(k.ctx)) : ''}`
  const impact = P.pick([`Around ${P.int(2, 40)} users are affected`, `${cap(team)} are unable to work normally`, 'Business impact is moderate but growing', 'A key deadline is at risk', 'It is disrupting day-to-day operations'])
  const action = P.pick(['Please investigate and advise on a fix.', 'Requesting a resolution today if possible.', 'Please confirm the root cause and an ETA.', 'Please prioritise — the impact is increasing.', 'Grateful for an update when you can.'])
  const desc = `${fill(P.pick(k.symptom))} at ${co}. ${impact}. ${fill(P.pick(k.detail))} ${action}`
  return { title, desc }
}

// ── Quotes ──────────────────────────────────────────────────────────────────
const QSERVICE = [
  { name: 'Cloud hosting migration', q: 'infra', scope: "migrate key workloads to Redcentric's UK cloud platform" },
  { name: 'Managed firewall service', q: 'sec', scope: 'a managed firewall service with rule management and monitoring' },
  { name: 'Microsoft 365 rollout', q: 'seat', scope: 'a Microsoft 365 licensing and rollout programme' },
  { name: 'SD-WAN connectivity', q: 'site', scope: 'an SD-WAN upgrade with application-aware routing' },
  { name: 'Backup & DR service', q: 'infra', scope: 'managed backup and disaster recovery' },
  { name: 'Cyber security assessment', q: 'sec', scope: 'a security assessment and remediation roadmap' },
  { name: 'Disaster Recovery (DRaaS)', q: 'infra', scope: 'DR-as-a-Service with orchestrated failover' },
  { name: 'Data centre colocation', q: 'infra', scope: 'colocation with power, space and cross-connects' },
  { name: 'Unified communications', q: 'seat', scope: 'a unified communications and cloud voice platform' },
  { name: 'Managed network refresh', q: 'site', scope: 'a LAN/WAN hardware refresh and support' },
  { name: 'Endpoint protection', q: 'seat', scope: 'managed endpoint detection and response' },
  { name: 'Email security & filtering', q: 'seat', scope: 'email security, filtering and continuity' },
  { name: 'Penetration test', q: 'sec', scope: 'a CREST-aligned penetration test' },
  { name: '24/7 SOC monitoring', q: 'sec', scope: '24/7 SOC monitoring and threat response' },
  { name: 'Leased line upgrade', q: 'site', scope: 'a leased-line bandwidth upgrade' },
  { name: 'Microsoft 365 E5 upgrade', q: 'seat', scope: 'an upgrade to Microsoft 365 E5 with security add-ons' },
]
function quoteContent(P, co) {
  const s = P.pick(QSERVICE)
  let qual
  if (s.q === 'seat') qual = `${P.pick([50, 80, 120, 150, 180, 220, 250, 320, 400])} seats`
  else if (s.q === 'site') qual = `${P.int(2, 9)} sites`
  else if (s.q === 'sec') qual = P.pick(['HA pair', '24/7 SOC', 'annual retainer', 'group-wide', 'ISO 27001 aligned'])
  else qual = P.pick(['Phase 1', 'Phase 2', 'prod + DR', 'pilot', '3-year term', '5-year term', 'group-wide'])
  const title = `${s.name} — ${qual}`
  const intro = P.pick(['Proposal to deliver', 'Quotation for', 'Costed proposal for', 'Statement of work covering'])
  const commercial = P.pick(['a 3-year managed term', 'a 5-year term with annual reviews', 'onboarding and migration', '24/7 support and a quarterly service review', 'fixed monthly billing'])
  const desc = `${intro} ${s.scope} for ${co}, covering ${qual.toLowerCase()} with ${commercial}.`
  return { title, desc }
}

// ── Projects ──────────────────────────────────────────────────────────────
const PROJ = [
  { name: 'Cloud Migration Programme', scope: "migration of on-premise workloads to Redcentric's UK cloud with phased cutovers" },
  { name: 'Network Refresh Rollout', scope: 'replacement of end-of-life switching and routing with a resilient core' },
  { name: 'Cyber Security Uplift', scope: 'a security-hardening programme — MFA, endpoint hardening and monitoring onboarding' },
  { name: 'Data Centre Migration', scope: "migration of the server estate into Redcentric's Tier 3 data centres" },
  { name: 'Microsoft 365 Deployment', scope: 'an Exchange Online migration with Teams and SharePoint adoption' },
  { name: 'SD-WAN Rollout', scope: 'a managed SD-WAN deployment across the branch network' },
  { name: 'Disaster Recovery Implementation', scope: 'a DR capability with replication and scheduled failover testing' },
  { name: 'Managed Firewall Onboarding', scope: 'onboarding to the managed firewall service with HA appliances' },
  { name: 'Backup Modernisation', scope: 'a move to immutable, policy-based backup with off-site copies' },
  { name: 'Unified Comms Deployment', scope: 'a cloud voice and contact-centre deployment with number porting' },
]
function projectContent(P, co) {
  const base = P.pick(PROJ)
  const qual = P.pick(['Phase 1', 'Phase 2', 'Wave 1', 'Wave 2', '2026 programme', 'group-wide', 'Leeds & Bradford', 'multi-site'])
  const subject = `${base.name} — ${qual}`
  const detail = P.pick(['Delivery is managed end-to-end by Redcentric.', 'Covers discovery, build, migration and handover.', 'Runs alongside business-as-usual with minimal disruption.', 'Milestones are tracked against an agreed plan.'])
  const desc = `${cap(base.scope)} for ${co}. ${detail}`
  return { subject, desc }
}

// ── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  const accounts = await client.getAll('accounts?$select=accountid,name&$top=100')
  const coName = new Map(accounts.map((a) => [a.accountid, a.name]))
  const nameOf = (id) => coName.get(id) || 'the customer'

  const projects = await client.getAll(`msdyn_projects?$select=msdyn_projectid,_msdyn_customer_value&$filter=${enc(`contains(msdyn_description,'${MARKER}')`)}`)
  for (const p of projects) {
    const P = picker(p.msdyn_projectid)
    const { subject, desc } = projectContent(P, nameOf(p._msdyn_customer_value))
    await client.patch('msdyn_projects', p.msdyn_projectid, { msdyn_subject: subject, msdyn_description: tag(desc) })
  }
  console.log(`✓ projects: ${projects.length}`)

  const quotes = await client.getAll(`quotes?$select=quoteid,_customerid_value&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  for (const q of quotes) {
    const P = picker(q.quoteid)
    const { title, desc } = quoteContent(P, nameOf(q._customerid_value))
    await client.patch('quotes', q.quoteid, { name: title, description: tag(desc) })
  }
  console.log(`✓ quotes: ${quotes.length}`)

  const cases = await client.getAll(`incidents?$select=incidentid,_customerid_value&$filter=${enc(`contains(description,'${MARKER}')`)}`)
  for (const c of cases) {
    const P = picker(c.incidentid)
    const { title, desc } = caseContent(P, nameOf(c._customerid_value))
    await client.patch('incidents', c.incidentid, { title, description: tag(desc) })
  }
  console.log(`✓ cases: ${cases.length}`)

  console.log('\nDone.')
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
