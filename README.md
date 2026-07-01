# Redcentric Contact Portal (`dataverse-rcportal`)

A Vite + React + TypeScript + Tailwind SPA that demos the **Dataverse Contact
API**. A signed-in customer sees **their own** records (`me`) and can toggle to
their **whole company's** records (`team`) across contacts, their account,
opportunities, quotes, and projects. Styled in the **Redcentric** brand
(see `BRAND.md`); built to the brief in `PORTAL_SPEC.md`.

The SPA talks **only** to the Contact API via the
[`@truenorth-it/dataverse-client`](https://www.npmjs.com/package/@truenorth-it/dataverse-client)
SDK — it never calls Microsoft/Dataverse directly and never hand-builds OData
or auth headers.

- **Scope:** `rcportal`
- **API:** `https://api.dataverse-contact.tnapps.co.uk`
- **Auth:** Microsoft **Entra External ID** (CIAM) via MSAL (PKCE SPA flow)

## Structure

```
src/
├── main.tsx                MSAL PublicClientApplication + MsalProvider bootstrap
├── App.tsx                 auth gate → LoginScreen | routed app (react-router)
├── env.ts                  fail-fast VITE_* env access
├── config/entra.ts         MSAL/Entra config + AppUser claim mapping
├── lib/
│   ├── client.ts           useDataverseClient() — MSAL token → SDK getToken
│   └── format.ts           currency / date formatters
├── types/                  provisional record shapes (regenerate from schema)
│   └── contact | account | opportunity | quote | project
├── services/<table>Api.ts  SELECT column sets + typed get/create helpers
├── hooks/
│   ├── useTierList.ts       generic me/team list + pagination + toggle state
│   ├── useMyContact.ts      the caller's own contact (view/edit/register)
│   ├── useMyCompany.ts      the caller's account (header + Company page)
│   └── useDashboard.ts      me-tier aggregate tiles
├── components/
│   ├── layout/              AppShell (brand top bar + gradient) + NavTabs
│   ├── common/              TierToggle, StatusChip, Card, PageHeader, ListStates
│   └── ContactProfile.tsx   profile view + inline edit + self-register
└── pages/                  Dashboard, Profile, Company, Opportunities (+detail),
                            Quotes, Projects
```

## Commands

```bash
npm run dev      # Vite dev server (http://localhost:5173)
npm run build    # tsc -b typecheck + vite build
npm run lint     # oxlint
npm run seed     # seed fictional demo data ([DEMO-RCPORTAL])
```

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

The app builds clean and implements all spec screens. To see **live data**:

1. Provision the `rcportal` scope + publish the `contact`, `account`,
   `opportunity`, `quote`, `project` tables (backend lives in
   `../dataverse-rcportal-terraform`).
2. **Regenerate `src/types/*.ts`** from the published schema
   (`contact-admin tables get <route> --scope rcportal --json`) — the current
   files are provisional field guesswork, not the source of truth.
3. Seed demo data (`npm run seed`) so `me`-tier lists aren't empty.
4. Add the SPA redirect URI in Entra and sign in as a demo identity
   (see `PORTAL_SPEC.md` §2).
