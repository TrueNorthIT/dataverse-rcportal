// @ts-nocheck
/**
 * Seeds published Knowledge Base articles (Dataverse `knowledgearticle`) with
 * rich HTML content, so the portal's public KB has something to render.
 *
 * Articles are created then transitioned to Published (statecode 3). A marker
 * in `keywords` makes it idempotent + cleanable.
 *
 *   node scripts/seed-kb.mjs
 *   node scripts/seed-kb.mjs --clean
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MARKER = 'DEMO-RCPORTAL'
const here = dirname(fileURLToPath(import.meta.url))

function loadEnv(path) {
  const out = {}; let t; try { t = readFileSync(path, 'utf8') } catch { return out }
  for (const raw of t.split(/\r?\n/)) { const l = raw.trim(); if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i === -1) continue; out[l.slice(0, i).trim()] = l.slice(i + 1).trim() }
  return out
}
const env = loadEnv(join(here, '..', '.env'))
const DV = (env.VITE_DATAVERSE_URL || '').replace(/\/$/, '')
const API = `${DV}/api/data/v9.2`
const CLEAN = process.argv.includes('--clean')
const enc = (s) => encodeURIComponent(s)

async function getToken() {
  const r = await fetch(`https://login.microsoftonline.com/${env.VITE_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.VITE_CLIENT_ID, client_secret: env.CLIENT_SECRET, scope: `${DV}/.default` }),
  })
  const j = await r.json(); if (!j.access_token) throw new Error(`token: ${j.error} ${j.error_description || ''}`)
  return j.access_token
}
function api(token) {
  const base = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }
  return {
    async get(p) { const r = await fetch(`${API}/${p}`, { headers: base }); if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`); return r.json() },
    async create(set, body) { const r = await fetch(`${API}/${set}`, { method: 'POST', headers: { ...base, Prefer: 'return=representation' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`POST ${set} → ${r.status} ${await r.text()}`); return r.json() },
    async patch(set, id, body) { const r = await fetch(`${API}/${set}(${id})`, { method: 'PATCH', headers: base, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`PATCH ${set}(${id}) → ${r.status} ${await r.text()}`) },
    async del(set, id) { const r = await fetch(`${API}/${set}(${id})`, { method: 'DELETE', headers: base }); if (!r.ok && r.status !== 404) throw new Error(`DELETE ${set}(${id}) → ${r.status}`) },
  }
}

const ARTICLES = [
  {
    title: 'Getting started with your Redcentric Contact Portal',
    description: 'A quick tour of the portal — what you can see and do.',
    html: `
<h2>Welcome</h2>
<p>Your Contact Portal gives you a single place to see everything Redcentric manages for your organisation — your <strong>quotes</strong>, <strong>projects</strong>, <strong>sites</strong> and <strong>support tickets</strong> — and to keep your own details up to date.</p>
<h3>Getting around</h3>
<ul>
  <li><strong>Dashboard</strong> — headline numbers and anything that needs your attention.</li>
  <li><strong>My profile</strong> — your contact details and communication preferences.</li>
  <li><strong>My company</strong> — your organisation's details and colleague directory.</li>
  <li><strong>Support</strong> — raise and track tickets.</li>
</ul>
<blockquote>Tip: use the <em>My / Company</em> toggle on each list to switch between your own records and your whole organisation's.</blockquote>`,
  },
  {
    title: 'Raising and tracking a support ticket',
    description: 'How to log a new ticket and follow its progress.',
    html: `
<h2>Raise a ticket</h2>
<ol>
  <li>Go to <strong>Support</strong> and choose <strong>Raise a ticket</strong>.</li>
  <li>Give it a clear summary, add detail, and set a priority.</li>
  <li>Submit — it's routed to our service desk automatically.</li>
</ol>
<h3>Tracking progress</h3>
<p>Open any ticket to see its status, priority and the full <strong>Updates</strong> timeline. You can add your own updates to tickets you raised, and you'll see notes from our engineers as they work it.</p>
<h3>Priorities</h3>
<table>
  <thead><tr><th>Priority</th><th>Use it when…</th></tr></thead>
  <tbody>
    <tr><td>High</td><td>Business-impacting or a service is down.</td></tr>
    <tr><td>Normal</td><td>Standard requests and non-urgent issues.</td></tr>
    <tr><td>Low</td><td>Questions and minor changes.</td></tr>
  </tbody>
</table>`,
  },
  {
    title: 'Understanding your quotes',
    description: 'What the statuses mean and how to review a quote.',
    html: `
<h2>Your quotes</h2>
<p>The <strong>Quotes</strong> area lists proposals we've prepared for your organisation, with the total value and current status.</p>
<h3>Statuses</h3>
<ul>
  <li><strong>Draft</strong> — we're still preparing it.</li>
  <li><strong>Active</strong> — issued to you and awaiting a decision.</li>
</ul>
<p>Use the filter pills to narrow by status, and sort by <em>value</em> to see the largest first. If you'd like to proceed with a quote, reply to your account manager or raise a ticket referencing the quote number.</p>`,
  },
  {
    title: 'Your projects and delivery status',
    description: 'Reading the project schedule and RAG health.',
    html: `
<h2>Projects</h2>
<p>The <strong>Projects</strong> area shows delivery work in flight for your organisation, with a schedule and a <strong>RAG</strong> (Red / Amber / Green) health indicator.</p>
<ul>
  <li><span style="color:#1c6b4f;font-weight:600">On track</span> — finishing comfortably ahead.</li>
  <li><span style="color:#b45309;font-weight:600">Due soon</span> — finishing within 30 days.</li>
  <li><span style="color:#b91c1c;font-weight:600">Overdue</span> — past its planned finish; we'll be in touch.</li>
</ul>
<p>Filter by health to focus on what matters, and sort by <em>due date</em> to see the nearest deadlines first.</p>`,
  },
  {
    title: 'Security best practices for your team',
    description: 'Simple steps that make the biggest difference.',
    html: `
<h2>Keep your organisation safe</h2>
<p>Most incidents are preventable. These basics go a long way:</p>
<ol>
  <li><strong>Turn on multi-factor authentication (MFA)</strong> everywhere it's offered.</li>
  <li><strong>Use a password manager</strong> — unique passwords per service.</li>
  <li><strong>Think before you click</strong> — verify unexpected links and attachments.</li>
  <li><strong>Keep devices patched</strong> — enable automatic updates.</li>
  <li><strong>Report anything suspicious</strong> — raise a High-priority ticket.</li>
</ol>
<blockquote>Spotted a phishing email? Don't interact with it — raise a ticket and we'll investigate.</blockquote>`,
  },
  {
    title: 'Managing your company contacts',
    description: 'Keep your colleague directory and profile current.',
    html: `
<h2>Your details</h2>
<p>Under <strong>My profile</strong> you can keep your own contact details and <strong>communication preferences</strong> up to date, including whether you receive marketing email.</p>
<h3>Colleagues</h3>
<p>The <strong>My company</strong> page lists everyone at your organisation we hold a contact for, with their role and contact details. If someone has left or a detail is wrong, raise a ticket and we'll update our records.</p>`,
  },
  {
    title: 'Connectivity options explained',
    description: 'A plain-English guide to the circuit types you may see.',
    html: `
<h2>Connectivity at your sites</h2>
<p>On the <strong>Sites</strong> page each location shows its connectivity type. Here's what they mean:</p>
<ul>
  <li><strong>FTTP</strong> — Fibre to the Premises; full fibre, highest performance.</li>
  <li><strong>FTTC</strong> — Fibre to the Cabinet; fibre to the street, copper for the last stretch.</li>
  <li><strong>Leased Line</strong> — a dedicated, uncontended Ethernet circuit with guaranteed speeds.</li>
  <li><strong>Dark Fibre</strong> — unlit fibre you light yourself for maximum capacity.</li>
  <li><strong>EFM</strong> — Ethernet First Mile over bonded copper where fibre isn't available.</li>
</ul>
<p>Not sure which is right for a site? Raise a ticket and we'll advise.</p>`,
  },
]

async function clean(client) {
  const found = await client.get(`knowledgearticles?$select=knowledgearticleid&$filter=${enc(`contains(keywords,'${MARKER}')`)}`)
  const rows = found.value || []
  for (const a of rows) await client.del('knowledgearticles', a.knowledgearticleid)
  console.log(`✓ removed ${rows.length} demo articles`)
}

async function publish(client, id) {
  // Move Draft → Published. statecode 3 = Published, statuscode 7 = Published.
  try {
    await client.patch('knowledgearticles', id, { statecode: 3, statuscode: 7 })
    return true
  } catch (e) {
    console.log(`  ! publish failed for ${id}: ${String(e.message).slice(0, 120)}`)
    return false
  }
}

async function seed(client) {
  let created = 0, published = 0, skipped = 0
  for (const a of ARTICLES) {
    const existing = await client.get(
      `knowledgearticles?$select=knowledgearticleid,statecode&$filter=${enc(`title eq '${a.title.replace(/'/g, "''")}' and contains(keywords,'${MARKER}')`)}`,
    )
    if (existing.value?.length) {
      const rec = existing.value[0]
      if (rec.statecode !== 3 && (await publish(client, rec.knowledgearticleid))) published++
      skipped++
      continue
    }
    const rec = await client.create('knowledgearticles', {
      title: a.title,
      description: a.description,
      content: a.html.trim(),
      keywords: `${MARKER}, portal, help`,
      islatestversion: true,
    })
    created++
    if (await publish(client, rec.knowledgearticleid)) published++
  }
  console.log(`\nDone. created ${created}, published ${published}, existing ${skipped}.`)
}

async function main() {
  console.log(`Target: ${DV}`)
  const client = api(await getToken())
  if (CLEAN) return clean(client)
  await seed(client)
}
main().catch((e) => { console.error(e.message || e); process.exit(1) })
