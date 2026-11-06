import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, Empty } from '../../components/dashboard/Card.jsx'
import { Button, Chips, PageHeader, SearchInput, useToast } from '../../components/dashboard/ui.jsx'
import Async from '../../components/dashboard/Async.jsx'
import VideoPlayer from '../../components/dashboard/VideoPlayer.jsx'
import { VIDEO_CATEGORIES } from '../../constants/enums.js'
import useApi from '../../hooks/useApi.js'
import useDebounced from '../../hooks/useDebounced.js'
import { errorMessage, fileUrl, get, post } from '../../api/client.js'
import { formatDate, formatDuration, humanize } from '../../utils/format.js'

const CATEGORIES = [{ id: 'all', label: 'All' }, ...VIDEO_CATEGORIES.map((c) => ({ id: c, label: humanize(c) }))]

// Thumbnail image when the mentor uploaded one, otherwise a plain gradient
const Thumb = ({ video, className = '' }) => (
  <div className={`relative flex aspect-video items-end overflow-hidden rounded-xl bg-gradient-to-br from-brand to-glow p-3 ${className}`}>
    {video.thumbnailUrl && <img src={fileUrl(video.thumbnailUrl)} alt="" className="absolute inset-0 size-full object-cover" />}
    {video.durationSeconds > 0 && (
      <span className="relative rounded-md bg-ink/70 px-1.5 py-0.5 text-[11px] font-medium text-white">{formatDuration(video.durationSeconds)}</span>
    )}
  </div>
)

export default function Videos() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const q = useDebounced(query.trim(), 300)
  const state = useApi(() => get('/videos', {
    limit: 48, q: q || undefined, category: category === 'all' ? undefined : category,
  }).then((r) => r.data), [q, category])

  return (
    <div>
      <PageHeader title="Videos" subtitle="Short lessons from mentors on fundraising, GTM, product, legal and more." />
      <div className="mb-5 grid gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search videos" />
        <Chips options={CATEGORIES} value={category} onChange={setCategory} />
      </div>
      <Async state={state}>
        {(list) => (list.length === 0 ? <Card><Empty>No videos match these filters.</Empty></Card> : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((v) => (
              <Link key={v._id} to={`/startup/videos/${v._id}`} className="group rounded-2xl border border-line bg-white p-3 transition hover:shadow-[0_18px_50px_-30px_rgba(30,64,175,0.5)]">
                <Thumb video={v} />
                <div className="px-1 pt-3 pb-1">
                  <p className="font-semibold text-ink group-hover:text-brand">{v.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">{v.mentor?.name} · {humanize(v.category)} · {(v.views ?? 0).toLocaleString('en-IN')} views</p>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </Async>
    </div>
  )
}

export function VideoDetail() {
  const { id } = useParams()
  const state = useApi(() => get(`/videos/${id}`).then((r) => r.data), [id])
  return (
    <div>
      <Link to="/startup/videos" className="text-sm font-medium text-brand hover:text-brand-dark">Back to videos</Link>
      <div className="mt-4">
        <Async state={state}>{(video) => <VideoView key={video._id} video={video} />}</Async>
      </div>
    </div>
  )
}

function VideoView({ video }) {
  const toast = useToast()
  const [like, setLike] = useState({ likedByMe: video.likedByMe, likesCount: video.likesCount ?? 0 })
  const [busy, setBusy] = useState(false)
  const related = useApi(() => get('/videos', { category: video.category, limit: 4 })
    .then((r) => r.data.filter((v) => v._id !== video._id).slice(0, 3)), [video._id])

  const toggleLike = async () => {
    setBusy(true)
    try {
      setLike((await post(`/videos/${video._id}/like`)).data)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <VideoPlayer video={video} />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">{video.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {[video.mentor?.name, humanize(video.category), video.durationSeconds && formatDuration(video.durationSeconds), video.publishedAt && formatDate(video.publishedAt)]
              .filter(Boolean).join(' · ')}
          </p>
          <Button size="sm" variant={like.likedByMe ? 'primary' : 'secondary'} disabled={busy} onClick={toggleLike}>
            {like.likedByMe ? 'Liked' : 'Like'} · {like.likesCount}
          </Button>
        </div>
        {video.description && (
          <Card className="mt-5">
            <p className="text-sm whitespace-pre-line text-ink">{video.description}</p>
          </Card>
        )}
      </div>
      <div className="grid content-start gap-6">
        <Card title="Resources">
          {video.resources?.length ? (
            <ul className="grid gap-2">
              {video.resources.map((r) => (
                <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand hover:underline">{r.name}</a></li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">No attachments for this video.</p>}
        </Card>
        {related.data?.length > 0 && (
          <Card title="More on this topic">
            <ul className="grid gap-3">
              {related.data.map((v) => (
                <li key={v._id}><Link to={`/startup/videos/${v._id}`} className="text-sm font-medium text-ink hover:text-brand">{v.title}</Link></li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
