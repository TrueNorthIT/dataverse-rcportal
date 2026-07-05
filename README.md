# Redcentric Contact Portal (`dataverse-rcportal`)

A Vite + React + TypeScript + Tailwind SPA that shows how little it takes to
build a real customer self-service portal on the **Dataverse Contact API**. A
signed-in customer sees **their own** records (`me`) and can toggle to their
**whole company's** records (`team`) across contacts, sites, quotes, projects,
support cases, and the knowledge base. Styled in the **Redcentric** brand (see
`BRAND.md`); built to the brief in `PORTAL_SPEC.md`.

The whole app talks to Dataverse through **one thing** — the
[`@truenorth-it/dataverse-client`](https://www.npmjs.com/package/@truenorth-it/dataverse-client)
SDK. It never calls Microsoft/Dataverse directly, never hand-builds OData, never
sets an auth header. Every screen is the same shape: **one SDK call → one
screen.**

- **Scope:** `rcportal`
- **API:** `https://api.dataverse-contact.tnapps.co.uk`
- **Auth:** Microsoft **Entra External ID** (CIAM) via MSAL (PKCE SPA flow)

## How easy is it? A whole list page

A filtered, sorted, paginated, My/Company-toggled list screen — the kind that
usually sprawls across a hundred lines — is just a bit of config and a row
renderer. `<ListScreen>` owns the data fetch, the URL-backed filter/sort, the
pill greying, the loading/empty/error states, infinite scroll, and row
navigation:

```tsx
export function ProjectsPage() {
  return (
    <ListScreen<Project>
      title="Projects"
      subtitle={{ me: 'Projects you sponsor', team: "Your company's projects" }}
      basePath="/projects"
      table="project"
      select={PROJECT_SELECT}
      pills={buildProjectPills()}
      sorts={PROJECT_SORTS}
      defaultSort="due"
      defaultTier="team"
      getId={(p) => p.msdyn_projectid ?? ''}
      emptyMessage={(f) => (f === 'all' ? 'No projects to show yet.' : 'No projects in that state.')}
      renderRow={(p) => <ProjectRow project={p} />}
    />
  )
}
```

That's the entire Projects, Quotes, Sites, and Cases story — same component,
different config. Detail pages are just as small: one `fetchDetail(...)` call
resolves whether a record is the caller's own (`me`) or their company's
(`team`), then the page renders it.

## Architecture — four thin layers

```
src/
├── main.tsx                MSAL PublicClientApplication + MsalProvider bootstrap
├── App.tsx                 auth gate → LoginScreen | routed app (react-router)
├── env.ts                  fail-fast VITE_* env access
├── config/entra.ts         MSAL/Entra config + AppUser claim mapping
│
│   ── 1. the SDK client ──────────────────────────────────────────────
├── lib/client.ts           useDataverseClient() — MSAL token → SDK, per-user
├── lib/getToken.ts         silent Entra token, interactive fallback
│
│   ── 2. services: what to read, per resource ────────────────────────
├── services/<table>Api.ts  SELECT column sets, filter PILLS, typed get/create
├── services/detail.ts      fetchDetail() — resolve me/team tier for one record
│
│   ── 3. hooks: the data mechanics ───────────────────────────────────
├── hooks/useTierList.ts    generic me/team list + cursor pagination + toggle
├── hooks/useList.ts        list + URL filter/sort + pill greying, in one call
├── hooks/useMyContact.ts   the caller's own contact (view/edit/self-register)
├── hooks/useDashboard.ts   me/team aggregate tiles (roll up across companies)
│
│   ── 4. UI: config in, screen out ───────────────────────────────────
├── components/common/      ListScreen, ListStates, TierToggle, Card, PageHeader…
├── components/layout/       AppShell (brand top bar) + NavTabs + company switcher
└── pages/                  Dashboard, Profile, Company, Sites, Quotes, Projects,
                            Support (cases), Knowledge base — each ~one screen
```

The flow is always the same: a **page** picks a **service** config, a **hook**
runs the **SDK** call, and a shared **component** renders it. Add a new
list-backed screen by pointing `<ListScreen>` at another table.

## Commands

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # tsc -b typecheck + vite build
npm run lint      # oxlint
npm test          # vitest run (unit tests)
npm run coverage  # vitest run --coverage
npm run seed      # seed fictional demo data ([DEMO-RCPORTAL])
```

## Tests — the same "one SDK call" ease, proved

The suite is **730+ tests at ~99% line coverage** (`npm run coverage`; the
thresholds in `vite.config.ts` gate at 90%). The point isn't the number — it's
that testing this portal is as easy as building it. A tiny kit under `src/test/`
makes every test read the same way: **point the mock, render, assert.**

```ts
// src/test/dataverse.ts gives you a fully-stubbed SDK client.
const client = makeClient()
client.team.list.mockResolvedValue(paginated([project]))

renderWithProviders(<ProjectsPage />)          // providers wired for you
expect(await screen.findByText('Rollout')).toBeInTheDocument()
```

- `makeClient()` — a `DataverseClient` where every tier method is a `vi.fn()`.
- `paginated()` / `single()` / `count()` — build the SDK's response envelopes.
- `renderWithProviders()` — React Query + router, with `path`/`route`/`state`
  for detail pages that read `useParams()` / `location.state`.

No network, no Entra, no live Dataverse — the SDK seam is the only thing a test
has to fake.

## Environment

Copy `.env.example` → `.env` and fill in. `.env` is gitignored. Sign-in uses
Entra External ID:

- `VITE_ENTRA_TENANT_ID` — CIAM tenant (also the authority host).
- `VITE_ENTRA_CLIENT_ID` — the SPA app registration's client id.
- `VITE_ENTRA_API_SCOPE` — `api://<api-app-id>/access_as_user`.
- `VITE_API_BASE_URL` — `https://api.dataverse-contact.tnapps.co.uk/api/v2/rcportal`.

The SPA app registration must list the dev/prod origins (e.g.
`http://localhost:5173`) as **SPA redirect URIs**, or sign-in fails with
`AADSTS50011`.

## Status & remaining setup

The app builds clean and implements every spec screen. To see **live data**:

1. Provision the `rcportal` scope + publish the tables (`contact`, `account`,
   `opportunity`, `quote`, `project`, `site`, `case`, knowledge base) — backend
   lives in `../dataverse-rcportal-terraform`.
2. **Regenerate `src/types/dataverse.generated.ts`** from the published schema
   (`npm run generate:types`) — the record shapes are the source of truth.
3. Seed demo data (`npm run seed`) so `me`-tier lists aren't empty.
4. Add the SPA redirect URI in Entra and sign in as a demo identity
   (see `PORTAL_SPEC.md` §2).
