# Redcentric Contact Portal (`dataverse-rcportal`)

A Vite + React + TypeScript + Tailwind SPA — a customer self-service portal on
the **Dataverse Contact API**. A signed-in customer sees **their own** records
(`me`) and can toggle to their **whole company's** records (`team`) across
contacts, sites, quotes, projects, support cases, and the knowledge base. Styled
in the **Redcentric** brand (see `BRAND.md`); built to the brief in
`PORTAL_SPEC.md`.

All Dataverse access goes through the
[`@truenorth-it/dataverse-client`](https://www.npmjs.com/package/@truenorth-it/dataverse-client)
SDK — the app never calls Microsoft/Dataverse directly, hand-builds OData, or
sets an auth header.

- **Scope:** `rcportal`
- **API:** `https://api.dataverse-contact.tnapps.co.uk`
- **Auth:** Microsoft **Entra External ID** (CIAM) via MSAL (PKCE SPA flow)

## Architecture

Four layers — a **page** picks a **service** config, a **hook** runs the **SDK**
call, and a shared **component** renders it.

```
src/
├── main.tsx                MSAL PublicClientApplication + MsalProvider bootstrap
├── App.tsx                 auth gate → LoginScreen | routed app (react-router)
├── env.ts                  fail-fast VITE_* env access
├── config/entra.ts         MSAL/Entra config + AppUser claim mapping
│
│   ── 1. SDK client ────────────────────────────────────────────────────
├── lib/client.ts           useDataverseClient() — MSAL token → SDK, per-user
├── lib/getToken.ts         silent Entra token, interactive fallback
│
│   ── 2. services: what to read, per resource ──────────────────────────
├── services/<table>Api.ts  SELECT column sets, filter PILLS, typed get/create
├── services/detail.ts      fetchDetail() — resolve me/team tier for one record
│
│   ── 3. hooks: data mechanics ─────────────────────────────────────────
├── hooks/useTierList.ts    generic me/team list + cursor pagination + toggle
├── hooks/useList.ts        list + URL filter/sort + pill greying, in one call
├── hooks/useMyContact.ts   the caller's own contact (view/edit/self-register)
├── hooks/useDashboard.ts   me/team aggregate tiles (roll up across companies)
│
│   ── 4. UI ────────────────────────────────────────────────────────────
├── components/common/      ListScreen, ListStates, DetailStates, TierToggle, …
├── components/layout/      AppShell (brand top bar) + NavTabs + company switcher
└── pages/                  Dashboard, Profile, Company, Sites, Quotes, Projects,
                            Support (cases), Knowledge base
```

A list page supplies its table, columns, pills, sorts, and a row renderer;
`<ListScreen>` handles the data fetch, URL-backed filter/sort, pill greying,
loading/empty/error states, infinite scroll, and row navigation:

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

Detail pages call `fetchDetail(...)` (which resolves the `me`/`team` tier) and
render the record inside `<DetailStates>` (loading / error / content).

## Commands

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # tsc -b typecheck + vite build
npm run lint      # oxlint
npm test          # vitest run (unit tests)
npm run coverage  # vitest run --coverage
npm run seed      # seed fictional demo data ([DEMO-RCPORTAL])
```

## Tests

~99% line coverage (`npm run coverage`; thresholds in `vite.config.ts` gate at
90% lines/statements/functions, 85% branches). The kit under `src/test/` stubs
the SDK seam so tests need no network, Entra, or live Dataverse:

```ts
const client = makeClient()
client.team.list.mockResolvedValue(paginated([project]))

renderWithProviders(<ProjectsPage />)
expect(await screen.findByText('Rollout')).toBeInTheDocument()
```

- `makeClient()` — a `DataverseClient` where every tier method is a `vi.fn()`.
- `paginated()` / `single()` / `count()` — build the SDK's response envelopes.
- `renderWithProviders()` — React Query + router, with `path`/`route`/`state`
  for detail pages that read `useParams()` / `location.state`.

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

The app builds clean and implements every spec screen. To see live data:

1. Provision the `rcportal` scope + publish the tables (`contact`, `account`,
   `opportunity`, `quote`, `project`, `site`, `case`, knowledge base) — backend
   lives in `../dataverse-rcportal-terraform`.
2. Regenerate `src/types/dataverse.generated.ts` from the published schema
   (`npm run generate:types`) — the record shapes are the source of truth.
3. Seed demo data (`npm run seed`) so `me`-tier lists aren't empty.
4. Add the SPA redirect URI in Entra and sign in as a demo identity
   (see `PORTAL_SPEC.md` §2).
