import { useState } from 'react'
import { Card, Empty, Stat } from '../../components/dashboard/Card.jsx'
import { Button, Drawer, PageHeader, StatusPill, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import VideoPlayer from '../../components/dashboard/VideoPlayer.jsx'
import { ErrorText, Field, Pills, Select, Textarea, TextInput } from '../../components/ui/Field.jsx'
import { VIDEO_CATEGORIES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import { del, errorMessage, get, patch, post, toFormData } from '../../api/client.js'
import { formatDate, formatDuration, humanize } from '../../utils/format.js'

const SOURCES = [{ id: 'upload', label: 'Upload a file' }, { id: 'external', label: 'YouTube / Vimeo link' }]
const EMPTY = {
  title: '', description: '', category: 'fundraising', tags: '', sourceType: 'upload', file: null, thumbnail: null,
  externalUrl: '', durationSeconds: undefined, resources: [],
}
const MAX_VIDEO_MB = 500
const MAX_THUMB_MB = 5
const mb = (bytes) => bytes / (1024 * 1024)

// Reads a local video file's length so durationSeconds can be saved with the upload
const readDuration = (file) => new Promise((resolve) => {
  const el = document.createElement('video')
  el.preload = 'metadata'
  el.onloadedmetadata = () => { URL.revokeObjectURL(el.src); resolve(Math.round(el.duration) || undefined) }
  el.onerror = () => resolve(undefined)
  el.src = URL.createObjectURL(file)
})

export default function MentorVideos() {
  const state = useApi(() => get('/videos/mine', { limit: 50 }).then((r) => r.data))
  return <Async state={state}>{(list) => <VideosView list={list} reload={state.reload} />}</Async>
}

function VideosView({ list, reload }) {
  const toast = useToast()
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const published = list.filter((v) => v.status === 'published')

  const openDraft = (v) => {
    setError('')
    setProgress(null)
    setConfirmDelete(false)
    setDraft(v ? {
      ...EMPTY, ...v, resources: v.resources ?? [], tags: (v.tags ?? []).join(', '), file: null, thumbnail: null,
      externalUrl: v.sourceType === 'external' ? v.videoUrl : '',
    } : { ...EMPTY })
  }

  const save = async (status) => {
    if (!draft.title.trim()) return setError('Add a title')
    if (draft.sourceType === 'upload' && !draft.file && !(draft._id && draft.videoUrl && !draft.externalUrl)) return setError('Choose a video file')
    if (draft.sourceType === 'external' && !/^https:\/\//.test(draft.externalUrl)) return setError('Paste a full https video link')
    if (draft.file && mb(draft.file.size) > MAX_VIDEO_MB) return setError(`The video is larger than ${MAX_VIDEO_MB} MB. Compress it or share a YouTube / Vimeo link instead.`)
    if (draft.thumbnail && mb(draft.thumbnail.size) > MAX_THUMB_MB) return setError(`The thumbnail is larger than ${MAX_THUMB_MB} MB`)
    const resources = draft.resources.filter((r) => r.name.trim() || r.url.trim())
    if (resources.some((r) => !r.name.trim() || !/^https?:\/\//.test(r.url.trim()))) return setError('Each resource needs a name and a full http(s) link')
    setSaving(true)
    setError('')
    setProgress(null)
    const body = toFormData({
      title: draft.title.trim(), category: draft.category, description: draft.description.trim(),
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status, durationSeconds: draft.durationSeconds,
      video: draft.sourceType === 'upload' ? draft.file : undefined,
      externalUrl: draft.sourceType === 'external' ? draft.externalUrl.trim() : undefined,
      thumbnail: draft.thumbnail,
      resources: resources.map((r) => ({ name: r.name.trim(), url: r.url.trim() })),
    })
    const options = { _onProgress: setProgress }
    try {
      if (draft._id) await patch(`/videos/${draft._id}`, body, options)
      else await post('/videos', body, options)
      setDraft(null)
      toast(status === 'published' ? 'Video published' : 'Saved as draft')
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  const setStatus = async (v, status) => {
    try {
      await patch(`/videos/${v._id}`, { status })
      toast(status === 'archived' ? 'Video archived' : 'Video published')
      reload()
    } catch (err) {
      toast(errorMessage(err), 'error')
    }
  }

  const remove = async (v) => {
    try {
      await del(`/videos/${v._id}`)
      setDraft(null)
      toast('Video deleted')
      reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const pickFile = async (file) => {
    setDraft((d) => ({ ...d, file, durationSeconds: undefined }))
    if (file) {
      const durationSeconds = await readDuration(file)
      setDraft((d) => (d && d.file === file ? { ...d, durationSeconds } : d))
    }
  }

  return (
    <div>
      <PageHeader title="Videos" subtitle="Short lessons founders can watch any time. Published videos appear in every startup's library."
        action={<Button onClick={() => openDraft(null)}>Add video</Button>} />
      <div className="mb-6 grid gap-6 sm:grid-cols-3">
        <Card><Stat value={published.length} label="Published" /></Card>
        <Card><Stat value={published.reduce((s, v) => s + (v.views ?? 0), 0).toLocaleString('en-IN')} label="Total views" /></Card>
        <Card><Stat value={published.reduce((s, v) => s + (v.likesCount ?? 0), 0)} label="Likes" /></Card>
      </div>
      <Card>
        {list.length === 0 ? <Empty>You have not added any videos yet.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((v) => (
              <li key={v._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{v.title}</p>
                  <p className="text-xs text-ink-soft">
                    {[humanize(v.category), v.durationSeconds && formatDuration(v.durationSeconds), v.sourceType === 'external' && 'External link'].filter(Boolean).join(' · ')}
                    {v.status === 'published' && ` · ${(v.views ?? 0).toLocaleString('en-IN')} views · ${v.likesCount ?? 0} likes · ${formatDate(v.publishedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={v.status === 'published' ? 'open' : v.status === 'archived' ? 'closed' : 'draft'} label={humanize(v.status)} />
                  <Button size="sm" variant="ghost" onClick={() => openDraft(v)}>Edit</Button>
                  {v.status === 'published'
                    ? <Button size="sm" variant="ghost" onClick={() => setStatus(v, 'archived')}>Archive</Button>
                    : <Button size="sm" variant="secondary" onClick={() => setStatus(v, 'published')}>Publish</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Drawer open={Boolean(draft)} title={draft?._id ? 'Edit video' : 'Add video'} onClose={() => !saving && setDraft(null)}
        footer={(
          <>
            {error && <ErrorText>{error}</ErrorText>}
            {draft?._id && (confirmDelete
              ? <Button variant="danger" disabled={saving} onClick={() => remove(draft)}>Confirm delete</Button>
              : <Button variant="danger" disabled={saving} onClick={() => setConfirmDelete(true)}>Delete</Button>)}
            <Button variant="ghost" className="mr-auto" disabled={saving} onClick={() => save('draft')}>Save draft</Button>
            <Button disabled={saving} onClick={() => save('published')}>{saving ? (progress !== null && progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Saving...') : 'Publish'}</Button>
          </>
        )}>
        {draft && (
          <div className="grid gap-5">
            {saving && progress !== null && (
              <div role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-sidebar">
                <div className="h-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
            )}
            {draft._id && draft.videoUrl && <VideoPlayer video={draft} />}
            <Field label="Title" htmlFor="vt" required><TextInput id="vt" maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="Category" htmlFor="vc" required>
              <Select id="vc" value={draft.category} options={VIDEO_CATEGORIES.map((c) => ({ id: c, label: humanize(c) }))} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            </Field>
            <Field label="Video" required hint={draft._id && draft.sourceType === 'upload' ? 'Leave empty to keep the current file' : 'MP4, WebM or MOV up to 500 MB'}>
              <Pills label="Source" options={SOURCES} value={draft.sourceType} onChange={(sourceType) => setDraft({ ...draft, sourceType })} />
            </Field>
            {draft.sourceType === 'upload' ? (
              <input aria-label="Video file" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => pickFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:border-glow" />
            ) : (
              <TextInput aria-label="Video link" value={draft.externalUrl} placeholder="https://youtube.com/watch?v=..." onChange={(e) => setDraft({ ...draft, externalUrl: e.target.value })} />
            )}
            {draft.sourceType === 'external' && (
              <p className="-mt-1 text-sm text-ink-soft">Set the video to <strong>Unlisted</strong> on YouTube. Startups only see the player, never your link; private videos won't play.</p>
            )}
            {draft.sourceType === 'external' && (
              <Field label="Length (minutes)" htmlFor="vlen" optional>
                <TextInput id="vlen" type="number" min={0} value={draft.durationSeconds ? Math.round(draft.durationSeconds / 60) : ''}
                  onChange={(e) => setDraft({ ...draft, durationSeconds: e.target.value === '' ? undefined : Number(e.target.value) * 60 })} />
              </Field>
            )}
            <Field label="Thumbnail" htmlFor="vthumb" optional hint="JPG, PNG or WebP">
              <input id="vthumb" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setDraft({ ...draft, thumbnail: e.target.files?.[0] || null })}
                className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink hover:file:border-glow" />
            </Field>
            <Field label="Resources" optional hint="Slides, templates or links shown beside the video (up to 10)">
              <div className="grid gap-2">
                {draft.resources.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <TextInput aria-label="Resource name" value={r.name} placeholder="Pitch deck template" maxLength={100}
                      onChange={(e) => setDraft({ ...draft, resources: draft.resources.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <TextInput aria-label="Resource link" value={r.url} placeholder="https://..."
                      onChange={(e) => setDraft({ ...draft, resources: draft.resources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, resources: draft.resources.filter((_, j) => j !== i) })}>Remove</Button>
                  </div>
                ))}
                {draft.resources.length < 10 && (
                  <div><Button size="sm" variant="secondary" onClick={() => setDraft({ ...draft, resources: [...draft.resources, { name: '', url: '' }] })}>Add resource</Button></div>
                )}
              </div>
            </Field>
            <Field label="Description" htmlFor="vd" optional><Textarea id="vd" rows={4} maxLength={5000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
            <Field label="Tags" htmlFor="vtags" optional hint="Comma separated, up to 15"><TextInput id="vtags" value={draft.tags} placeholder="seed, data room" onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></Field>
          </div>
        )}
      </Drawer>
    </div>
  )
}
