import { apiBaseUrl } from '../config/entra'
import type { Article } from '../types/article'

/**
 * Knowledge base reads. The `knowledgearticle` route is exposed on the public
 * (unauthenticated) tier, so we hit it with a plain fetch — no MSAL token — and
 * it works regardless of sign-in state.
 */
const LIST_SELECT = ['knowledgearticleid', 'title', 'description', 'articlepublicnumber', 'createdon', 'modifiedon']
const DETAIL_SELECT = [...LIST_SELECT, 'content', 'keywords']

async function publicGet(path: string): Promise<{ data: unknown }> {
  const res = await fetch(`${apiBaseUrl}/public/${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Knowledge base request failed (${res.status})`)
  return res.json()
}

/** All published articles, alphabetical. */
export async function listArticles(): Promise<Article[]> {
  const q = new URLSearchParams({ select: LIST_SELECT.join(','), orderBy: 'title:asc', top: '100' })
  const json = await publicGet(`knowledgearticle?${q.toString()}`)
  return (json.data as Article[]) ?? []
}

/** A single article, including its HTML `content`. */
export async function getArticle(id: string): Promise<Article> {
  const q = new URLSearchParams({ select: DETAIL_SELECT.join(',') })
  const json = await publicGet(`knowledgearticle/${id}?${q.toString()}`)
  return json.data as Article
}
