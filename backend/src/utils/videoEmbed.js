// YouTube / Vimeo link -> player-only address (what an <iframe> needs); null for other sites.
// Viewers other than the mentor get this instead of the original link, so Toolkit never hands
// out the (possibly unlisted) video's watch page.
const embedUrl = (url) => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.split('/')[1]}`;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const [, kind, id] = u.pathname.split('/');
      if (['embed', 'shorts', 'live'].includes(kind) && id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const v = u.searchParams.get('v');
      return v ? `https://www.youtube-nocookie.com/embed/${v}` : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts.find((p) => /^\d+$/.test(p));
      // unlisted Vimeo links carry a hash: vimeo.com/ID/HASH
      const hash = parts[parts.indexOf(id) + 1] || u.searchParams.get('h');
      return id ? `https://player.vimeo.com/video/${id}${hash && !/^\d+$/.test(hash) ? `?h=${hash}` : ''}` : null;
    }
  } catch { /* not a URL */ }
  return null;
};

// Plain object safe to send to someone who is not the video's owner
const forViewer = (video) => {
  const obj = typeof video.toObject === 'function' ? video.toObject() : { ...video };
  if (obj.sourceType === 'external') {
    const embed = embedUrl(obj.videoUrl);
    if (embed) obj.videoUrl = embed;
  }
  return obj;
};

module.exports = { embedUrl, forViewer };
