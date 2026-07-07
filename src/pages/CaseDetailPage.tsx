import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DataverseClient } from '@truenorth-it/dataverse-client'
import { useDataverseClient } from '../lib/client'
import { useSelectedCompany } from '../context/SelectedCompanyContext'
import { useListNav } from '../hooks/useListNav'
import { addCaseNote, fetchCaseDetail, listCaseNotes, updateCase } from '../services/caseApi'
import { cleanDescription, formatDate, relativeFromNow } from '../lib/format'
import { Card } from '../components/common/Card'
import { StatusChip } from '../components/common/StatusChip'
import { Skeleton } from '../components/common/Skeleton'
import { MutationTextarea } from '../components/common/MutationTextarea'
import {
  DetailHeader,
  DetailNav,
  DetailStates,
  MetaGrid,
  MetaItem,
  SectionTitle,
} from '../components/detail/DetailChrome'

/** Support case detail: summary, status/priority, description, notes timeline. */
export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const client = useDataverseClient()
  const queryClient = useQueryClient()
  const { selectedCompanyId, currentCompany } = useSelectedCompany()
  const { tier, prevId, nextId, goPrev, goNext, goBack } = useListNav('/cases', id)

  const query = useQuery({
    queryKey: ['case', id, tier ?? 'auto', selectedCompanyId ?? 'default'],
    queryFn: () => fetchCaseDetail(client, id!, tier),
    enabled: !!id,
  })
  const record = query.data?.record ?? null
  const mine = query.data?.mine ?? true
  const error = query.error instanceof Error ? query.error.message : null

  // Notes timeline — only once we know the case (and which tier resolved it).
  const notesQuery = useQuery({
    queryKey: ['casenotes', id, mine, selectedCompanyId ?? 'default'],
    queryFn: () => listCaseNotes(client, id!, mine),
    enabled: !!id && !!record,
  })
  const notes = notesQuery.data ?? []

  return (
    <div>
      <DetailNav
        label="Support"
        prevId={prevId}
        nextId={nextId}
        onPrev={goPrev}
        onNext={goNext}
        onBack={goBack}
      />

      <DetailStates loading={query.isLoading} error={error} onBack={goBack} backLabel="Support" companyName={currentCompany?.companyName}>
        {record && (
          <>
            <DetailHeader
              icon="fileText"
              title={record.title || 'Support case'}
              trailing={<StatusChip label={record.statuscode_label} />}
            >
              {!mine && (
                <div className="mt-3 rounded-lg border border-rc-blue-light bg-rc-canvas px-3 py-2 text-xs text-rc-teal">
                  This is one of your company's tickets — raised by a colleague, so
                  it's shown read-only.
                </div>
              )}
              <MetaGrid>
                <MetaItem icon="hash" label="Case number" value={record.ticketnumber} />
                <MetaItem icon="flag" label="Priority" value={record.prioritycode_label} />
                <MetaItem icon="calendar" label="Raised" value={formatDate(record.createdon)} />
                <MetaItem icon="clock" label="Last updated" value={relativeFromNow(record.modifiedon)} />
              </MetaGrid>
              <div className="mt-6">
                <div className="text-xs font-medium text-rc-teal">Details</div>
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
            </DetailHeader>

            <div className="mt-6">
              <SectionTitle icon="clock">Updates</SectionTitle>
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
          </>
        )}
      </DetailStates>
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
    <MutationTextarea
      className="mt-1"
      value={value}
      onChange={setValue}
      onSubmit={() => save.mutate()}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      pending={save.isPending}
      disabled={!dirty}
      placeholder="Add more detail about the issue…"
      error={save.isError ? 'Couldn’t save — try again.' : null}
      success={save.isSuccess && !dirty ? 'Saved.' : null}
    />
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
      <MutationTextarea
        value={text}
        onChange={setText}
        onSubmit={() => add.mutate()}
        submitLabel="Post update"
        pendingLabel="Posting…"
        pending={add.isPending}
        disabled={!text.trim()}
        rows={3}
        placeholder="Add an update or reply…"
        error={add.isError ? 'Couldn’t post — try again.' : null}
      />
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
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mt-2 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
