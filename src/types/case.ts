/**
 * Support case (`incident`). Record shape comes from the generated schema types
 * (`dataverse.generated.ts`, run `npm run generate:types`); the create-input
 * shape is hand-declared (only the fields the portal supplies).
 */
export type { Case } from './dataverse.generated'

/** Fields a customer supplies when raising a case (`client.me.create`). */
export interface NewCase {
  title: string
  description?: string
  prioritycode?: number
}
