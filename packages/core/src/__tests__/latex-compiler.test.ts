import { sb2nov } from '../templates/sb2nov'

test('sb2nov preamble suppresses PDF outline panel', () => {
  expect(sb2nov.preamble).toContain('pdfpagemode=UseNone')
})
