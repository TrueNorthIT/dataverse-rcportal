// @ts-nocheck
/**
 * Creates the custom schema that backs the portal's site connectivity + project
 * plan views with REAL Dataverse data (so "how does it look in DV?" always has
 * an answer). Idempotent; each piece created only if missing. Requires the SP
 * to have System Customizer / Administrator (same as create-feedback-table.mjs).
 *
 *   node scripts/create-plan-schema.mjs
 *
 * Adds:
 *   • new_connectivitytype — choice column on customeraddress
 *     (FTTP / FTTC / Leased Line / Dark Fibre / EFM)
 *   • new_projecttask — table of project plan items (phase bars + milestones):
 *     new_name (primary), new_startdate, new_enddate (date), new_ismilestone
 *     (yes/no), new_percentcomplete (0–100), new_sequence (int),
 *     new_ProjectId lookup → msdyn_project.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PREFIX = 'new'
const TASK = `${PREFIX}_projecttask`

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
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0', Consistency: 'Strong' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async post(p, body, extra = {}) { const r = await fetch(`${API}/${p}`, { method: 'POST', headers: { ...base, ...extra }, body: JSON.stringify(body) }); if (!r.ok) { const txt = await r.text(); const e = new Error(`POST ${p} → ${r.status} ${txt}`); e.status = r.status; throw e } return r },
  }
}

async function entityExists(c, logical) {
  const r = await c.get(`EntityDefinitions?$select=LogicalName,EntitySetName&$filter=LogicalName eq '${logical}'`)
  return r.value?.[0] || null
}
async function attrExists(c, entity, logical) {
  try { const r = await c.get(`EntityDefinitions(LogicalName='${entity}')/Attributes?$select=LogicalName&$filter=LogicalName eq '${logical}'`); return (r.value?.length ?? 0) > 0 } catch { return false }
}

// ── connectivity choice column on customeraddress ────────────────────────────
async function addConnectivity(c) {
  if (await attrExists(c, 'customeraddress', `${PREFIX}_connectivitytype`)) { console.log('• new_connectivitytype exists'); return }
  console.log('• adding new_connectivitytype (choice) to customeraddress …')
  const opts = ['FTTP', 'FTTC', 'Leased Line', 'Dark Fibre', 'EFM']
  await c.post(`EntityDefinitions(LogicalName='customeraddress')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    SchemaName: `${PREFIX}_ConnectivityType`,
    RequiredLevel: { Value: 'None' },
    DisplayName: label('Connectivity type'),
    Description: label('Primary connectivity/circuit type at this site.'),
    OptionSet: { '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist', Options: opts.map((o, i) => ({ Value: 100000000 + i, Label: label(o) })) },
  })
}

// ── project task table ───────────────────────────────────────────────────────
async function createTaskEntity(c) {
  console.log(`• creating entity ${TASK} …`)
  await c.post('EntityDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: `${PREFIX}_ProjectTask`,
    DisplayName: label('Project Task'),
    DisplayCollectionName: label('Project Tasks'),
    Description: label('Plan items (phases + milestones) for a delivery project.'),
    OwnershipType: 'UserOwned', HasActivities: false, HasNotes: false, IsActivity: false,
    Attributes: [{ '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', SchemaName: `${PREFIX}_Name`, RequiredLevel: { Value: 'ApplicationRequired' }, MaxLength: 300, FormatName: { Value: 'Text' }, DisplayName: label('Task'), IsPrimaryName: true }],
  })
  console.log('  ✓ entity created')
}
async function addDate(c, schema, display) {
  if (await attrExists(c, TASK, schema.toLowerCase())) return
  console.log(`• adding ${schema.toLowerCase()} (date) …`)
  await c.post(`EntityDefinitions(LogicalName='${TASK}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
    SchemaName: schema, RequiredLevel: { Value: 'None' }, Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' },
    DisplayName: label(display),
  })
}
async function addInt(c, schema, display, min, max) {
  if (await attrExists(c, TASK, schema.toLowerCase())) return
  console.log(`• adding ${schema.toLowerCase()} (int) …`)
  await c.post(`EntityDefinitions(LogicalName='${TASK}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    SchemaName: schema, RequiredLevel: { Value: 'None' }, Format: 'None', MinValue: min, MaxValue: max, DisplayName: label(display),
  })
}
async function addBool(c, schema, display) {
  if (await attrExists(c, TASK, schema.toLowerCase())) return
  console.log(`• adding ${schema.toLowerCase()} (yes/no) …`)
  await c.post(`EntityDefinitions(LogicalName='${TASK}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
    SchemaName: schema, RequiredLevel: { Value: 'None' }, DisplayName: label(display), DefaultValue: false,
    OptionSet: { '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata', TrueOption: { Value: 1, Label: label('Yes') }, FalseOption: { Value: 0, Label: label('No') } },
  })
}
async function addProjectLookup(c) {
  if (await attrExists(c, TASK, `${PREFIX}_projectid`)) { console.log('• new_projectid lookup exists'); return }
  console.log('• adding new_projectid lookup → msdyn_project …')
  await c.post('RelationshipDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: `${PREFIX}_msdyn_project_projecttask`,
    ReferencedEntity: 'msdyn_project', ReferencingEntity: TASK,
    CascadeConfiguration: { Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade', Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade' },
    Lookup: { '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata', SchemaName: `${PREFIX}_ProjectId`, DisplayName: label('Project'), RequiredLevel: { Value: 'None' } },
  })
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())

  try {
    await addConnectivity(c)
    if (!(await entityExists(c, TASK))) await createTaskEntity(c)
    else console.log(`• entity ${TASK} already exists`)
  } catch (e) {
    if (e.status === 403) { console.error('\n✗ 403 — the service principal lacks customization rights. Create the schema in Power Apps maker (prefix new_) and re-run.'); process.exit(1) }
    throw e
  }

  await addDate(c, `${PREFIX}_StartDate`, 'Start date')
  await addDate(c, `${PREFIX}_EndDate`, 'End date')
  await addBool(c, `${PREFIX}_IsMilestone`, 'Is milestone')
  await addInt(c, `${PREFIX}_PercentComplete`, 'Percent complete', 0, 100)
  await addInt(c, `${PREFIX}_Sequence`, 'Sequence', 0, 1000)
  await addProjectLookup(c)

  console.log('• publishing customizations …')
  await c.post('PublishAllXml', {})

  const ent = await entityExists(c, TASK)
  console.log(`\n✓ Done. projecttask entity set = "${ent?.EntitySetName}", pk = ${TASK}id`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
