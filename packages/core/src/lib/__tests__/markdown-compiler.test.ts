import { describe, test, expect } from 'bun:test'
import { compileToMarkdown } from '../markdown-compiler'
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

describe('compileToMarkdown', () => {
  test('renders header with name, tagline, and contact', () => {
    const md = compileToMarkdown(makeDoc())
    expect(md).toContain('# Adam Smith')
    expect(md).toContain('Security Engineer')
    expect(md).toContain('Reston, VA')
    expect(md).toContain('adam@example.com')
    expect(md).toContain('[LinkedIn](https://linkedin.com/in/adam)')
    expect(md).toContain('[GitHub](https://github.com/adam)')
  })

  test('renders summary section', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'summary', title: 'Summary', display_order: 0,
        items: [{ kind: 'summary', content: 'Senior security engineer', entry_id: 'e1' }],
      }],
    }))
    expect(md).toContain('## Summary')
    expect(md).toContain('Senior security engineer')
  })

  test('renders experience with org, role, dates, bullets', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'experience', title: 'Experience', display_order: 0,
        items: [{
          kind: 'experience_group', id: 'g1', organization: 'Raytheon',
          subheadings: [{
            id: 'sh1', title: 'Principal Engineer', date_range: 'Mar 2024 - Jul 2025',
            source_id: null,
            bullets: [
              { content: 'Built cloud forensics platform', entry_id: 'e1', is_cloned: false },
              { content: 'Developed detection rules', entry_id: 'e2', is_cloned: false },
            ],
          }],
        }],
      }],
    }))
    expect(md).toContain('## Experience')
    expect(md).toContain('### Raytheon')
    expect(md).toContain('**Principal Engineer** | Mar 2024 - Jul 2025')
    expect(md).toContain('- Built cloud forensics platform')
    expect(md).toContain('- Developed detection rules')
  })

  test('renders skills as label: items', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'skills', title: 'Technical Skills', display_order: 0,
        items: [{
          kind: 'skill_group',
          categories: [
            { label: 'Languages', skills: ['Python', 'Rust', 'Go'] },
            { label: 'DevSecOps', skills: ['Kubernetes', 'Terraform'] },
          ],
        }],
      }],
    }))
    expect(md).toContain('**Languages**: Python, Rust, Go')
    expect(md).toContain('**DevSecOps**: Kubernetes, Terraform')
  })

  test('renders education with institution and degree', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'education', title: 'Education', display_order: 0,
        items: [{
          kind: 'education', institution: 'Western Governors University',
          degree: 'B.S. Cybersecurity', date: '2023', entry_id: 'e1', source_id: 's1',
        }],
      }],
    }))
    expect(md).toContain('**Western Governors University**')
    expect(md).toContain('B.S. Cybersecurity | 2023')
  })

  test('renders projects with name and bullets', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'projects', title: 'Selected Projects', display_order: 0,
        items: [{
          kind: 'project', name: 'AI Memory Architecture', date: '2024',
          entry_id: 'e1', source_id: 's1',
          bullets: [{ content: 'Designed graph-based memory system', entry_id: 'e1', is_cloned: false }],
        }],
      }],
    }))
    expect(md).toContain('### AI Memory Architecture | 2024')
    expect(md).toContain('- Designed graph-based memory system')
  })

  test('renders clearance as plain text', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'clearance', title: 'Security Clearance', display_order: 0,
        items: [{ kind: 'clearance', content: 'TS/SCI with CI Polygraph - Active', entry_id: 'e1', source_id: 's1' }],
      }],
    }))
    expect(md).toContain('## Security Clearance')
    expect(md).toContain('TS/SCI with CI Polygraph - Active')
  })

  test('renders presentations with title, venue, bullets', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'presentations', title: 'Presentations', display_order: 0,
        items: [{
          kind: 'presentation', title: 'Backdoors in LLMs', venue: 'Pacific Hackers Assoc', date: '2024',
          entry_id: 'e1', source_id: 's1',
          bullets: [{ content: 'Presented attack taxonomy', entry_id: 'e1', is_cloned: false }],
        }],
      }],
    }))
    expect(md).toContain('### Backdoors in LLMs | Pacific Hackers Assoc, 2024')
    expect(md).toContain('- Presented attack taxonomy')
  })

  test('escapes special characters in content', () => {
    const md = compileToMarkdown(makeDoc({
      sections: [{
        id: 's1', type: 'summary', title: 'Summary', display_order: 0,
        items: [{ kind: 'summary', content: 'See [docs] at path\\ref', entry_id: 'e1' }],
      }],
    }))
    expect(md).toContain('See \\[docs\\] at path\\\\ref')
  })

  test('empty sections are skipped (no sections in output)', () => {
    const md = compileToMarkdown(makeDoc({ sections: [] }))
    expect(md).not.toContain('## ')
  })

  test('output ends with newline', () => {
    const md = compileToMarkdown(makeDoc())
    expect(md.endsWith('\n')).toBe(true)
  })
})
