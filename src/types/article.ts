/**
 * A published Knowledge Base article (Dataverse `knowledgearticle`), exposed
 * read-only on the public route. `content` is rich HTML.
 */
export interface Article {
  knowledgearticleid: string
  title?: string
  description?: string
  /** Rich HTML body — sanitise before rendering. */
  content?: string
  articlepublicnumber?: string
  keywords?: string
  createdon?: string
  modifiedon?: string
}
