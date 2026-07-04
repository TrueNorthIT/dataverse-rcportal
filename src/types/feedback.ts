/**
 * Portal feedback (custom `new_portalfeedback` table). Record shape from the
 * generated schema types (`dataverse.generated.ts`), aliased to `Feedback`;
 * create-input hand-declared.
 */
export type { Portalfeedback as Feedback } from './dataverse.generated'

/** Fields the form supplies on create (contact + account auto-bound server-side). */
export interface NewFeedback {
  new_name: string
  new_message: string
  new_rating?: number
}
