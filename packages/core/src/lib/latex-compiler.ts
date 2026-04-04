/**
 * IR -> LaTeX compiler.
 *
 * Pure function: takes a ResumeDocument and a LatexTemplate, returns
 * a complete LaTeX document string. All user-authored content is
 * escaped via escapeLatex() before being passed to template functions.
 *
 * IMPORTANT: Template structural strings (commands, environments) are
 * NOT escaped. Only the content fields from the IR are escaped.
 */

import type {
  ResumeDocument,
  LatexTemplate,
  IRSection,
  ResumeHeader,
  IRSectionItem,
} from '../types'
import { escapeLatex } from './escape'

export function compileToLatex(doc: ResumeDocument, template: LatexTemplate): string {
  // 1. Escape all user content in the IR (deep clone + escape)
  const escaped = escapeIR(doc)

  // 2. Assemble document
  const parts: string[] = []
  parts.push(template.preamble)
  parts.push('')
  parts.push('\\begin{document}')
  parts.push('')
  parts.push(template.renderHeader(escaped.header))
  parts.push('')

  for (const section of escaped.sections) {
    // Skip sections with no items — empty \resumeSubHeadingListStart/End
    // causes "missing \item" LaTeX errors
    if (section.items.length === 0) continue
    parts.push(template.renderSection(section))
    parts.push('')
  }

  parts.push(template.footer)

  return parts.join('\n')
}

/**
 * Deep-clone the IR and escape all user-authored string fields.
 * Returns a new ResumeDocument with escaped content.
 */
function escapeIR(doc: ResumeDocument): ResumeDocument {
  return {
    resume_id: doc.resume_id,
    header: escapeHeader(doc.header),
    sections: doc.sections.map(escapeSection),
  }
}

function escapeHeader(h: ResumeHeader): ResumeHeader {
  return {
    name: escapeLatex(h.name),
    tagline: h.tagline ? escapeLatex(h.tagline) : null,
    location: h.location ? escapeLatex(h.location) : null,
    email: h.email, // emails are used in \href -- do NOT escape
    phone: h.phone ? escapeLatex(h.phone) : null,
    linkedin: h.linkedin, // URLs are used in \href -- do NOT escape
    github: h.github,
    website: h.website,
    clearance: h.clearance ? escapeLatex(h.clearance) : null,
  }
}

function escapeSection(section: IRSection): IRSection {
  return {
    ...section,
    title: escapeLatex(section.title),
    items: section.items.map(escapeItem),
  }
}

function escapeItem(item: IRSectionItem): IRSectionItem {
  switch (item.kind) {
    case 'summary':
      return { ...item, content: escapeLatex(item.content) }

    case 'experience_group':
      return {
        ...item,
        organization: escapeLatex(item.organization),
        subheadings: item.subheadings.map(sub => ({
          ...sub,
          title: escapeLatex(sub.title),
          date_range: escapeLatex(sub.date_range),
          bullets: sub.bullets.map(b => ({
            ...b,
            content: escapeLatex(b.content),
          })),
        })),
      }

    case 'skill_group':
      return {
        ...item,
        categories: item.categories.map(cat => ({
          label: escapeLatex(cat.label),
          skills: cat.skills.map(s => escapeLatex(s)),
        })),
      }

    case 'education':
      return {
        ...item,
        institution: escapeLatex(item.institution),
        degree: escapeLatex(item.degree),
        date: escapeLatex(item.date),
      }

    case 'project':
      return {
        ...item,
        name: escapeLatex(item.name),
        date: item.date ? escapeLatex(item.date) : null,
        bullets: item.bullets.map(b => ({
          ...b,
          content: escapeLatex(b.content),
        })),
      }

    case 'certification_group':
      return {
        ...item,
        categories: item.categories.map(cat => ({
          label: escapeLatex(cat.label),
          certs: cat.certs.map(c => ({
            ...c,
            name: escapeLatex(c.name),
          })),
        })),
      }

    case 'clearance':
      return { ...item, content: escapeLatex(item.content) }

    case 'presentation':
      return {
        ...item,
        title: escapeLatex(item.title),
        venue: escapeLatex(item.venue),
        date: item.date ? escapeLatex(item.date) : null,
        bullets: item.bullets.map(b => ({
          ...b,
          content: escapeLatex(b.content),
        })),
      }

    default:
      return item
  }
}
