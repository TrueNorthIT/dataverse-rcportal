import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listArticles } from '../services/knowledgeApi'
import { relativeFromNow, formatDate } from '../lib/format'
import { PageHeader } from '../components/common/PageHeader'
import { Card } from '../components/common/Card'
import { ListStates } from '../components/common/ListStates'

/** Knowledge base: searchable list of published articles (public, read-only). */
export function KnowledgeBasePage() {
  const [q, setQ] = useState('')
  const query = useQuery({ queryKey: ['kb-list'], queryFn: listArticles })
  const articles = query.data ?? []

  const term = q.trim().toLowerCase()
  const visible = term
    ? articles.filter((a) =>
        `${a.title ?? ''} ${a.description ?? ''}`.toLowerCase().includes(term),
      )
    : articles

  return (
    <div>
      <PageHeader title="Knowledge base" subtitle="Guides and answers — help yourself, any time" />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search articles…"
        className="rc-input mb-4 w-full"
        aria-label="Search articles"
      />

      <ListStates
        loading={query.isLoading}
        error={query.error instanceof Error ? query.error.message : null}
        isEmpty={visible.length === 0}
        emptyMessage={term ? 'No articles match your search.' : 'No articles published yet.'}
      >
        <div className="space-y-3 rc-land-list">
          {visible.map((a) => (
            <Link key={a.knowledgearticleid} to={`/knowledge/${a.knowledgearticleid}`} className="block">
              <Card className="p-4 transition-colors hover:border-rc-blue">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-rc-navy">{a.title || 'Untitled article'}</div>
                    {a.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-rc-teal">{a.description}</p>
                    )}
                    <div className="mt-1 text-xs text-rc-teal" title={formatDate(a.modifiedon)}>
                      {a.articlepublicnumber ? `${a.articlepublicnumber} · ` : ''}
                      Updated {relativeFromNow(a.modifiedon)}
                    </div>
                  </div>
                  <svg className="mt-0.5 shrink-0 text-rc-teal" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </ListStates>
    </div>
  )
}
