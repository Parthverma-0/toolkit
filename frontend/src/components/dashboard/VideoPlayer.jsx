import { useState } from 'react'
import { fileUrl } from '../../api/client.js'

// YouTube / Vimeo links -> embeddable URL; anything else returns null
const embedUrl = (url) => {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname.startsWith('/embed/')) return url
      const id = u.searchParams.get('v') || u.pathname.split(/\/(?:shorts|live)\//)[1]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`
    if (host === 'player.vimeo.com') return url
  } catch { /* not a URL */ }
  return null
}

const isCloudVideo = (url) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(url || '')
// Cloudinary delivery URL with a transformation (inserted right after /upload/)
const transformed = (url, transformation, ext) => url.replace('/upload/', `/upload/${transformation}/`).replace(/\.[a-z0-9]+$/i, `.${ext}`)

// Uploaded files play in <video> (falling back to an H.264 MP4 copy when the browser can't
// play the original, e.g. iPhone .mov files); external links embed (YouTube / Vimeo) or open in a new tab
function UploadedPlayer({ video, box }) {
  const [fallback, setFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const cloud = isCloudVideo(video.videoUrl)
  const src = cloud && fallback ? transformed(video.videoUrl, 'f_mp4,vc_h264,q_auto', 'mp4') : fileUrl(video.videoUrl)
  const poster = video.thumbnailUrl ? fileUrl(video.thumbnailUrl) : cloud ? transformed(video.videoUrl, 'so_0', 'jpg') : undefined

  if (failed) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white`}>
        <p>This video can't be played right now. It may still be processing.</p>
        <a href={fileUrl(video.videoUrl)} target="_blank" rel="noreferrer" className="font-semibold underline">Open the file</a>
      </div>
    )
  }
  return (
    <video key={src} src={src} poster={poster} controls preload="metadata" playsInline className={box}
      onError={() => (cloud && !fallback ? setFallback(true) : setFailed(true))} />
  )
}

export default function VideoPlayer({ video, className = '' }) {
  const box = `aspect-video w-full rounded-2xl bg-ink ${className}`
  if (video.sourceType !== 'external') return <UploadedPlayer video={video} box={box} />
  const embed = embedUrl(video.videoUrl)
  if (embed) {
    return <iframe src={embed} title={video.title} className={box} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
  }
  return (
    <a href={video.videoUrl} target="_blank" rel="noreferrer" className={`${box} flex items-center justify-center text-base font-semibold text-white hover:underline`}>
      Watch on the original site
    </a>
  )
}
