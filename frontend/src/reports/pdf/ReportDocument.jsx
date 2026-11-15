import { Document, Link, Page, Text, View } from '@react-pdf/renderer'
import { FONT, INK, MUTED, TEXT } from '../theme.js'
import { Block, FIGURE_TYPES, TABLE_TYPES } from './blocks.jsx'

const pageStyle = {
  backgroundColor: '#FFFFFF', paddingHorizontal: 48, paddingTop: 62, paddingBottom: 62,
  fontFamily: FONT.regular, fontSize: 10.5, color: TEXT,
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// Number sections' sub-headings (2.1, 2.2), tables and figures in reading order
function numberBlocks(sections) {
  let table = 0
  let figure = 0
  return sections.map((s, si) => {
    let sub = 0
    return {
      ...s,
      blocks: s.blocks.map((b) => {
        if (b.type === 'subheading') return { ...b, _n: `${si + 1}.${++sub}` }
        if (TABLE_TYPES.includes(b.type) && b.title) return { ...b, _n: ++table }
        if (FIGURE_TYPES.includes(b.type)) return { ...b, _n: ++figure }
        return b
      }),
    }
  })
}

function RunningHeader({ report }) {
  return (
    <View fixed style={{ position: 'absolute', top: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.75, borderColor: INK, paddingBottom: 4 }}>
      <Text style={{ fontSize: 8.5 }}>{report.title}: {report.startup.name}</Text>
      <Text style={{ fontSize: 8.5, fontFamily: FONT.bold }}>ToolKit</Text>
    </View>
  )
}

function Footer({ report }) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 28, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.75, borderColor: INK, paddingTop: 4 }}>
      <Text style={{ fontSize: 8, color: MUTED }}>Confidential. Prepared for {report.startup.name} on {fmtDate(report.generatedAt)}.</Text>
      <Text style={{ fontSize: 8 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function Cover({ report, sections }) {
  const { startup } = report
  const details = [
    ['Prepared for', startup.name],
    ['Sector', startup.sector],
    ['Stage', startup.stage],
    ['Document', report.title],
    ['Date', fmtDate(report.generatedAt)],
    ['Prepared by', 'ToolKit report generator'],
  ].filter(([, v]) => v)
  return (
    <Page size="A4" style={{ ...pageStyle, paddingTop: 0 }}>
      <View style={{ height: 10, backgroundColor: INK, marginHorizontal: -48 }} />
      <Text style={{ fontFamily: FONT.bold, fontSize: 10, letterSpacing: 2, marginTop: 70 }}>TOOLKIT</Text>
      <Text style={{ fontFamily: FONT.bold, fontSize: 34, lineHeight: 1.1, marginTop: 14 }}>{report.title}</Text>
      {report.subtitle && <Text style={{ fontSize: 13, lineHeight: 1.45, marginTop: 10, color: TEXT }}>{report.subtitle}</Text>}
      <View style={{ borderBottomWidth: 3, borderColor: INK, marginTop: 22, marginBottom: 22 }} />

      <View style={{ borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: INK }}>
        {details.map(([k, v], i) => (
          <View key={k} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: i ? 0.5 : 0, borderColor: '#C8C8C8' }}>
            <Text style={{ width: 130, fontFamily: FONT.bold, fontSize: 10 }}>{k}</Text>
            <Text style={{ flex: 1, fontSize: 10 }}>{v}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontFamily: FONT.bold, fontSize: 12, marginTop: 30, marginBottom: 8 }}>Contents</Text>
      {sections.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ width: 24, fontSize: 10 }}>{i + 1}.</Text>
          <Text style={{ fontSize: 10 }}>{s.title}</Text>
        </View>
      ))}
      {report.sources?.length > 0 && (
        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ width: 24, fontSize: 10 }}>{sections.length + 1}.</Text>
          <Text style={{ fontSize: 10 }}>References</Text>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: 48, left: 48, right: 48 }}>
        {report.sample && (
          <Text style={{ fontFamily: FONT.bold, fontSize: 8.5, marginBottom: 4 }}>
            Sample document. All figures, targets and competitor details are illustrative and not drawn from {startup.name}&apos;s real data.
          </Text>
        )}
        <Text style={{ fontSize: 8, color: MUTED, lineHeight: 1.4 }}>
          This report was generated from the profile and inputs supplied to ToolKit. It is intended to support planning and is not
          financial, legal or investment advice. Verify figures before relying on them.
        </Text>
      </View>
    </Page>
  )
}

function SectionHeading({ n, title }) {
  return (
    <View minPresenceAhead={90} style={{ marginBottom: 10 }}>
      <Text style={{ fontFamily: FONT.bold, fontSize: 16 }}>{n}.  {title}</Text>
      <View style={{ borderBottomWidth: 2, borderColor: INK, marginTop: 4 }} />
    </View>
  )
}

export function ReportDocument({ report }) {
  const sections = numberBlocks(report.sections)
  return (
    <Document title={`${report.title}: ${report.startup.name}`} author="ToolKit" creator="ToolKit">
      <Cover report={report} sections={sections} />
      <Page size="A4" style={pageStyle} wrap>
        <RunningHeader report={report} />
        {sections.map((section, si) => (
          <View key={si} break={si > 0 && section.newPage} style={{ marginBottom: 18 }}>
            <SectionHeading n={si + 1} title={section.title} />
            <View style={{ gap: 6 }}>
              {section.blocks.map((b, bi) => <Block key={bi} block={b} />)}
            </View>
          </View>
        ))}
        {report.sources?.length > 0 && (
          <View>
            <SectionHeading n={sections.length + 1} title="References" />
            {report.sources.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: 24, fontSize: 9.5 }}>[{i + 1}]</Text>
                <Link src={s.url} style={{ flex: 1, fontSize: 9.5, color: INK }}>{s.title}</Link>
              </View>
            ))}
          </View>
        )}
        <Footer report={report} />
      </Page>
    </Document>
  )
}
