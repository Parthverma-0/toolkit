import { fileUrl } from '../../api/client.js'

// YouTube / Vimeo links -> embeddable URL; anything else returns null
const embedUrl = (url) => {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com') {
      if (u.pathname.startsWith('/embed/')) return url
      const id = u.searchParams.get('v') || u.pathname.split('/shorts/')[1]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === 'vimeo.com') return `https://player.vimeo.com/video/${u.pathname.split('/').filter(Boolean)[0]}`
    if (host === 'player.vimeo.com') return url
  } catch { /* not a URL */ }
  return null
}

// Uploaded files play in <video>; external links embed (YouTube / Vimeo) or open in a new tab
export default function VideoPlayer({ video, className = '' }) {
  const box = `aspect-video w-full rounded-2xl bg-ink ${className}`
  if (video.sourceType !== 'external') {
    return <video src={fileUrl(video.videoUrl)} poster={fileUrl(video.thumbnailUrl)} controls preload="metadata" className={box} />
  }
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
