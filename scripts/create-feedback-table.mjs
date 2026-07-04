// @ts-nocheck
/**
 * Creates the custom `new_portalfeedback` Dataverse table (+ columns + lookups)
 * via the Web API metadata endpoints, using the service principal in .env.
 *
 * Idempotent: each piece is created only if missing. Requires the SP to have
 * System Customizer / Administrator. If it doesn't, the entity POST returns 403
 * — create the table in the Power Apps maker portal instead and re-run to add
 * any missing columns.
 *
 *   node scripts/create-feedback-table.mjs
 *
 * Columns: new_name (primary), new_message (memo), new_rating (int 1–5),
 * new_category (choice: Bug/Idea/Praise/Question/Other), new_contactid +
 * new_accountid lookups (for me/team scoping + create binding).
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const PREFIX = 'new'
const ENTITY = `${PREFIX}_portalfeedback`

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

async function entityExists(c) {
  const r = await c.get(`EntityDefinitions?$select=LogicalName,EntitySetName&$filter=LogicalName eq '${ENTITY}'`)
  return r.value?.[0] || null
}
async function attrExists(c, logical) {
  try {
    const r = await c.get(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes?$select=LogicalName&$filter=LogicalName eq '${logical}'`)
    return (r.value?.length ?? 0) > 0
  } catch { return false }
}

async function createEntity(c) {
  console.log(`• creating entity ${ENTITY} …`)
  await c.post('EntityDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: `${PREFIX}_PortalFeedback`,
    DisplayName: label('Portal Feedback'),
    DisplayCollectionName: label('Portal Feedback'),
    Description: label('Customer feedback about the Redcentric contact portal.'),
    OwnershipType: 'UserOwned',
    HasActivities: false,
    HasNotes: false,
    IsActivity: false,
    Attributes: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        SchemaName: `${PREFIX}_Name`,
        RequiredLevel: { Value: 'None' },
        MaxLength: 200,
        FormatName: { Value: 'Text' },
        DisplayName: label('Summary'),
        IsPrimaryName: true,
      },
    ],
  })
  console.log('  ✓ entity created')
}

async function addMemo(c) {
  if (await attrExists(c, `${PREFIX}_message`)) return
  console.log('• adding new_message (memo) …')
  await c.post(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
    SchemaName: `${PREFIX}_Message`,
    RequiredLevel: { Value: 'ApplicationRequired' },
    MaxLength: 4000,
    Format: 'Text',
    DisplayName: label('Message'),
    Description: label('The feedback message.'),
  })
}
async function addRating(c) {
  if (await attrExists(c, `${PREFIX}_rating`)) return
  console.log('• adding new_rating (int) …')
  await c.post(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
    SchemaName: `${PREFIX}_Rating`,
    RequiredLevel: { Value: 'None' },
    MinValue: 1,
    MaxValue: 5,
    Format: 'None',
    DisplayName: label('Rating'),
    Description: label('Satisfaction rating, 1–5.'),
  })
}
async function addCategory(c) {
  if (await attrExists(c, `${PREFIX}_category`)) return
  console.log('• adding new_category (choice) …')
  const opts = ['Bug', 'Idea', 'Praise', 'Question', 'Other']
  await c.post(`EntityDefinitions(LogicalName='${ENTITY}')/Attributes`, {
    '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
    SchemaName: `${PREFIX}_Category`,
    RequiredLevel: { Value: 'None' },
    DisplayName: label('Category'),
    Description: label('Type of feedback.'),
    OptionSet: {
      '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
      IsGlobal: false,
      OptionSetType: 'Picklist',
      Options: opts.map((o, i) => ({ Value: 100000000 + i, Label: label(o) })),
    },
  })
}
async function addLookup(c, schema, referenced, display) {
  const logical = schema.toLowerCase()
  if (await attrExists(c, logical)) return
  console.log(`• adding ${logical} lookup → ${referenced} …`)
  await c.post('RelationshipDefinitions', {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: `${PREFIX}_${referenced}_portalfeedback`,
    ReferencedEntity: referenced,
    ReferencingEntity: ENTITY,
    CascadeConfiguration: {
      Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade',
      Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade',
    },
    Lookup: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
      SchemaName: schema,
      DisplayName: label(display),
      RequiredLevel: { Value: 'None' },
    },
  })
}

async function main() {
  console.log(`Target: ${DV}`)
  const c = api(await getToken())

  let ent = await entityExists(c)
  if (!ent) {
    try {
      await createEntity(c)
    } catch (e) {
      if (e.status === 403) {
        console.error('\n✗ 403 Forbidden creating the entity — the service principal lacks customization rights.')
        console.error('  Fallback: create the "Portal Feedback" table in Power Apps maker (prefix new_) with')
        console.error('  columns new_message (text), new_rating (whole number), new_category (choice) and')
        console.error('  lookups new_contactid → Contact, new_accountid → Account, then re-run this script.')
        process.exit(1)
      }
      throw e
    }
  } else {
    console.log(`• entity ${ENTITY} already exists (set: ${ent.EntitySetName})`)
  }

  await addMemo(c)
  await addRating(c)
  await addCategory(c)
  await addLookup(c, `${PREFIX}_ContactId`, 'contact', 'Contact')
  await addLookup(c, `${PREFIX}_AccountId`, 'account', 'Account')

  console.log('• publishing customizations …')
  await c.post('PublishAllXml', {})

  ent = await entityExists(c)
  console.log(`\n✓ Done. Entity set name for Terraform dataverse_table = "${ent?.EntitySetName}"`)
  console.log(`  primary key = ${ENTITY}id`)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
