import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { addCaseNote, fetchCaseDetail, listCaseNotes, updateCase } from '../services/caseApi'
import { cleanDescription, formatDate, relativeFromNow } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import type { DataverseClient } from '@truenorth-it/dataverse-client'

/** Navigation context passed from the list: ordered ids, origin, and the tier. */
interface CaseNav {
  ids?: string[]
  from?: string
  tier?: 'me' | 'team'
}

/** Support case detail: summary, status/priority, description, dates. */
export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const client = useDataverseClient()
  const queryClient = useQueryClient()
  const { selectedContactId } = useSelectedCompany()

  // Prev/next context from the list (null on a deep link / refresh).
  const nav = (location.state ?? {}) as CaseNav
  const idx = id && nav.ids ? nav.ids.indexOf(id) : -1
  const prevId = idx > 0 ? nav.ids![idx - 1] : undefined
  const nextId = idx >= 0 && nav.ids && idx < nav.ids.length - 1 ? nav.ids[idx + 1] : undefined
  // Step to another case in place (replace) so history stays list → case; back
  // then returns to the list (and its scroll) rather than walking prior cases.
  const goToCase = (target: string) =>
    navigate(`/cases/${target}`, { replace: true, state: nav })
  const goBack = () => (nav.from ? navigate(-1) : navigate('/cases'))

  const query = useQuery({
    queryKey: ['case', id, nav.tier ?? 'auto', selectedContactId ?? 'default'],
    queryFn: () => fetchCaseDetail(client, id!, nav.tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? true
  const loading = query.isLoading
  const error = query.error instanceof Error ? query.error.message : null

  // Notes timeline — only once we know the case (and which tier resolved it).
  const notesQuery = useQuery({
    queryKey: ['casenotes', id, mine, selectedContactId ?? 'default'],
    queryFn: () => listCaseNotes(client, id!, mine),
    enabled: !!id && !!record,
  })
  const notes = notesQuery.data ?? []

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="text-sm font-medium text-white/90 hover:underline"
        >
          ← Support
        </button>
        {(prevId || nextId) && (
          <div className="flex items-center gap-2">
            <NavArrow label="Previous case" dir="prev" disabled={!prevId} onClick={() => prevId && goToCase(prevId)} />
            <NavArrow label="Next case" dir="next" disabled={!nextId} onClick={() => nextId && goToCase(nextId)} />
          </div>
        )}
      </div>

      {loading && <CaseSkeleton />}
      {error && <p className="text-sm text-red-200">{error}</p>}

      {record && (
        <Card className="overflow-hidden">
          <div className="rc-gradient h-1 w-full" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-normal tracking-tight text-rc-navy">
                {record.title || 'Support case'}
              </h1>
              <StatusChip label={record.statuscode_label} />
            </div>
            {!mine && (
              <div className="mt-3 rounded-lg border border-rc-blue-light bg-rc-canvas px-3 py-2 text-xs text-rc-teal">
                This is one of your company's tickets — raised by a colleague, so
                it's shown read-only.
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Meta label="Case number" value={record.ticketnumber || '—'} />
              <Meta label="Priority" value={record.prioritycode_label || '—'} />
              <Meta label="Raised" value={formatDate(record.createdon)} />
              <Meta label="Last updated" value={relativeFromNow(record.modifiedon)} />
            </dl>
            <div className="mt-6">
              <dt className="text-xs font-medium text-rc-teal">Details</dt>
              {mine ? (
                <EditableDescription
                  client={client}
                  caseId={id!}
                  initial={cleanDescription(record.description)}
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ['case', id] })}
                />
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm text-rc-navy">
                  {cleanDescription(record.description) || 'No description provided.'}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {record && (
        <div className="mt-6">
          <h2 className="mb-3 text-xl font-light tracking-tight text-white">Updates</h2>
          {mine && (
            <AddNote
              client={client}
              caseId={id!}
              onAdded={() => {
                queryClient.invalidateQueries({ queryKey: ['casenotes', id] })
                queryClient.invalidateQueries({ queryKey: ['case', id] })
              }}
            />
          )}
          {notesQuery.isLoading ? (
            <NotesSkeleton />
          ) : notes.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-rc-teal">No updates on this ticket yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <Card key={n.annotationid} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium text-rc-navy">{n.subject || 'Update'}</div>
                    <div className="shrink-0 text-xs text-rc-teal" title={formatDate(n.createdon)}>
                      {relativeFromNow(n.createdon)}
                    </div>
                  </div>
                  {cleanDescription(n.notetext) && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-rc-teal">
                      {cleanDescription(n.notetext)}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Inline-editable case description (own tickets only). */
function EditableDescription({
  client,
  caseId,
  initial,
  onSaved,
}: {
  client: DataverseClient
  caseId: string
  initial: string
  onSaved: () => void
}) {
  const [value, setValue] = useState(initial)
  const save = useMutation({
    mutationFn: () => updateCase(client, caseId, { description: value.trim() }),
    onSuccess: onSaved,
  })
  const dirty = value.trim() !== initial.trim()

  return (
    <div className="mt-1">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Add more detail about the issue…"
        className="rc-input w-full resize-y"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
          className="rounded-lg bg-rc-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-40"
        >
          {save.isPending ? 'Saving…' : 'Save changes'}
        </button>
        {save.isError && <span className="text-sm text-red-600">Couldn’t save — try again.</span>}
        {save.isSuccess && !dirty && <span className="text-sm text-rc-green">Saved.</span>}
      </div>
    </div>
  )
}

/** Compose box to post a note/update on your own case. */
function AddNote({
  client,
  caseId,
  onAdded,
}: {
  client: DataverseClient
  caseId: string
  onAdded: () => void
}) {
  const [text, setText] = useState('')
  const add = useMutation({
    mutationFn: () => addCaseNote(client, caseId, { notetext: text }),
    onSuccess: () => {
      setText('')
      onAdded()
    },
  })

  return (
    <Card className="mb-3 p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Add an update or reply…"
        className="rc-input w-full resize-y"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={!text.trim() || add.isPending}
          className="rounded-lg bg-rc-blue px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rc-navy disabled:opacity-40"
        >
          {add.isPending ? 'Posting…' : 'Post update'}
        </button>
        {add.isError && <span className="text-sm text-red-600">Couldn’t post — try again.</span>}
      </div>
    </Card>
  )
}

/** Prev/next stepper arrow, styled like a light control on the gradient. */
function NavArrow({
  label,
  dir,
  disabled,
  onClick,
}: {
  label: string
  dir: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        'flex h-8 w-8 items-center justify-center rounded-lg border text-white transition-colors ' +
        (disabled
          ? 'cursor-not-allowed border-white/15 text-white/30'
          : 'border-white/30 hover:bg-white/10')
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  )
}

/** Shimmer placeholder for the case card while it loads. */
function CaseSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading case">
      <div className="rc-gradient h-1 w-full" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="rc-skeleton h-7 w-1/2 rounded" />
          <div className="rc-skeleton h-6 w-20 rounded-full" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ ['--rc-delay' as string]: `${i * 0.1}s` }} className="space-y-1.5">
              <div className="rc-skeleton h-3 w-2/3 rounded" />
              <div className="rc-skeleton h-4 w-4/5 rounded" />
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <div className="rc-skeleton h-3 w-full rounded" />
          <div className="rc-skeleton h-3 w-11/12 rounded" />
          <div className="rc-skeleton h-3 w-3/4 rounded" />
        </div>
      </div>
    </Card>
  )
}

/** Shimmer placeholder timeline while the updates load — ripples down. */
function NotesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading updates">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ ['--rc-delay' as string]: `${i * 0.14}s` }}
          className="rounded-2xl border border-rc-blue-light bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="rc-skeleton h-4 w-40 rounded" />
            <div className="rc-skeleton h-3 w-16 rounded" />
          </div>
          <div className="mt-2 space-y-2">
            <div className="rc-skeleton h-3 w-full rounded" />
            <div className="rc-skeleton h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-rc-teal">{label}</dt>
      <dd className="mt-0.5 text-sm text-rc-navy">{value}</dd>
    </div>
  )
}
