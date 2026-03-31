import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { compileResumeIR, syntheticUUID, formatDateRange } from '../resume-compiler'
import type { ExperienceGroup, ProjectItem, PresentationItem } from '../../types'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection, seedOrganization, seedResumeSkill, seedProfile } from '../../db/__tests__/helpers'

describe('compileResumeIR', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => db.close())

  test('returns null for non-existent resume', () => {
    const result = compileResumeIR(db, 'non-existent-id')
    expect(result).toBeNull()
  })

  test('empty resume produces no sections', () => {
    const resumeId = seedResume(db)
    const result = compileResumeIR(db, resumeId)
    expect(result).not.toBeNull()
    expect(result!.sections).toHaveLength(0)
  })

  test('header uses profile name and resume target_role for tagline', () => {
    // Profile is seeded by migration with name = 'User'
    const resumeId = seedResume(db, { name: 'Adam Smith', targetRole: 'Security Engineer' })
    const result = compileResumeIR(db, resumeId)!
    // name comes from profile (migration-seeded 'User'), not resume
    expect(result.header.name).toBe('User')
    expect(result.header.tagline).toBe('Security Engineer')
    expect(result.header.email).toBeNull()
  })

  test('header tagline parsed from resume header JSON, contact from profile', () => {
    const resumeId = seedResume(db, { name: 'Test Resume' })
    seedProfile(db, {
      name: 'Adam Smith',
      email: 'adam@example.com',
      location: 'Reston, VA',
      clearance: 'TS/SCI',
    })
    const headerJson = JSON.stringify({
      tagline: 'Security Engineer',
    })
    db.run('UPDATE resumes SET header = ? WHERE id = ?', [headerJson, resumeId])

    const result = compileResumeIR(db, resumeId)!
    expect(result.header.name).toBe('Adam Smith')       // from profile
    expect(result.header.tagline).toBe('Security Engineer')  // from resume header JSON
    expect(result.header.location).toBe('Reston, VA')    // from profile
    expect(result.header.email).toBe('adam@example.com') // from profile
    expect(result.header.clearance).toBe('TS/SCI')       // from profile
  })

  test('freeform section renders entries', () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Summary', 'freeform', 0)
    seedResumeEntry(db, secId, { content: 'Security engineer with 14+ years experience', position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const summarySection = result.sections.find(s => s.type === 'freeform')
    expect(summarySection).toBeDefined()
    expect(summarySection!.title).toBe('Summary')
    expect(summarySection!.items).toHaveLength(1)
    const item = summarySection!.items[0]
    expect(item.kind).toBe('summary')
    if (item.kind === 'summary') {
      expect(item.content).toBe('Security engineer with 14+ years experience')
    }
  })

  test('experience section groups entries by organization', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Raytheon' })

    // Create a role source at Raytheon
    const sourceId = seedSource(db, { title: 'Principal Cloud Forensics Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, end_date, is_current)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, orgId, '2024-03-01', '2025-07-01', 0]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Built cloud platform' })
    const perspId = seedPerspective(db, bulletId, { content: 'Architected cloud forensics platform' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')
    expect(expSection).toBeDefined()
    expect(expSection!.items).toHaveLength(1)
    const group = expSection!.items[0]
    expect(group.kind).toBe('experience_group')
    if (group.kind === 'experience_group') {
      expect(group.organization).toBe('Raytheon')
      expect(group.subheadings).toHaveLength(1)
      expect(group.subheadings[0].title).toBe('Principal Cloud Forensics Engineer')
      expect(group.subheadings[0].bullets).toHaveLength(1)
    }
  })

  test('experience uses entry_content when cloned', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'ACME' })
    const sourceId = seedSource(db, { title: 'Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }])
    const perspId = seedPerspective(db, bulletId, { content: 'Original perspective' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0, content: 'Cloned content' })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0]
    if (group.kind === 'experience_group') {
      expect(group.subheadings[0].bullets[0].content).toBe('Cloned content')
      expect(group.subheadings[0].bullets[0].is_cloned).toBe(true)
    }
  })

  test('skills section reads from resume_skills', () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Technical Skills', 'skills', 0)

    // Create skills and link them via resume_skills
    const skillId1 = crypto.randomUUID()
    const skillId2 = crypto.randomUUID()
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId1, 'Python', 'Languages'])
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId2, 'Kubernetes', 'DevSecOps'])
    seedResumeSkill(db, secId, skillId1, 0)
    seedResumeSkill(db, secId, skillId2, 1)

    const result = compileResumeIR(db, resumeId)!
    const skillsSection = result.sections.find(s => s.type === 'skills')
    expect(skillsSection).toBeDefined()
    expect(skillsSection!.items).toHaveLength(1)
    const group = skillsSection!.items[0]
    if (group.kind === 'skill_group') {
      expect(group.categories.length).toBeGreaterThanOrEqual(1)
      const langs = group.categories.find(c => c.label === 'Languages')
      expect(langs).toBeDefined()
      expect(langs!.skills).toContain('Python')
      const devops = group.categories.find(c => c.label === 'DevSecOps')
      expect(devops).toBeDefined()
      expect(devops!.skills).toContain('Kubernetes')
    }
  })

  test('education section populates from source_education', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'WGU Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, institution, field, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, 'degree', 'Western Governors University', 'Cybersecurity', '2023-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'B.S. Cybersecurity' })
    const perspId = seedPerspective(db, bulletId, { content: 'B.S. Cybersecurity & Information Assurance' })
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')
    expect(eduSection).toBeDefined()
    const item = eduSection!.items[0]
    if (item.kind === 'education') {
      expect(item.institution).toBe('Western Governors University')
      expect(item.degree).toBe('B.S. Cybersecurity & Information Assurance')
      expect(item.date).toBe('2023')
    }
  })

  test('clearance section builds from structured data', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'Clearance', sourceType: 'clearance' })
    db.run(
      `INSERT INTO source_clearances (source_id, level, polygraph, status)
       VALUES (?, ?, ?, ?)`,
      [sourceId, 'TS/SCI', 'CI Polygraph', 'Active']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Has clearance' })
    const perspId = seedPerspective(db, bulletId, { content: 'TS/SCI clearance holder' })
    const secId = seedResumeSection(db, resumeId, 'Security Clearance', 'clearance', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const clrSection = result.sections.find(s => s.type === 'clearance')
    expect(clrSection).toBeDefined()
    const item = clrSection!.items[0]
    if (item.kind === 'clearance') {
      expect(item.content).toBe('TS/SCI with CI Polygraph - Active')
    }
  })

  test('projects section groups by source title', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'AI Memory Architecture', sourceType: 'project' })
    db.run(
      `INSERT INTO source_projects (source_id, is_personal, end_date) VALUES (?, ?, ?)`,
      [sourceId, 1, '2024-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Built memory system' })
    const perspId = seedPerspective(db, bulletId, { content: 'Designed graph-based memory system' })
    const secId = seedResumeSection(db, resumeId, 'Projects', 'projects', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const projSection = result.sections.find(s => s.type === 'projects')
    expect(projSection).toBeDefined()
    const item = projSection!.items[0]
    if (item.kind === 'project') {
      expect(item.name).toBe('AI Memory Architecture')
      expect(item.bullets).toHaveLength(1)
    }
  })

  test('source_chain includes source_title, bullet_preview, perspective_preview', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Raytheon' })
    const sourceId = seedSource(db, { title: 'Principal Cloud Forensics Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Built cloud platform' })
    const perspId = seedPerspective(db, bulletId, { content: 'Architected cloud forensics platform' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    const bullet = group.subheadings[0].bullets[0]

    expect(bullet.source_chain).toBeDefined()
    expect(bullet.source_chain!.source_title).toBeDefined()
    expect(bullet.source_chain!.source_title.length).toBeGreaterThan(0)
    expect(bullet.source_chain!.bullet_preview).toBeDefined()
    expect(bullet.source_chain!.bullet_preview.length).toBeGreaterThan(0)
    expect(bullet.source_chain!.perspective_preview).toBeDefined()
    expect(bullet.source_chain!.perspective_preview.length).toBeGreaterThan(0)
  })

  test('bullet_preview uses original bullet content, perspective_preview uses reframing', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'TestCorp' })
    const sourceId = seedSource(db, { title: 'Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], {
      content: 'Original bullet about cloud migration infrastructure and tooling'
    })
    const perspId = seedPerspective(db, bulletId, {
      content: 'Led cloud platform migration initiative across multiple regions'
    })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    const bullet = group.subheadings[0].bullets[0]

    expect(bullet.source_chain!.bullet_preview).not.toEqual(
      bullet.source_chain!.perspective_preview
    )
    expect(bullet.source_chain!.bullet_preview).toContain('Original bullet')
    expect(bullet.source_chain!.perspective_preview).toContain('Led cloud')
  })

  test('source_title truncated to 60 characters for long titles', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'BigCorp' })
    const longTitle = 'Principal Cloud Forensics Engineer and Platform Security Lead for Enterprise Division'
    const sourceId = seedSource(db, { title: longTitle, sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Did stuff' })
    const perspId = seedPerspective(db, bulletId, { content: 'Accomplished things' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    const bullet = group.subheadings[0].bullets[0]

    expect(bullet.source_chain!.source_title.length).toBeLessThanOrEqual(63) // 60 + '...'
    expect(bullet.source_chain!.source_title).toEndWith('...')
  })

  test('buildProjectsSection enriches source_chain with previews', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'AI Memory Architecture', sourceType: 'project' })
    db.run(
      `INSERT INTO source_projects (source_id, is_personal, end_date) VALUES (?, ?, ?)`,
      [sourceId, 1, '2024-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], {
      content: 'Built graph-based memory system for AI agents'
    })
    const perspId = seedPerspective(db, bulletId, {
      content: 'Designed hierarchical memory architecture enabling long-term agent recall'
    })
    const secId = seedResumeSection(db, resumeId, 'Projects', 'projects', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const projSection = result.sections.find(s => s.type === 'projects')!
    const item = projSection.items[0] as ProjectItem
    const bullet = item.bullets[0]

    expect(bullet.source_chain).toBeDefined()
    expect(bullet.source_chain!.source_title).toBe('AI Memory Architecture')
    expect(bullet.source_chain!.bullet_preview).toContain('Built graph-based')
    expect(bullet.source_chain!.perspective_preview).toContain('Designed hierarchical')
  })

  test('buildPresentationsSection enriches source_chain with previews', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'Cloud Forensics at Scale', sourceType: 'general' })

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], {
      content: 'Presented cloud forensics findings at RSA Conference'
    })
    const perspId = seedPerspective(db, bulletId, {
      content: 'Delivered keynote on cloud-native forensics methodologies'
    })
    const secId = seedResumeSection(db, resumeId, 'Presentations', 'presentations', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const presSection = result.sections.find(s => s.type === 'presentations')!
    const item = presSection.items[0] as PresentationItem
    const bullet = item.bullets[0]

    expect(bullet.source_chain).toBeDefined()
    expect(bullet.source_chain!.source_title).toBe('Cloud Forensics at Scale')
    expect(bullet.source_chain!.bullet_preview).toContain('Presented cloud')
    expect(bullet.source_chain!.perspective_preview).toContain('Delivered keynote')
  })

  test('section IDs come from resume_sections table', () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Summary', 'freeform', 0)
    seedResumeEntry(db, secId, { content: 'Summary text', position: 0 })

    const result = compileResumeIR(db, resumeId)!
    expect(result.sections[0].id).toBe(secId)
  })

  test('section titles come from resume_sections table', () => {
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'My Custom Title', 'freeform', 0)
    seedResumeEntry(db, secId, { content: 'Text', position: 0 })

    const result = compileResumeIR(db, resumeId)!
    expect(result.sections[0].title).toBe('My Custom Title')
  })

  // ── parseHeader with profile ────────────────────────────────────────

  test('uses profile contact fields instead of resume header', () => {
    const resumeId = seedResume(db, { name: 'Resume Name' })
    seedProfile(db, {
      name: 'Adam',
      email: 'adam@test.com',
      phone: '+1-555-0123',
      location: 'DC',
    })
    // Set resume header JSON with a tagline
    db.run("UPDATE resumes SET header = ? WHERE id = ?", [
      JSON.stringify({ tagline: 'Security Engineer' }),
      resumeId,
    ])

    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    expect(ir!.header.name).toBe('Adam')  // from profile
    expect(ir!.header.email).toBe('adam@test.com')  // from profile
    expect(ir!.header.phone).toBe('+1-555-0123')  // from profile
    expect(ir!.header.location).toBe('DC')  // from profile
    expect(ir!.header.tagline).toBe('Security Engineer')  // from resume header
  })

  test('falls back to resume name when profile is missing', () => {
    const resumeId = seedResume(db, { name: 'Fallback Resume' })
    db.run('DELETE FROM user_profile')

    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    expect(ir!.header.name).toBe('Fallback Resume')
  })

  test('tagline defaults to target_role when header JSON has no tagline', () => {
    const resumeId = seedResume(db, { targetRole: 'AI Engineer' })
    seedProfile(db, { name: 'Adam' })

    const ir = compileResumeIR(db, resumeId)
    expect(ir!.header.tagline).toBe('AI Engineer')
  })

  test('contact info changes when profile is updated', () => {
    const resumeId = seedResume(db)
    seedProfile(db, { name: 'Before', email: 'old@test.com' })

    const before = compileResumeIR(db, resumeId)
    expect(before!.header.email).toBe('old@test.com')

    // Update profile
    db.run("UPDATE user_profile SET email = 'new@test.com'")

    const after = compileResumeIR(db, resumeId)
    expect(after!.header.email).toBe('new@test.com')
  })
})

describe('syntheticUUID', () => {
  test('produces deterministic output', () => {
    const a = syntheticUUID('test', 'key')
    const b = syntheticUUID('test', 'key')
    expect(a).toBe(b)
  })

  test('different inputs produce different output', () => {
    const a = syntheticUUID('test', 'key1')
    const b = syntheticUUID('test', 'key2')
    expect(a).not.toBe(b)
  })
})

describe('formatDateRange', () => {
  test('formats start and end dates', () => {
    const result = formatDateRange('2024-03-01', '2025-07-01', false)
    expect(result).toContain('2024')
    expect(result).toContain('2025')
    expect(result).toContain(' - ')
  })

  test('formats current role', () => {
    const result = formatDateRange('2018-09-01', null, true)
    expect(result).toContain('Present')
  })

  test('handles no dates', () => {
    expect(formatDateRange(null, null, false)).toBe('')
  })

  test('handles end date only', () => {
    const result = formatDateRange(null, '2023-06-01', false)
    expect(result).toContain('2023')
  })
})
