import { Font } from '@react-pdf/renderer'

// Formal report theme: black text on white, bold black headings, thin rules.
// Uses the PDF built-in Helvetica family, so nothing has to be downloaded.
// Built-in fonts have no ₹ glyph: write amounts as "INR".

export const INK = '#000000'
export const TEXT = '#111111'
export const MUTED = '#555555'
export const RULE_LIGHT = '#C8C8C8'
export const WHITE = '#FFFFFF'
// Chart fills, darkest first
export const FILLS = ['#000000', '#6E6E6E', '#B4B4B4']

export const FONT = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' }

let registered = false
export function registerReportFonts() {
  if (registered) return
  registered = true
  // Whole words only: no "Invest-ors" splits in narrow table cells
  Font.registerHyphenationCallback((word) => [word])
}
