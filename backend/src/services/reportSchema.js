// The report format the AI must return, and a sanitizer that forces any AI output into it.
// The frontend PDF renderer (frontend/src/reports/pdf/blocks.jsx) draws exactly these block types.

const SCHEMA_TEXT = `Return ONE JSON object, nothing else:
{
  "title": string,                       // the tool name, e.g. "Marketing Plan"
  "subtitle": string,                    // one sentence describing this specific report
  "sections": [ { "title": string, "blocks": [ Block, ... ] } ]
}

Block is one of:
{ "type": "text", "paragraphs": [string, ...] }                       // body text, 2-5 sentences per paragraph
{ "type": "subheading", "text": string }                               // numbered automatically
{ "type": "bullets", "items": [string | { "label": string, "text": string }] }
{ "type": "numbered", "items": [string | { "label": string, "text": string }] }
{ "type": "note", "title": string, "body": string }                   // one boxed key point; at most one per section
{ "type": "keyvalue", "title": string, "items": [{ "label": string, "value": string }] }
{ "type": "table", "title": string, "columns": [string], "rows": [[string]], "widths": [number], "note": string }
      // every row has exactly as many cells as columns; widths are relative column widths (optional)
{ "type": "bars", "title": string, "note": string, "unit": string, "max": number, "items": [{ "label": string, "value": number }] }
{ "type": "columns", "title": string, "note": string, "unit": string, "labels": [string], "series": [{ "name": string, "values": [number] }] }
      // vertical bars by period, 1-3 series, each series has one value per label
{ "type": "line", "title": string, "note": string, "unit": string, "labels": [string], "series": [{ "name": string, "values": [number] }] }`;

const TYPES = ['text', 'subheading', 'bullets', 'numbered', 'note', 'keyvalue', 'table', 'bars', 'columns', 'line'];

// The PDF uses the built-in Helvetica font, which only has Western European characters
const CHAR_MAP = { '₹': 'INR ', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '≈': '~', '×': 'x', '✓': '', '✔': '', '✗': '', '•': '-', ' ': ' ' };
const clean = (v, max = 2000) => {
  if (v === undefined || v === null) return '';
  let s = String(v);
  s = s.replace(/[₹→←≥≤≈×✓✔✗• ]/g, (c) => CHAR_MAP[c]);
  s = s.replace(/INR[ \t]+/g, 'INR ').replace(/\*\*(.+?)\*\*/g, '$1'); // stray markdown bold
  s = s.replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ–—‘’“”…]/g, '');
  return s.trim().slice(0, max);
};
const arr = (v, max = 50) => (Array.isArray(v) ? v.slice(0, max) : []);
const num = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const listItem = (it) => (it && typeof it === 'object'
  ? { label: clean(it.label, 120), text: clean(it.text ?? it.value ?? it.body) }
  : clean(it));

const SANITIZE = {
  text: (b) => ({ paragraphs: arr(b.paragraphs ?? [b.body ?? b.text], 12).map((p) => clean(p, 3000)).filter(Boolean) }),
  subheading: (b) => ({ text: clean(b.text ?? b.title, 160) }),
  bullets: (b) => ({ items: arr(b.items, 20).map(listItem).filter((i) => (typeof i === 'string' ? i : i.text || i.label)) }),
  numbered: (b) => ({ items: arr(b.items, 20).map(listItem).filter((i) => (typeof i === 'string' ? i : i.text || i.label)) }),
  note: (b) => ({ title: clean(b.title || 'Key point', 120), body: clean(b.body ?? b.text, 1200) }),
  keyvalue: (b) => ({ title: clean(b.title, 160), items: arr(b.items, 20).map((i) => ({ label: clean(i?.label, 120), value: clean(i?.value, 600) })).filter((i) => i.label) }),
  table: (b) => {
    const columns = arr(b.columns, 8).map((c) => clean(c, 60));
    const rows = arr(b.rows, 40).map((r) => {
      const cells = arr(Array.isArray(r) ? r : Object.values(r || {}), columns.length).map((c) => clean(c, 600));
      while (cells.length < columns.length) cells.push('');
      return cells;
    });
    const widths = arr(b.widths, columns.length).map(num);
    return {
      title: clean(b.title, 160), note: clean(b.note, 300), columns, rows,
      ...(widths.length === columns.length && widths.every((w) => w > 0) ? { widths } : {}),
    };
  },
  bars: (b) => ({
    title: clean(b.title, 160), note: clean(b.note, 300), unit: clean(b.unit, 12),
    ...(num(b.max) > 0 ? { max: num(b.max) } : {}),
    items: arr(b.items, 12).map((i) => ({ label: clean(i?.label, 60), value: num(i?.value) })),
  }),
  columns: (b) => series(b, 12),
  line: (b) => series(b, 36),
};

function series(b, maxLabels) {
  const labels = arr(b.labels, maxLabels).map((l) => clean(l, 20));
  return {
    title: clean(b.title, 160), note: clean(b.note, 300), unit: clean(b.unit, 12), labels,
    series: arr(b.series, 3).map((s) => ({
      name: clean(s?.name, 40),
      values: labels.map((_, i) => num(arr(s?.values, maxLabels)[i])),
    })),
  };
}

// A block survives only if it still has something to show after cleaning
const hasContent = (b) => {
  switch (b.type) {
    case 'text': return b.paragraphs.length > 0;
    case 'subheading': return Boolean(b.text);
    case 'note': return Boolean(b.body);
    case 'table': return b.columns.length > 0 && b.rows.length > 0;
    case 'bars': return b.items.length > 0;
    case 'columns': case 'line': return b.labels.length > 0 && b.series.length > 0;
    default: return (b.items || []).length > 0;
  }
};

function sanitizeReport(raw, fallbackTitle) {
  const sections = arr(raw?.sections, 20).map((s) => ({
    title: clean(s?.title, 120),
    blocks: arr(s?.blocks, 30)
      .filter((b) => b && TYPES.includes(b.type))
      .map((b) => ({ type: b.type, ...SANITIZE[b.type](b) }))
      .filter(hasContent),
  })).filter((s) => s.title && s.blocks.length);
  return {
    title: clean(raw?.title, 120) || fallbackTitle,
    subtitle: clean(raw?.subtitle, 300),
    sections,
  };
}

// Model output -> object. Tolerates code fences and text around the JSON.
function parseJson(text) {
  const stripped = String(text).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(stripped); } catch { /* try the outermost braces */ }
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(stripped.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

module.exports = { SCHEMA_TEXT, sanitizeReport, parseJson, clean };
