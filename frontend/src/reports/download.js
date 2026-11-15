import { createElement } from 'react'

// Builds the report PDF in the browser. The PDF library is large, so it loads only when needed.
export async function reportBlob(report) {
  const [{ pdf }, { ReportDocument }, { registerReportFonts }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./pdf/ReportDocument.jsx'),
    import('./theme.js'),
  ])
  registerReportFonts()
  return pdf(createElement(ReportDocument, { report })).toBlob()
}

const slug = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

export const reportFileName = (report) =>
  `${[slug(report.title), slug(report.startup?.name), String(report.generatedAt ?? '').slice(0, 10)].filter(Boolean).join('-')}.pdf`

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
