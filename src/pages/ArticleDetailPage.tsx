import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { getArticle } from '../services/knowledgeApi'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'

/** Knowledge article detail — renders the article's sanitised HTML content. */
export function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['kb', id],
    queryFn: () => getArticle(id!),
    enabled: !!id,
  })
  const article = query.data ?? null

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/knowledge')}
        className="mb-4 text-sm font-medium text-white/90 hover:underline"
      >
        ← Knowledge base
      </button>

      {query.isLoading && <ArticleSkeleton />}
      {query.error && <p className="text-sm text-red-200">Couldn’t load this article.</p>}

      {article && (
        <Card className="overflow-hidden">
          <div className="rc-gradient h-1 w-full" />
          <div className="p-6 sm:p-8">
            <h1 className="text-2xl font-normal tracking-tight text-rc-navy">
              {article.title || 'Article'}
            </h1>
            <div className="mt-1 text-xs text-rc-teal">
              {article.articlepublicnumber ? `${article.articlepublicnumber} · ` : ''}
              Updated {formatDate(article.modifiedon)}
            </div>
            <div
              className="rc-article mt-6"
              // Content is rich HTML from D365 — always sanitise before render.
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content ?? '') }}
            />
          </div>
        </Card>
      )}
    </div>
  )
}

function ArticleSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading article">
      <div className="rc-gradient h-1 w-full" />
      <div className="space-y-3 p-6 sm:p-8">
        <div className="rc-skeleton h-7 w-2/3 rounded" />
        <div className="rc-skeleton h-3 w-32 rounded" />
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ ['--rc-delay' as string]: `${i * 0.1}s` }} className="rc-skeleton h-3 w-full rounded" />
          ))}
        </div>
      </div>
    </Card>
  )
}
