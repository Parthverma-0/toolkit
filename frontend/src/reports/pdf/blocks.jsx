import { G, Line, Polyline, Svg, Text, View } from '@react-pdf/renderer'
import { FILLS, FONT, INK, MUTED, RULE_LIGHT, TEXT } from '../theme.js'

// A report is a list of sections; each section is a list of blocks: { type, ...data }.
// The AI fills the data, these components draw it. Unknown types are skipped.
// Tables and figures get numbers (_n) from ReportDocument.

export const CONTENT_WIDTH = 499 // A4 width minus 48pt margins

const body = { fontFamily: FONT.regular, fontSize: 10.5, lineHeight: 1.55, color: TEXT }
const fmt = (v, unit = '') => (typeof v === 'number' ? `${v.toLocaleString('en-IN')}${unit}` : `${v ?? ''}${unit}`)

const TableCaption = ({ n, title }) => (title ? (
  <Text style={{ fontFamily: FONT.bold, fontSize: 9.5, marginBottom: 5 }}>Table {n}. <Text style={{ fontFamily: FONT.regular }}>{title}</Text></Text>
) : null)

const FigureCaption = ({ n, title, note }) => (
  <View style={{ marginTop: 6 }}>
    {title && <Text style={{ fontFamily: FONT.bold, fontSize: 9.5 }}>Figure {n}. <Text style={{ fontFamily: FONT.regular }}>{title}</Text></Text>}
    {note && <Text style={{ fontFamily: FONT.italic, fontSize: 8.5, color: MUTED, marginTop: 2 }}>{note}</Text>}
  </View>
)

/* ---------- Text ---------- */
function Paragraphs({ paragraphs = [], body: one }) {
  const list = paragraphs.length ? paragraphs : [one]
  return (
    <View>
      {list.filter(Boolean).map((p, i) => <Text key={i} style={{ ...body, textAlign: 'justify', marginBottom: 7 }}>{p}</Text>)}
    </View>
  )
}

function Subheading({ text, _n }) {
  return (
    <Text minPresenceAhead={60} style={{ fontFamily: FONT.bold, fontSize: 11.5, marginTop: 4, marginBottom: 5 }}>
      {_n ? `${_n}  ` : ''}{text}
    </Text>
  )
}

// items: strings, or { label, text } to start the line with a bold label
function List({ items = [], ordered = false }) {
  return (
    <View style={{ marginBottom: 4 }}>
      {items.map((it, i) => (
        <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 6 }}>
          <Text style={{ ...body, width: ordered ? 18 : 12 }}>{ordered ? `${i + 1}.` : '•'}</Text>
          <Text style={{ ...body, flex: 1 }}>
            {typeof it === 'string' ? it : <><Text style={{ fontFamily: FONT.bold }}>{it.label}. </Text>{it.text}</>}
          </Text>
        </View>
      ))}
    </View>
  )
}
const Bullets = (props) => <List {...props} />
const Numbered = (props) => <List {...props} ordered />

// A boxed key point. Used sparingly: one or two per report.
function Note({ title = 'Key point', body: text }) {
  return (
    <View wrap={false} style={{ borderWidth: 1, borderColor: INK, borderLeftWidth: 4, paddingVertical: 8, paddingHorizontal: 10, marginVertical: 4 }}>
      <Text style={{ fontFamily: FONT.bold, fontSize: 10, marginBottom: 3 }}>{title}</Text>
      <Text style={{ ...body, fontSize: 10 }}>{text}</Text>
    </View>
  )
}

// Label / value pairs: targets, assumptions, facts
function KeyValue({ title, _n, items = [] }) {
  return (
    <View wrap={false} style={{ marginVertical: 4 }}>
      <TableCaption n={_n} title={title} />
      <View style={{ borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: INK }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderTopWidth: i ? 0.5 : 0, borderColor: RULE_LIGHT }}>
            <Text style={{ width: '38%', fontFamily: FONT.bold, fontSize: 9.5, paddingRight: 8 }}>{it.label}</Text>
            <Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.4 }}>{it.value}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/* ---------- Table: heavy rules top and bottom, light rules between rows ---------- */
function Table({ title, _n, note, columns = [], rows = [], widths }) {
  const w = widths ?? columns.map(() => 1)
  return (
    <View style={{ marginVertical: 4 }}>
      <View wrap={false} minPresenceAhead={40}>
        <TableCaption n={_n} title={title} />
        <View style={{ flexDirection: 'row', borderTopWidth: 1.5, borderBottomWidth: 1, borderColor: INK }}>
          {columns.map((c, i) => (
            <Text key={i} style={{ flex: w[i], fontFamily: FONT.bold, fontSize: 9, paddingVertical: 5, paddingRight: 6 }}>{c}</Text>
          ))}
        </View>
      </View>
      {rows.map((r, ri) => (
        <View key={ri} wrap={false} style={{ flexDirection: 'row', borderBottomWidth: ri === rows.length - 1 ? 1.5 : 0.5, borderColor: ri === rows.length - 1 ? INK : RULE_LIGHT }}>
          {r.map((cell, ci) => (
            <Text key={ci} style={{ flex: w[ci], fontSize: 9, lineHeight: 1.4, paddingVertical: 5, paddingRight: 6, fontFamily: ci === 0 ? FONT.bold : FONT.regular }}>{cell}</Text>
          ))}
        </View>
      ))}
      {note && <Text style={{ fontFamily: FONT.italic, fontSize: 8.5, color: MUTED, marginTop: 4 }}>{note}</Text>}
    </View>
  )
}

