// @ts-nocheck
/**
 * Adds the custom `new_portaldomains` column to the Dataverse `account` table
 * via the Web API metadata endpoint, using the service principal in .env.
 *
 * It holds the email domain(s) allowed to self-join a company (space/comma/
 * newline separated). A customer account lists its own domain; add
 * `truenorthit.co.uk` to every company so TrueNorth staff can join any of them.
 * The self-serve join (POST /me/register + GET /me/claimable-companies) matches
 * the caller's verified email domain against this field.
 *
 * Idempotent: the column is created only if missing. Requires the SP to have
 * System Customizer / Administrator; a 403 means create it in the Power Apps
 * maker portal instead (prefix new_, single line of text) and re-run.
 *
 *   node scripts/create-domain-column.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PREFIX = 'new'
const ENTITY = 'account'
const LOGICAL = `${PREFIX}_portaldomains`

function loadEnv(path) {
  const out = {}; let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
if (!DV) { console.error('Missing VITE_DATAVERSE_URL'); process.exit(1) }

const label = (text) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: 1033 }],
})

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'Consistency': 'Strong' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async post(p, body, extraHeaders = {}) {
      const r = await fetch(`${API}/${p}`, { method: 'POST', headers: { ...base, ...extraHeaders }, body: JSON.stringify(body) })
      if (!r.ok) { const txt = await r.text(); const e = new Error(`POST ${p} → ${r.status} ${txt}`); e.status = r.status; throw e }
      return r
    },
  }
}

async function attrExists(c, logical) {
  try {
    const r = await c.get(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes?$select=LogicalName&$filter=LogicalName eq '${logical}'`)
    return (r.value?.length ?? 0) > 0
  } catch { return false }
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())

  if (await attrExists(c, LOGICAL)) {
    console.log(`• ${LOGICAL} already exists on ${ENTITY} — nothing to do.`)
    return
  }

  console.log(`• adding ${LOGICAL} (single line of text) to ${ENTITY} …`)
  try {
    await c.post(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
      '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
      SchemaName: `${PREFIX}_PortalDomains`,
      RequiredLevel: { Value: 'None' },
      MaxLength: 850,
      FormatName: { Value: 'Text' },
      DisplayName: label('Portal domains'),
      Description: label('Email domains allowed to self-join this company via the portal (space/comma separated). Add truenorthit.co.uk to allow TrueNorth staff.'),
    })
  } catch (e) {
    if (e.status === 403) {
      console.error('\n✗ 403 Forbidden — the service principal lacks customization rights.')
      console.error('  Fallback: in Power Apps maker add a single-line text column "Portal domains"')
      console.error('  (schema new_PortalDomains) to the Account table, then re-run this script.')
      process.exit(1)
    }
    throw e
  }

  console.log('• publishing customizations …')
  await c.post('PublishAllXml', {})
  console.log(`\n✓ Done. Added ${LOGICAL} to ${ENTITY}.`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
