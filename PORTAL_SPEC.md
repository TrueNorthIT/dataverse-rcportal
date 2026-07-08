# Contact Portal — Specification

> Build spec for the **Redcentric Contact Portal** (`dataverse-rcportal`). This
> document is the brief for fleshing out the app in a fresh session. It is
> intentionally implementation-light on UI detail and precise on data/auth/API
> so the build can proceed without re-discovering the backend.

## 1. What this is

A customer self-service portal that demos the **Dataverse Contact API**. A
signed-in customer sees **their own** records (`me`) and can toggle to their
**whole company's** records (`team`) across contacts, their account,
opportunities, quotes, and projects. It is a demo/reference app styled in the
Redcentric brand — the data is fictional (Yorkshire companies), the patterns
are production-shaped.

**Non-goals:** it never talks to Microsoft/Dataverse directly, never hand-rolls
`fetch`/OData/auth headers, and holds no server of its own — it is a pure SPA
against the Contact API via the SDK.

## 2. Users & tiers

- **Who signs in:** a customer contact, via Microsoft **Entra External ID**
  (CIAM). The token's email is matched to a Dataverse `contact`.
- **`me` tier** — records tied to the signed-in contact (their profile, the
  opportunities/quotes they're the primary contact on, projects for their
  account where they're primary contact).
- **`team` tier** — every record for the contact's **account** (all colleagues,
  all the company's opportunities/quotes/projects).
- The UI should make "My … / Company …" a first-class, obvious toggle on each
  list view. Default to `me`; let the user switch to `team`.

Demo login identities (one per company, all route to the operator's inbox):
`steve+av@drakey.co.uk` (Aire Valley), `+wt` (Wharfedale Textiles),
`+em` (Ebor Manufacturing), `+rm` (Ridings Mutual), `+cr` (Calder & Ryburn),
`+cp` (Chevin Print).

## 3. Auth (already wired)

- **MSAL** (`@azure/msal-browser` + `@azure/msal-react`), PKCE SPA flow.
  `src/main.tsx` builds the `PublicClientApplication`; `src/config/entra.ts`
  holds authority/scope; `src/lib/client.ts` acquires a token silently (with
  interactive-redirect fallback) and hands it to the SDK's `getToken`.
- Env (`.env`, see `.env.example`): `VITE_ENTRA_TENANT_ID`,
  `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_API_SCOPE`, `VITE_API_BASE_URL`.
- The SPA app registration must list the dev/prod origins as SPA redirect URIs.

## 4. API

- **Base:** `https://api.dataverse-contact.tnapps.co.uk`, **scope `rcportal`**
  (`VITE_API_BASE_URL=…/api/v2/rcportal`).
- **SDK:** `@truenorth-it/dataverse-client`. Always use `client.me.*` /
  `client.team.*`. Responses are `{ data, page }` for lists (cursor paging via
  `page.next` / `fetchPage` / `eachPage`) and `{ data }` for single/get/create/
  update. Filters are `FilterCondition | FilterCondition[]` + `filterLogic`.
  Choice fields come back with a `<field>_label` companion.
- **Never** build OData strings or set headers by hand.

## 5. Data model (published `rcportal` tables)

Customer-facing tables, read/write at `me` + `team` (support/quotes also
`create`; opportunities read-only).
Key fields and how each relates to the signed-in user:

| Route | Dataverse | `me` = | `team` = | Notable fields |
|---|---|---|---|---|
| `contact` | contacts | own record | colleagues at account | fullname, emailaddress1, jobtitle, telephone1, mobilephone, address1_* |
| `account` | accounts | account you're primary contact of | your own account | name, telephone1, websiteurl, address1_*, primarycontactid |
| `opportunity` | opportunities | deals you're primary contact on | your company's pipeline | name, estimatedvalue, estimatedclosedate, statecode/statuscode (labels) |
| `quote` | quotes | quotes on your deals | your company's quotes | name, quotenumber, totalamount, statecode/statuscode (labels) |
| `project` | msdyn_project | your company's projects | your company's projects | msdyn_subject (name), status, `new_accountid` (custom account link) |
| `support` | incident | cases you're the contact on | your company's cases | title, ticketnumber, prioritycode, statuscode (labels), createdon |
| `site` | customeraddress | (via company) | your company's locations | name, line1, city, postalcode, addresstypecode |

Relationships worth surfacing in the UI: contact → account (company);
quote → account; project → account; support case → account + primary contact;
site → account (via `parentid`).

> **Opportunities are customer-visible but READ-ONLY.** They were briefly
> removed as "internal sales forecasting", then deliberately brought back as a
> portal heading: a customer can see the deals being pursued with them (value,
> close date, state) and click through to the quotes each one produced. What
> stays out of scope is *authoring* — the portal never creates or edits an
> opportunity, and internal-only fields (win probability, sales stage) are not
> surfaced. `opportunityApi` has no create/update helpers by design.

## 6. Screens / features (build these)

1. **Sign-in** — Redcentric-branded landing; MSAL redirect. (Exists as a stub.)
2. **Shell** — header with brand, signed-in email, company name, sign-out; the
   blue→teal gradient accent. Left/tab nav across the sections below.
3. **My profile** (`contact`, me) — view + edit own contact; self-register path
   if no contact yet (`client.me.register`).
4. **My company** (`account` me + `contact` team) — company details; a directory
   of colleagues (team contacts).
5. **Opportunities** — list with **My / Company** toggle, value + close date +
   status chips; detail view with the quotes it produced. Read-only (see the
   note in §5). Sort by close date.
6. **Quotes** — list with My / Company toggle; show number, total, status; link
   through to the source opportunity.
7. **Projects** — list with My / Company toggle; subject, status, dates.
8. **Dashboard** (optional) — counts/cards: open opportunities, pipeline value,
   active quotes/projects — using `client.me`/`client.team` list + aggregate.

Every list: loading, error, and empty states; refresh; cursor pagination via
`page.next`. Use choice `_label` fields for chips. Keep components < 300 lines,
one concern per file, no barrel exports, SDK-only data access.

## 7. Design

Redcentric palette is already tokenised in `src/index.css` (`--color-rc-*`:
navy `#142d46`, blue `#0066b3`, blue-light `#d9e8f4`, teal `#005862`, green-dark
`#00272b`, green-light `#d8f0f1`, lime `#8dc63f`) with a `.rc-gradient` accent.
Logo at `public/brand/`. Tailwind v4 (utilities like `bg-rc-blue`,
`text-rc-navy`). Clean, calm, enterprise SaaS feel; generous white space.

## 8. Tech & layout

Vite + React 19 + TS + Tailwind v4 + MSAL + dataverse-client SDK. Extend the
existing structure: `config/`, `lib/client.ts`, `services/<table>Api.ts`,
`hooks/use<Thing>.ts`, `types/<table>.ts`, `components/…`. Types should be
regenerated from the live schema (`contact-admin tables get <route> --scope
rcportal --json`, or the SDK codegen) rather than hand-guessed.

Commands: `npm run dev`, `npm run build` (tsc + vite), `npm run lint` (oxlint).

## 9. Notes / gotchas

- `me`-tier only returns rows when the signed-in contact actually owns records
  (is the account's `primarycontactid`, the opportunity's `parentcontactid`,
  etc.). The seed data wires the `steve+<code>` login contacts as owners so
  `me` isn't empty.
- The scope reads Dataverse env `org342102a9` (set on the API via
  `RCPORTAL__DATAVERSE_URL`). Seed data is fictional and tagged `[DEMO-RCPORTAL]`.
- Backend provisioning (scope + tables + permissions) lives in
  `../dataverse-rcportal-terraform`; demo data in `scripts/seed-demo.mjs`.
