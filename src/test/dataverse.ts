import { vi } from 'vitest'
import type {
  AggregateResponse,
  Company,
  CompaniesResponse,
  DataverseClient,
  PaginatedResponse,
  SingleResponse,
} from '@truenorth-it/dataverse-client'

/**
 * Test kit for the Dataverse Contact API SDK.
 *
 * Every screen in this portal is "one SDK call → render", so a test only ever
 * needs to say what that call returns. These helpers build the exact response
 * envelopes the SDK produces, and `makeClient()` hands back a fully-stubbed
 * client whose every method is a `vi.fn()` you can point wherever a test needs.
 */

/** Wrap rows in the SDK's paginated envelope (`{ data, page }`). */
export function paginated<T>(data: T[], next: string | null = null): PaginatedResponse<T> {
  return { data, page: { top: data.length, next } }
}

/** Wrap a single record in the SDK's `{ data }` envelope. */
export function single<T>(data: T): SingleResponse<T> {
  return { data }
}

/** Wrap aggregate rows in the SDK's `{ data }` envelope. */
export function aggregate<T>(rows: T[]): AggregateResponse<T> {
  return { data: rows }
}

/** A single aggregate count row, as the API returns it (`[{ count: n }]`). */
export function count(n: number): AggregateResponse<Record<string, number>> {
  return aggregate([{ count: n }])
}

/** A `Company` with sensible defaults — override only what a test cares about. */
export function makeCompany(over: Partial<Company> = {}): Company {
  return {
    // Classic model: companyId === contactid.
    companyId: over.contactid ?? 'contact-1',
    contactid: 'contact-1',
    accountId: 'account-1',
    companyName: 'Acme Ltd',
    fullname: 'Ada Lovelace',
    isDefault: true,
    isCurrent: true,
    ...over,
  }
}

/** Build a `CompaniesResponse` from a list of companies. */
export function companiesResponse(companies: Company[]): CompaniesResponse {
  return { companies, hasMultiple: companies.length > 1 }
}

/** A stubbed scope client (`me` / `team` / `all`) — all reads resolve empty. */
function makeScope() {
  return {
    list: vi.fn().mockResolvedValue(paginated([])),
    fetchPage: vi.fn().mockResolvedValue(paginated([])),
    eachPage: vi.fn(),
    get: vi.fn().mockResolvedValue(single({})),
    update: vi.fn().mockResolvedValue(single({})),
    lookup: vi.fn().mockResolvedValue(paginated([])),
    aggregate: vi.fn().mockResolvedValue(count(0)),
    create: vi.fn().mockResolvedValue(single({})),
    whoami: vi.fn(),
    companies: vi.fn().mockResolvedValue(companiesResponse([makeCompany()])),
    register: vi.fn(),
    invokeFunction: vi.fn(),
    invokeAction: vi.fn(),
  }
}

/** A fully-typed mock `DataverseClient`. Every method is a `vi.fn()`. */
export type MockClient = DataverseClient & {
  me: ReturnType<typeof makeScope>
  team: ReturnType<typeof makeScope>
  all: ReturnType<typeof makeScope>
  public: ReturnType<typeof makeScope>
}

/**
 * Build a mock Dataverse client. Point any tier's method at your data:
 *
 * ```ts
 * const client = makeClient()
 * client.team.list.mockResolvedValue(paginated([project]))
 * ```
 */
export function makeClient(): MockClient {
  const client = {
    me: makeScope(),
    team: makeScope(),
    all: makeScope(),
    public: makeScope(),
    choices: vi.fn(),
    schema: vi.fn(),
    negotiate: vi.fn(),
    withContact: vi.fn(),
  }
  // withContact() returns the same mock so chained calls stay observable.
  client.withContact.mockReturnValue(client)
  return client as unknown as MockClient
}
