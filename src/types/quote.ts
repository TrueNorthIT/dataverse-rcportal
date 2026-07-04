/**
 * Sales quote. Record shape from the generated schema types
 * (`dataverse.generated.ts`); create-input hand-declared.
 */
export type { Quote } from './dataverse.generated'

/** A single line item on a quote (`quotedetail`). */
export type { Quotedetail as QuoteLine } from './dataverse.generated'

/** Fields accepted when a customer creates a quote (`client.me.create`). */
export interface NewQuote {
  name: string
  opportunityid?: string
}
