import { describe, test, expect } from 'bun:test'
import { compileToLatex } from '../latex-compiler'
import { sb2nov } from '../../templates/sb2nov'
import type { ResumeDocument } from '../../types'

function makeDoc(overrides: Partial<ResumeDocument> = {}): ResumeDocument {
  return {
    resume_id: 'test-id',
    header: {
      name: 'Adam Smith',
      tagline: 'Security Engineer',
      location: 'Reston, VA',
      email: 'adam@example.com',
      phone: '816-447-6683',
      linkedin: 'https://linkedin.com/in/adam',
      github: 'https://github.com/adam',
      website: null,
      clearance: null,
    },
    sections: [],
    ...overrides,
  }
}

describe('compileToLatex', () => {
  test('output contains \\begin{document} and \\end{document}', () => {
    const latex = compileToLatex(makeDoc(), sb2nov)
    expect(latex).toContain('\\begin{document}')
    expect(latex).toContain('\\end{document}')
  })

  test('header rendered between document begin and sections', () => {
    const latex = compileToLatex(makeDoc(), sb2nov)
    const beginIdx = latex.indexOf('\\begin{document}')
    const headerIdx = latex.indexOf('\\begin{center}')
    const endIdx = latex.indexOf('\\end{document}')
    expect(headerIdx).toBeGreaterThan(beginIdx)
    expect(endIdx).toBeGreaterThan(headerIdx)
  })

  test('preamble contains package declarations', () => {
    const latex = compileToLatex(makeDoc(), sb2nov)
    expect(latex).toContain('\\usepackage[empty]{fullpage}')
    expect(latex).toContain('\\usepackage{titlesec}')
    expect(latex).toContain('\\documentclass[letterpaper,10pt]{article}')
  })

  test('user content with special characters is escaped', () => {
    const doc = makeDoc({
      sections: [{
        id: 's1', type: 'experience', title: 'Experience', display_order: 0,
        items: [{
          kind: 'experience_group', id: 'g1', organization: 'R&D Corp',
          subheadings: [{
            id: 'sh1', title: 'Engineer', date_range: '2024',
            source_id: null,
            bullets: [{ content: 'Saved 80% of $budget', entry_id: 'e1', is_cloned: false }],
          }],
        }],
      }],
    })
    const latex = compileToLatex(doc, sb2nov)
    expect(latex).toContain('R\\&D Corp')
    expect(latex).toContain('80\\% of \\$budget')
  })

  test('URLs in header are NOT escaped', () => {
    const latex = compileToLatex(makeDoc(), sb2nov)
    // Email should not have escaped @ or other chars
    expect(latex).toContain('mailto:adam@example.com')
    // LinkedIn URL should not be escaped
    expect(latex).toContain('https://linkedin.com/in/adam')
    expect(latex).toContain('https://github.com/adam')
  })

  test('section titles appear as \\section{...}', () => {
    const doc = makeDoc({
      sections: [{
        id: 's1', type: 'skills', title: 'Technical Skills', display_order: 0,
        items: [{
          kind: 'skill_group',
          categories: [{ label: 'Languages', skills: ['Python'] }],
        }],
      }],
    })
    const latex = compileToLatex(doc, sb2nov)
    expect(latex).toContain('\\section{Technical Skills}')
  })

  test('experience bullets inside resumeItemListStart/End', () => {
    const doc = makeDoc({
      sections: [{
        id: 's1', type: 'experience', title: 'Experience', display_order: 0,
        items: [{
          kind: 'experience_group', id: 'g1', organization: 'ACME',
          subheadings: [{
            id: 'sh1', title: 'Dev', date_range: '2024',
            source_id: null,
            bullets: [{ content: 'Built things', entry_id: 'e1', is_cloned: false }],
          }],
        }],
      }],
    })
    const latex = compileToLatex(doc, sb2nov)
    expect(latex).toContain('\\resumeItemListStart')
    expect(latex).toContain('\\resumeItem{Built things}')
    expect(latex).toContain('\\resumeItemListEnd')
  })

  test('skills appear inside itemize with \\textbf{label}', () => {
    const doc = makeDoc({
      sections: [{
        id: 's1', type: 'skills', title: 'Skills', display_order: 0,
        items: [{
          kind: 'skill_group',
          categories: [{ label: 'Languages', skills: ['Python', 'Rust'] }],
        }],
      }],
    })
    const latex = compileToLatex(doc, sb2nov)
    expect(latex).toContain('\\textbf{Languages}{: Python, Rust}')
    expect(latex).toContain('\\begin{itemize}[leftmargin=0.15in, label={}]')
  })

  test('escapes organization names with special chars', () => {
    const doc = makeDoc({
      sections: [{
        id: 's1', type: 'experience', title: 'Experience', display_order: 0,
        items: [{
          kind: 'experience_group', id: 'g1', organization: 'Raytheon Intelligence & Space',
          subheadings: [{
            id: 'sh1', title: 'Engineer #1', date_range: '2024',
            source_id: null,
            bullets: [{ content: 'Did work', entry_id: 'e1', is_cloned: false }],
          }],
        }],
      }],
    })
    const latex = compileToLatex(doc, sb2nov)
    expect(latex).toContain('Raytheon Intelligence \\& Space')
    expect(latex).toContain('Engineer \\#1')
  })
})
