import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { getArticle } from '../services/knowledgeApi'
import { formatDate } from '../lib/format'
import { Card } from '../components/common/Card'
import { DetailStates } from '../components/detail/DetailChrome'

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

      <DetailStates
        loading={query.isLoading}
        error={query.error ? 'Couldn’t load this article.' : null}
      >
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
      </DetailStates>
    </div>
  )
}