/* ---------- Horizontal bars ---------- */
function Bars({ title, _n, note, items = [], max, unit = '' }) {
  const top = max ?? Math.max(...items.map((i) => i.value || 0), 1)
  return (
    <View wrap={false} style={{ marginVertical: 6 }}>
      <View style={{ gap: 6 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 150, fontSize: 9, paddingRight: 8 }}>{it.label}</Text>
            <View style={{ flex: 1, height: 11, borderLeftWidth: 1, borderColor: INK }}>
              <View style={{ width: `${Math.max(1, Math.min(100, ((it.value || 0) / top) * 100))}%`, height: '100%', backgroundColor: INK }} />
            </View>
            <Text style={{ width: 54, fontSize: 9, textAlign: 'right', fontFamily: FONT.bold }}>{fmt(it.value, unit)}</Text>
          </View>
        ))}
      </View>
      <FigureCaption n={_n} title={title} note={note} />
    </View>
  )
}

/* ---------- Vertical columns (sales by period); up to 3 series ---------- */
function Columns({ title, _n, note, labels = [], series = [], unit = '', height = 150 }) {
  const top = Math.max(...series.flatMap((s) => s.values), 1)
  return (
    <View wrap={false} style={{ marginVertical: 6 }}>
      {series.length > 1 && <Legend series={series} />}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + 16, borderBottomWidth: 1, borderColor: INK }}>
        {labels.map((_, li) => (
          <View key={li} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}>
            {series.map((s, si) => (
              <View key={si} style={{ alignItems: 'center', width: Math.min(34, 60 / series.length) }}>
                <Text style={{ fontSize: 7.5, marginBottom: 2 }}>{fmt(s.values[li], unit)}</Text>
                <View style={{ width: '100%', height: Math.max(1, (height * (s.values[li] || 0)) / top), backgroundColor: FILLS[si % FILLS.length] }} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {labels.map((l, i) => <Text key={i} style={{ flex: 1, fontSize: 8.5, textAlign: 'center' }}>{l}</Text>)}
      </View>
      <FigureCaption n={_n} title={title} note={note} />
    </View>
  )
}

/* ---------- Line chart (trend over time); first series solid, others dashed ---------- */
function LineChart({ title, _n, note, labels = [], series = [], unit = '' }) {
  const W = CONTENT_WIDTH - 44
  const H = 150
  const top = Math.max(...series.flatMap((s) => s.values), 1) * 1.1
  const xAt = (i) => (labels.length > 1 ? 6 + ((W - 12) * i) / (labels.length - 1) : W / 2)
  const yAt = (v) => H - (H * v) / top
  return (
    <View wrap={false} style={{ marginVertical: 6 }}>
      {series.length > 1 && <Legend series={series} line />}
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 40, height: H, justifyContent: 'space-between', paddingRight: 4 }}>
          <Text style={{ fontSize: 7.5, textAlign: 'right' }}>{fmt(Math.round(top), unit)}</Text>
          <Text style={{ fontSize: 7.5, textAlign: 'right' }}>{fmt(Math.round(top / 2), unit)}</Text>
          <Text style={{ fontSize: 7.5, textAlign: 'right' }}>0</Text>
        </View>
        <View style={{ borderLeftWidth: 1, borderBottomWidth: 1, borderColor: INK }}>
          <Svg width={W} height={H}>
            <Line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke={RULE_LIGHT} strokeWidth={0.5} />
            {series.map((s, si) => (
              <G key={si}>
                <Polyline
                  points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
                  stroke={si === 0 ? INK : FILLS[1]} strokeWidth={si === 0 ? 1.8 : 1.4} fill="none"
                  {...(si > 0 ? { strokeDasharray: '4 3' } : {})}
                />
              </G>
            ))}
          </Svg>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 40, marginTop: 3 }}>
        {labels.map((l, i) => <Text key={i} style={{ flex: 1, fontSize: 7.5, textAlign: i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center' }}>{l}</Text>)}
      </View>
      <FigureCaption n={_n} title={title} note={note} />
    </View>
  )
}

function Legend({ series, line = false }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 6 }}>
      {series.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {line
            ? <View style={{ width: 16, borderTopWidth: i === 0 ? 1.8 : 1.4, borderColor: i === 0 ? INK : FILLS[1], borderStyle: i === 0 ? 'solid' : 'dashed' }} />
            : <View style={{ width: 9, height: 9, backgroundColor: FILLS[i % FILLS.length] }} />}
          <Text style={{ fontSize: 8.5 }}>{s.name}</Text>
        </View>
      ))}
    </View>
  )
}

const BLOCKS = {
  text: Paragraphs, subheading: Subheading, bullets: Bullets, numbered: Numbered, note: Note,
  keyvalue: KeyValue, table: Table, bars: Bars, columns: Columns, line: LineChart,
}
export const TABLE_TYPES = ['table', 'keyvalue']
export const FIGURE_TYPES = ['bars', 'columns', 'line']
export const BLOCK_TYPES = Object.keys(BLOCKS)

export function Block({ block }) {
  const Component = block && BLOCKS[block.type]
  return Component ? <Component {...block} /> : null
}
