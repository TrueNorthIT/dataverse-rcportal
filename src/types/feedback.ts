/**
 * Portal feedback — the custom Dataverse table `new_portalfeedback`, exposed by
 * the `portalfeedback` route. Customers submit feedback about the portal itself.
 */
export interface Feedback {
  new_portalfeedbackid: string
  /** Short summary (primary name). */
  new_name?: string
  new_message?: string
  /** Choice value; `new_category_label` is the display text. */
  new_category?: number
  new_category_label?: string
  /** 1–5 satisfaction rating. */
  new_rating?: number
  createdon?: string
  modifiedon?: string
}

/** Fields the form supplies on create (contact + account auto-bound server-side). */
export interface NewFeedback {
  new_name: string
  new_message: string
  new_category?: number
  new_rating?: number
}
