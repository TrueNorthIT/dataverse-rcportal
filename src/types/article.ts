/**
 * Knowledge base article (`knowledgearticle`). Record shape from the generated
 * schema types (`dataverse.generated.ts`), aliased to `Article`. `content` is
 * rich HTML — sanitise before rendering.
 */
export type { Knowledgearticle as Article } from './dataverse.generated'
