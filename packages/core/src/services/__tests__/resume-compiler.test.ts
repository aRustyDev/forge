import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test'
import type { Database } from 'bun:sqlite'
import { compileResumeIR, syntheticUUID, formatDateRange, buildOrgDisplayString } from '../resume-compiler'
import type { EducationItem, ExperienceGroup, ProjectItem, PresentationItem } from '../../types'
import { createTestDb, seedSource, seedBullet, seedPerspective, seedResume, seedResumeEntry, seedResumeSection, seedOrganization, seedResumeSkill, seedProfile, seedSummary } from '../../db/__tests__/helpers'

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
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId1, 'Python', 'language'])
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId2, 'Kubernetes', 'methodology'])
    seedResumeSkill(db, secId, skillId1, 0)
    seedResumeSkill(db, secId, skillId2, 1)

    const result = compileResumeIR(db, resumeId)!
    const skillsSection = result.sections.find(s => s.type === 'skills')
    expect(skillsSection).toBeDefined()
    expect(skillsSection!.items).toHaveLength(1)
    const group = skillsSection!.items[0]
    if (group.kind === 'skill_group') {
      expect(group.categories.length).toBeGreaterThanOrEqual(1)
      const langs = group.categories.find(c => c.label === 'language')
      expect(langs).toBeDefined()
      expect(langs!.skills).toContain('Python')
      const devops = group.categories.find(c => c.label === 'methodology')
      expect(devops).toBeDefined()
      expect(devops!.skills).toContain('Kubernetes')
    }
  })

  test('education section populates from source_education', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Western Governors University' })
    const sourceId = seedSource(db, { title: 'WGU Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, field, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, 'Cybersecurity', '2023-06-01']
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

  test('education section falls back to source.title when content is null (direct-source reference)', () => {
    // Post-T95.5 fix: SourcePicker adds direct-source entries with no
    // content (pure reference mode). The compiler's degree fallback chain
    // must include source.title so the entry renders with the canonical
    // source name ("Cloud Security") instead of an empty string.
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, {
      title: 'Cloud Security',
      sourceType: 'education',
      description: 'GIAC certifications included', // must NOT be used
    })
    db.run(
      `INSERT INTO source_education (source_id, education_type, end_date, degree_level)
       VALUES (?, ?, ?, ?)`,
      [sourceId, 'degree', '2025-10-01', 'graduate_certificate']
    )

    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    // No content, no perspective — pure direct-source reference
    seedResumeEntry(db, secId, { sourceId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')
    expect(eduSection).toBeDefined()
    expect(eduSection!.items).toHaveLength(1)
    const item = eduSection!.items[0] as EducationItem
    expect(item.kind).toBe('education')
    // Degree text must come from source.title, NOT source.description
    expect(item.degree).toBe('Cloud Security')
    expect(item.degree).not.toContain('GIAC certifications included')
    expect(item.degree_level).toBe('graduate_certificate')
    expect(item.date).toBe('2025')
    expect(item.source_id).toBe(sourceId)
  })

  test('certification section falls back to source.title when content is null (direct-source reference)', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, {
      title: 'GPCS - Public Cloud Security',
      sourceType: 'education',
      description: 'certificate: GPCS - Public Cloud Security at GIAC', // must NOT be used
    })
    db.run(
      `INSERT INTO source_education (source_id, education_type, end_date)
       VALUES (?, ?, ?)`,
      [sourceId, 'certificate', '2029-10-01']
    )

    const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
    seedResumeEntry(db, secId, { sourceId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const certSection = result.sections.find(s => s.type === 'certifications')
    expect(certSection).toBeDefined()
    const group = certSection!.items[0]
    expect(group.kind).toBe('certification_group')
    if (group.kind === 'certification_group') {
      expect(group.categories[0].certs[0].name).toBe('GPCS - Public Cloud Security')
      expect(group.categories[0].certs[0].name).not.toContain('certificate:')
    }
  })

  test('education section renders direct-source entries (no perspective chain)', () => {
    // Regression test for T95.5-class bug: education/certification/clearance
    // entries added via SourcePicker's content-only path have
    // perspective_id=NULL and source_id set directly. The compiler must
    // LEFT JOIN perspectives + COALESCE the source chain so these still
    // render with full structured data from source_education.
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Western Governors University' })
    const sourceId = seedSource(db, {
      title: 'WGU Degree',
      sourceType: 'education',
      description: 'B.S. Cybersecurity & Information Assurance',
    })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, field, end_date, degree_level, degree_type, gpa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, 'Cybersecurity', '2023-06-01', 'bachelors', 'bs', '3.8']
    )

    // NO bullet, NO perspective — the entry points directly at the source.
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, {
      sourceId,
      content: 'B.S. Cybersecurity & Information Assurance',
      position: 0,
    })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')
    expect(eduSection).toBeDefined()
    expect(eduSection!.items).toHaveLength(1)
    const item = eduSection!.items[0] as EducationItem
    expect(item.kind).toBe('education')
    expect(item.institution).toBe('Western Governors University')
    expect(item.degree).toBe('B.S. Cybersecurity & Information Assurance')
    expect(item.date).toBe('2023')
    expect(item.degree_level).toBe('bachelors')
    expect(item.degree_type).toBe('bs')
    expect(item.field).toBe('Cybersecurity')
    expect(item.gpa).toBe('3.8')
    expect(item.source_id).toBe(sourceId)
  })

  test('certification section renders direct-source entries (no perspective chain)', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, {
      title: 'AWS Certified Solutions Architect',
      sourceType: 'education',
      description: 'AWS Certified Solutions Architect — Associate',
    })
    db.run(
      `INSERT INTO source_education (source_id, education_type, credential_id, end_date)
       VALUES (?, ?, ?, ?)`,
      [sourceId, 'certificate', 'AWS-SAA-12345', '2024-08-15']
    )

    const secId = seedResumeSection(db, resumeId, 'Certifications', 'certifications', 0)
    seedResumeEntry(db, secId, {
      sourceId,
      content: 'AWS Certified Solutions Architect — Associate',
      position: 0,
    })

    const result = compileResumeIR(db, resumeId)!
    const certSection = result.sections.find(s => s.type === 'certifications')
    expect(certSection).toBeDefined()
    expect(certSection!.items).toHaveLength(1)
    const group = certSection!.items[0]
    expect(group.kind).toBe('certification_group')
    if (group.kind === 'certification_group') {
      // No organization linked → falls back to source title as the category
      // label, and the cert name is the entry content.
      expect(group.categories).toHaveLength(1)
      expect(group.categories[0].certs).toHaveLength(1)
      expect(group.categories[0].certs[0].name).toBe('AWS Certified Solutions Architect — Associate')
      expect(group.categories[0].certs[0].source_id).toBe(sourceId)
    }
  })

  test('clearance section renders direct-source entries (no perspective chain)', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, {
      title: 'TS/SCI Clearance',
      sourceType: 'clearance',
      description: 'Top Secret / Sensitive Compartmented Information',
    })
    db.run(
      `INSERT INTO source_clearances (source_id, level, polygraph, status, type)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, 'top_secret', 'ci', 'active', 'personnel']
    )

    const secId = seedResumeSection(db, resumeId, 'Security Clearance', 'clearance', 0)
    seedResumeEntry(db, secId, {
      sourceId,
      content: 'Top Secret / Sensitive Compartmented Information',
      position: 0,
    })

    const result = compileResumeIR(db, resumeId)!
    const clearanceSection = result.sections.find(s => s.type === 'clearance')
    expect(clearanceSection).toBeDefined()
    expect(clearanceSection!.items).toHaveLength(1)
    const item = clearanceSection!.items[0]
    expect(item.kind).toBe('clearance')
    if (item.kind === 'clearance') {
      // Structured data takes precedence over raw content
      expect(item.content).toBe('top_secret with ci - active')
      expect(item.source_id).toBe(sourceId)
    }
  })

  test('education section includes campus fields when campus_id is set', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Western Governors University' })

    // Create a campus
    const campusId = crypto.randomUUID()
    db.run(
      `INSERT INTO org_campuses (id, organization_id, name, modality, city, state)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [campusId, orgId, 'Salt Lake City Campus', 'in_person', 'Salt Lake City', 'UT']
    )

    const sourceId = seedSource(db, { title: 'WGU Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, campus_id, field, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, campusId, 'Cybersecurity', '2023-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'B.S. Cybersecurity' })
    const perspId = seedPerspective(db, bulletId, { content: 'B.S. Cybersecurity & Information Assurance' })
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')
    expect(eduSection).toBeDefined()
    const item = eduSection!.items[0] as EducationItem
    expect(item.kind).toBe('education')
    expect(item.institution).toBe('Western Governors University')
    expect(item.campus_name).toBe('Salt Lake City Campus')
    expect(item.campus_city).toBe('Salt Lake City')
    expect(item.campus_state).toBe('UT')
  })

  test('education section has null campus fields when no campus_id', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Western Governors University' })
    const sourceId = seedSource(db, { title: 'WGU Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, field, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, 'Cybersecurity', '2023-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'B.S. Cybersecurity' })
    const perspId = seedPerspective(db, bulletId, { content: 'B.S. Cybersecurity & Information Assurance' })
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')
    expect(eduSection).toBeDefined()
    const item = eduSection!.items[0] as EducationItem
    expect(item.kind).toBe('education')
    expect(item.campus_name).toBeNull()
    expect(item.campus_city).toBeNull()
    expect(item.campus_state).toBeNull()
  })

  test('clearance section builds from structured data', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'Clearance', sourceType: 'clearance' })
    db.run(
      `INSERT INTO source_clearances (source_id, level, polygraph, status, type, continuous_investigation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sourceId, 'top_secret', 'ci', 'active', 'personnel', 0]
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
      expect(item.content).toBe('top_secret with ci - active')
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

  test('empty sections appear in IR with no items', () => {
    const resumeId = seedResume(db)
    seedResumeSection(db, resumeId, 'Empty Section', 'experience', 0)

    const ir = compileResumeIR(db, resumeId)!
    expect(ir.sections).toHaveLength(1)
    expect(ir.sections[0].title).toBe('Empty Section')
    expect(ir.sections[0].items).toHaveLength(0)
  })

  test('two sections of same entry_type have entries in correct section', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'CivilianCorp' })
    const orgId2 = seedOrganization(db, { name: 'MilOrg' })
    const s1 = seedResumeSection(db, resumeId, 'Civilian Work', 'experience', 0)
    const s2 = seedResumeSection(db, resumeId, 'Military Service', 'experience', 1)

    // Seed entries into each section
    const sourceId1 = seedSource(db, { title: 'Civilian Role', sourceType: 'role' })
    db.run('INSERT INTO source_roles (source_id, organization_id, start_date, is_current) VALUES (?, ?, ?, ?)',
      [sourceId1, orgId, '2024-01-01', 1])
    const bulletId1 = seedBullet(db, [{ id: sourceId1, isPrimary: true }], { content: 'Civilian work bullet' })
    const p1 = seedPerspective(db, bulletId1, { content: 'Civilian perspective' })

    const sourceId2 = seedSource(db, { title: 'Military Role', sourceType: 'role' })
    db.run('INSERT INTO source_roles (source_id, organization_id, start_date, is_current) VALUES (?, ?, ?, ?)',
      [sourceId2, orgId2, '2020-01-01', 0])
    const bulletId2 = seedBullet(db, [{ id: sourceId2, isPrimary: true }], { content: 'Military work bullet' })
    const p2 = seedPerspective(db, bulletId2, { content: 'Military perspective' })

    seedResumeEntry(db, s1, { perspectiveId: p1, position: 0 })
    seedResumeEntry(db, s2, { perspectiveId: p2, position: 0 })

    const ir = compileResumeIR(db, resumeId)!
    expect(ir.sections).toHaveLength(2)
    expect(ir.sections[0].title).toBe('Civilian Work')
    expect(ir.sections[1].title).toBe('Military Service')
    expect(ir.sections[0].items).toHaveLength(1)
    expect(ir.sections[1].items).toHaveLength(1)
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

  // ── Summary integration ───────────────────────────────────────────

  test('compileResumeIR uses summary.tagline when summary is linked', () => {
    const resumeId = seedResume(db, { name: 'Test', targetRole: 'Fallback Role' })
    const summaryId = seedSummary(db, { tagline: 'Summary Tagline' })

    // Link summary to resume
    db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [summaryId, resumeId])

    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    expect(ir!.header.tagline).toBe('Summary Tagline')
  })

  test('compileResumeIR falls back to target_role when no summary linked', () => {
    const resumeId = seedResume(db, { targetRole: 'Fallback Role' })

    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    expect(ir!.header.tagline).toBe('Fallback Role')
  })

  test('compileResumeIR falls back to header JSON when summary has no tagline', () => {
    const resumeId = seedResume(db)
    const summaryId = seedSummary(db, { tagline: null })

    db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [summaryId, resumeId])

    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    // Should fall back to header JSON tagline or target_role
    expect(ir!.header.tagline).toBeTruthy()
  })

  test('compileResumeIR handles deleted summary gracefully', () => {
    const resumeId = seedResume(db)
    const summaryId = seedSummary(db)

    db.run('UPDATE resumes SET summary_id = ? WHERE id = ?', [summaryId, resumeId])
    db.run('DELETE FROM summaries WHERE id = ?', [summaryId])

    // summary_id is now NULL due to ON DELETE SET NULL
    const ir = compileResumeIR(db, resumeId)
    expect(ir).not.toBeNull()
    // Should not crash -- falls back to default behavior
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

// ── Phase 44: IR Data Quality Tests ─────────────────────────────────

describe('buildOrgDisplayString', () => {
  test('returns full format with all fields', () => {
    expect(buildOrgDisplayString('Raytheon', 'Arlington', 'VA', 'remote'))
      .toBe('Raytheon - Arlington, VA (Remote)')
  })

  test('returns org name only when no location or arrangement', () => {
    expect(buildOrgDisplayString('Acme Corp', null, null, null))
      .toBe('Acme Corp')
  })

  test('returns "Other" when org name is null', () => {
    expect(buildOrgDisplayString(null, null, null, null))
      .toBe('Other')
  })

  test('handles city only (no state)', () => {
    expect(buildOrgDisplayString('USAFR', 'National Capitol Region', null, null))
      .toBe('USAFR - National Capitol Region')
  })

  test('handles state only (no city)', () => {
    expect(buildOrgDisplayString('TestOrg', null, 'VA', null))
      .toBe('TestOrg - VA')
  })

  test('handles arrangement only (no location)', () => {
    expect(buildOrgDisplayString('Cisco', null, null, 'remote'))
      .toBe('Cisco (Remote)')
  })

  test('capitalizes work arrangement', () => {
    expect(buildOrgDisplayString('Corp', null, null, 'contract'))
      .toBe('Corp (Contract)')
  })

  test('handles city, state, and arrangement', () => {
    expect(buildOrgDisplayString('Cisco', 'San Jose', 'CA', 'contract'))
      .toBe('Cisco - San Jose, CA (Contract)')
  })
})

describe('compileResumeIR — Phase 44 data quality', () => {
  let db: Database

  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => db.close())

  // ── T44.1: Header warnings ──────────────────────────────────────

  test('warns when profile name is "User" (seed default)', () => {
    const warnSpy = spyOn(console, 'warn')
    const resumeId = seedResume(db, { name: 'My Resume' })
    // Default profile from migration has name "User"
    compileResumeIR(db, resumeId)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('user_profile.name is "User"')
    )
    warnSpy.mockRestore()
  })

  test('warns when no profile row exists', () => {
    const warnSpy = spyOn(console, 'warn')
    const resumeId = seedResume(db, { name: 'Fallback Resume' })
    db.run('DELETE FROM user_profile')
    compileResumeIR(db, resumeId)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No user_profile row found'),
      expect.anything()
    )
    warnSpy.mockRestore()
  })

  test('warns when profile has no contact fields', () => {
    const warnSpy = spyOn(console, 'warn')
    const resumeId = seedResume(db)
    seedProfile(db, { name: 'Adam' })
    // No email, phone, linkedin, github
    compileResumeIR(db, resumeId)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no contact fields populated')
    )
    warnSpy.mockRestore()
  })

  test('no warnings when profile is fully populated', () => {
    const warnSpy = spyOn(console, 'warn')
    const resumeId = seedResume(db)
    seedProfile(db, { name: 'Adam', email: 'adam@example.com', phone: '+1-555-0123' })
    compileResumeIR(db, resumeId)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  // ── T44.2: Experience org display ───────────────────────────────

  test('experience org name from organizations table (not "Other")', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Cisco' })
    const sourceId = seedSource(db, { title: 'Network Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Built networks' })
    const perspId = seedPerspective(db, bulletId, { content: 'Architected network infrastructure' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    expect(group.organization).toContain('Cisco')
    expect(group.organization).not.toBe('Other')
  })

  test('experience org with HQ campus location', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Raytheon Intelligence & Space' })

    // Create HQ campus
    const campusId = crypto.randomUUID()
    db.run(
      `INSERT INTO org_campuses (id, organization_id, name, modality, city, state, is_headquarters)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [campusId, orgId, 'HQ', 'in_person', 'Arlington', 'VA', 1]
    )

    const sourceId = seedSource(db, { title: 'Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current, work_arrangement)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1, 'remote']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Did work' })
    const perspId = seedPerspective(db, bulletId, { content: 'Engineered things' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    expect(group.organization).toBe('Raytheon Intelligence & Space - Arlington, VA (Remote)')
  })

  test('experience org with work arrangement but no location', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Cisco' })
    const sourceId = seedSource(db, { title: 'Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current, work_arrangement)
       VALUES (?, ?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1, 'remote']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Did work' })
    const perspId = seedPerspective(db, bulletId, { content: 'Built platform' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    expect(group.organization).toBe('Cisco (Remote)')
  })

  test('experience org name-only when no campus and no arrangement', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'Acme Corp' })
    const sourceId = seedSource(db, { title: 'Developer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId, orgId, '2024-01-01', 1]
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Coded stuff' })
    const perspId = seedPerspective(db, bulletId, { content: 'Developed features' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    expect(group.organization).toBe('Acme Corp')
  })

  test('experience groups by org ID, not name (two orgs with same name)', () => {
    const resumeId = seedResume(db)
    const orgId1 = seedOrganization(db, { name: 'Acme' })
    const orgId2 = seedOrganization(db, { name: 'Acme' })

    const sourceId1 = seedSource(db, { title: 'Engineer', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId1, orgId1, '2024-01-01', 1]
    )
    const bulletId1 = seedBullet(db, [{ id: sourceId1, isPrimary: true }], { content: 'Work 1' })
    const perspId1 = seedPerspective(db, bulletId1, { content: 'Perspective 1' })

    const sourceId2 = seedSource(db, { title: 'Manager', sourceType: 'role' })
    db.run(
      `INSERT INTO source_roles (source_id, organization_id, start_date, is_current)
       VALUES (?, ?, ?, ?)`,
      [sourceId2, orgId2, '2023-01-01', 0]
    )
    const bulletId2 = seedBullet(db, [{ id: sourceId2, isPrimary: true }], { content: 'Work 2' })
    const perspId2 = seedPerspective(db, bulletId2, { content: 'Perspective 2' })

    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId1, position: 0 })
    seedResumeEntry(db, secId, { perspectiveId: perspId2, position: 1 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    // Two different orgs with same name should produce 2 separate groups
    expect(expSection.items).toHaveLength(2)
  })

  test('experience falls back to "Other" when no org', () => {
    const resumeId = seedResume(db)
    const sourceId = seedSource(db, { title: 'Freelance', sourceType: 'role' })
    // No source_roles entry (no org)

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'Did freelance work' })
    const perspId = seedPerspective(db, bulletId, { content: 'Consulted on security' })
    const secId = seedResumeSection(db, resumeId, 'Experience', 'experience', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const expSection = result.sections.find(s => s.type === 'experience')!
    const group = expSection.items[0] as ExperienceGroup
    expect(group.organization).toBe('Other')
  })

  // ── T44.4: Education location from campus ──────────────────────

  test('education location falls back to campus when se.location is NULL', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'University of Maryland' })

    const campusId = crypto.randomUUID()
    db.run(
      `INSERT INTO org_campuses (id, organization_id, name, modality, city, state)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [campusId, orgId, 'College Park', 'in_person', 'College Park', 'MD']
    )

    const sourceId = seedSource(db, { title: 'UMD Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, campus_id, field, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, campusId, 'Computer Science', '2023-06-01']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'B.S. CS' })
    const perspId = seedPerspective(db, bulletId, { content: 'B.S. Computer Science' })
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')!
    const item = eduSection.items[0] as EducationItem
    expect(item.institution).toBe('University of Maryland')
    expect(item.location).toBe('College Park, MD')
  })

  test('education location from se.location takes priority over campus', () => {
    const resumeId = seedResume(db)
    const orgId = seedOrganization(db, { name: 'WGU' })

    const campusId = crypto.randomUUID()
    db.run(
      `INSERT INTO org_campuses (id, organization_id, name, modality, city, state)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [campusId, orgId, 'Main Campus', 'remote', 'Salt Lake City', 'UT']
    )

    const sourceId = seedSource(db, { title: 'WGU Degree', sourceType: 'education' })
    db.run(
      `INSERT INTO source_education (source_id, education_type, organization_id, campus_id, field, end_date, location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sourceId, 'degree', orgId, campusId, 'Cybersecurity', '2023-06-01', 'Online']
    )

    const bulletId = seedBullet(db, [{ id: sourceId, isPrimary: true }], { content: 'B.S. Cybersecurity' })
    const perspId = seedPerspective(db, bulletId, { content: 'B.S. Cybersecurity' })
    const secId = seedResumeSection(db, resumeId, 'Education', 'education', 0)
    seedResumeEntry(db, secId, { perspectiveId: perspId, position: 0 })

    const result = compileResumeIR(db, resumeId)!
    const eduSection = result.sections.find(s => s.type === 'education')!
    const item = eduSection.items[0] as EducationItem
    expect(item.location).toBe('Online')  // se.location takes priority
  })

  // ── T44.5: Skills orphan handling ──────────────────────────────

  test('skills with orphaned entries produce warning', () => {
    const warnSpy = spyOn(console, 'warn')
    const resumeId = seedResume(db)
    const secId = seedResumeSection(db, resumeId, 'Skills', 'skills', 0)

    // Create a valid skill
    const skillId = crypto.randomUUID()
    db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [skillId, 'Python', 'language'])
    seedResumeSkill(db, secId, skillId, 0)

    // Create an orphaned resume_skills entry (skill_id points to nonexistent skill)
    // Must disable FK checks temporarily to insert the orphan
    const orphanSkillId = crypto.randomUUID()
    db.run('PRAGMA foreign_keys = OFF')
    seedResumeSkill(db, secId, orphanSkillId, 1)
    db.run('PRAGMA foreign_keys = ON')

    seedProfile(db, { name: 'Adam', email: 'adam@test.com' })
    const result = compileResumeIR(db, resumeId)!
    const skillsSection = result.sections.find(s => s.type === 'skills')!

    // Valid skill still appears
    const group = skillsSection.items[0]
    if (group.kind === 'skill_group') {
      const langs = group.categories.find(c => c.label === 'language')
      expect(langs).toBeDefined()
      expect(langs!.skills).toContain('Python')
    }

    // Warning about orphan
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('orphaned resume_skills')
    )
    warnSpy.mockRestore()
  })

  test('skills categories are ordered alphabetically', () => {
    const resumeId = seedResume(db)
    seedProfile(db, { name: 'Adam', email: 'adam@test.com' })
    const secId = seedResumeSection(db, resumeId, 'Skills', 'skills', 0)

    // Phase 89: category is a CHECK enum; use valid values that still
    // exercise alphabetical ordering across multiple categories.
    const skillIds = [
      { name: 'Terraform', category: 'tool' },
      { name: 'Python', category: 'language' },
      { name: 'AWS', category: 'platform' },
    ]
    skillIds.forEach((s, i) => {
      const id = crypto.randomUUID()
      db.run('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [id, s.name, s.category])
      seedResumeSkill(db, secId, id, i)
    })

    const result = compileResumeIR(db, resumeId)!
    const skillsSection = result.sections.find(s => s.type === 'skills')!
    const group = skillsSection.items[0]
    if (group.kind === 'skill_group') {
      const labels = group.categories.map(c => c.label)
      // 'language' < 'platform' < 'tool' alphabetically
      expect(labels).toEqual(['language', 'platform', 'tool'])
    }
  })
})
