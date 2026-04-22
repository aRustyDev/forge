// === contacts.hx ===
QUERY AddContacts(id?: String, name?: String, title?: String, email?: String, phone?: String, linkedin?: String, team?: String, dept?: String, notes?: String, organization_id?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Contacts>({id: id, name: name, title: title, email: email, phone: phone, linkedin: linkedin, team: team, dept: dept, notes: notes, organization_id: organization_id, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetContacts(id: String) =>
    node <- N<Contacts>({id: id})::FIRST
    RETURN node

QUERY UpdateContacts(id: String, name?: String, title?: String, email?: String, phone?: String, linkedin?: String, team?: String, dept?: String, notes?: String, organization_id?: String, created_at?: String, updated_at?: String) =>
    node <- N<Contacts>({id: id})::FIRST
    node <- node::UPDATE({name: name, title: title, email: email, phone: phone, linkedin: linkedin, team: team, dept: dept, notes: notes, organization_id: organization_id, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteContacts(id: String) =>
    node <- N<Contacts>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListContacts(offset: U32, limit: U32) =>
    nodes <- N<Contacts>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllContacts() =>
    nodes <- N<Contacts>
    RETURN nodes

QUERY CountContacts() =>
    count <- N<Contacts>::COUNT
    RETURN count

// === content.hx ===
QUERY AddSources(id?: String, title?: String, description?: String, source_type?: String, start_date?: String, end_date?: String, status?: String, updated_by?: String, last_derived_at?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Sources>({id: id, title: title, description: description, source_type: source_type, start_date: start_date, end_date: end_date, status: status, updated_by: updated_by, last_derived_at: last_derived_at, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetSources(id: String) =>
    node <- N<Sources>({id: id})::FIRST
    RETURN node

QUERY UpdateSources(id: String, title?: String, description?: String, source_type?: String, start_date?: String, end_date?: String, status?: String, updated_by?: String, last_derived_at?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- N<Sources>({id: id})::FIRST
    node <- node::UPDATE({title: title, description: description, source_type: source_type, start_date: start_date, end_date: end_date, status: status, updated_by: updated_by, last_derived_at: last_derived_at, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteSources(id: String) =>
    node <- N<Sources>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSources(offset: U32, limit: U32) =>
    nodes <- N<Sources>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSources() =>
    nodes <- N<Sources>
    RETURN nodes

QUERY CountSources() =>
    count <- N<Sources>::COUNT
    RETURN count

QUERY AddSourceRoles(source_id?: String, organization_id?: String, start_date?: String, end_date?: String, is_current?: Boolean, work_arrangement?: String, base_salary?: I64, total_comp_notes?: String) =>
    node <- AddN<SourceRoles>({source_id: source_id, organization_id: organization_id, start_date: start_date, end_date: end_date, is_current: is_current, work_arrangement: work_arrangement, base_salary: base_salary, total_comp_notes: total_comp_notes})
    RETURN node

QUERY ListSourceRoles(offset: U32, limit: U32) =>
    nodes <- N<SourceRoles>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSourceRoles() =>
    nodes <- N<SourceRoles>
    RETURN nodes

QUERY CountSourceRoles() =>
    count <- N<SourceRoles>::COUNT
    RETURN count

QUERY AddSourceProjects(source_id?: String, organization_id?: String, is_personal?: Boolean, url?: String, start_date?: String, end_date?: String, open_source?: Boolean) =>
    node <- AddN<SourceProjects>({source_id: source_id, organization_id: organization_id, is_personal: is_personal, url: url, start_date: start_date, end_date: end_date, open_source: open_source})
    RETURN node

QUERY ListSourceProjects(offset: U32, limit: U32) =>
    nodes <- N<SourceProjects>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSourceProjects() =>
    nodes <- N<SourceProjects>
    RETURN nodes

QUERY CountSourceProjects() =>
    count <- N<SourceProjects>::COUNT
    RETURN count

QUERY AddSourceEducation(source_id?: String, education_type?: String, organization_id?: String, campus_id?: String, field?: String, start_date?: String, end_date?: String, is_in_progress?: Boolean, credential_id?: String, expiration_date?: String, url?: String, degree_level?: String, degree_type?: String, certificate_subtype?: String, gpa?: String, location?: String, edu_description?: String) =>
    node <- AddN<SourceEducation>({source_id: source_id, education_type: education_type, organization_id: organization_id, campus_id: campus_id, field: field, start_date: start_date, end_date: end_date, is_in_progress: is_in_progress, credential_id: credential_id, expiration_date: expiration_date, url: url, degree_level: degree_level, degree_type: degree_type, certificate_subtype: certificate_subtype, gpa: gpa, location: location, edu_description: edu_description})
    RETURN node

QUERY ListSourceEducation(offset: U32, limit: U32) =>
    nodes <- N<SourceEducation>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSourceEducation() =>
    nodes <- N<SourceEducation>
    RETURN nodes

QUERY CountSourceEducation() =>
    count <- N<SourceEducation>::COUNT
    RETURN count

QUERY AddSourcePresentations(source_id?: String, venue?: String, presentation_type?: String, url?: String, coauthors?: String) =>
    node <- AddN<SourcePresentations>({source_id: source_id, venue: venue, presentation_type: presentation_type, url: url, coauthors: coauthors})
    RETURN node

QUERY ListSourcePresentations(offset: U32, limit: U32) =>
    nodes <- N<SourcePresentations>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSourcePresentations() =>
    nodes <- N<SourcePresentations>
    RETURN nodes

QUERY CountSourcePresentations() =>
    count <- N<SourcePresentations>::COUNT
    RETURN count

QUERY AddBullets(id?: String, content?: String, source_content_snapshot?: String, metrics?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, notes?: String, domain?: String, created_at?: String) =>
    node <- AddN<Bullets>({id: id, content: content, source_content_snapshot: source_content_snapshot, metrics: metrics, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, notes: notes, domain: domain, created_at: created_at})
    RETURN node

QUERY GetBullets(id: String) =>
    node <- N<Bullets>({id: id})::FIRST
    RETURN node

QUERY UpdateBullets(id: String, content?: String, source_content_snapshot?: String, metrics?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, notes?: String, domain?: String, created_at?: String) =>
    node <- N<Bullets>({id: id})::FIRST
    node <- node::UPDATE({content: content, source_content_snapshot: source_content_snapshot, metrics: metrics, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, notes: notes, domain: domain, created_at: created_at})
    RETURN node

QUERY DeleteBullets(id: String) =>
    node <- N<Bullets>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListBullets(offset: U32, limit: U32) =>
    nodes <- N<Bullets>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllBullets() =>
    nodes <- N<Bullets>
    RETURN nodes

QUERY CountBullets() =>
    count <- N<Bullets>::COUNT
    RETURN count

QUERY AddPerspectives(id?: String, bullet_id?: String, content?: String, bullet_content_snapshot?: String, target_archetype?: String, domain?: String, framing?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, notes?: String, created_at?: String) =>
    node <- AddN<Perspectives>({id: id, bullet_id: bullet_id, content: content, bullet_content_snapshot: bullet_content_snapshot, target_archetype: target_archetype, domain: domain, framing: framing, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, notes: notes, created_at: created_at})
    RETURN node

QUERY GetPerspectives(id: String) =>
    node <- N<Perspectives>({id: id})::FIRST
    RETURN node

QUERY UpdatePerspectives(id: String, bullet_id?: String, content?: String, bullet_content_snapshot?: String, target_archetype?: String, domain?: String, framing?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, notes?: String, created_at?: String) =>
    node <- N<Perspectives>({id: id})::FIRST
    node <- node::UPDATE({bullet_id: bullet_id, content: content, bullet_content_snapshot: bullet_content_snapshot, target_archetype: target_archetype, domain: domain, framing: framing, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, notes: notes, created_at: created_at})
    RETURN node

QUERY DeletePerspectives(id: String) =>
    node <- N<Perspectives>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListPerspectives(offset: U32, limit: U32) =>
    nodes <- N<Perspectives>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllPerspectives() =>
    nodes <- N<Perspectives>
    RETURN nodes

QUERY CountPerspectives() =>
    count <- N<Perspectives>::COUNT
    RETURN count

// === edges.hx ===
QUERY AddArchetypeDomains(fromId: String, toId: String, created_at?: String) =>
    from <- N<Archetypes>({id: fromId})::FIRST
    to <- N<Domains>({id: toId})::FIRST
    edge <- AddE<ArchetypeDomains>::From(from)::To(to)
    RETURN edge

QUERY ListArchetypeDomainsFrom(id: String) =>
    edges <- N<Archetypes>({id: id})::FIRST::OutE<ArchetypeDomains>
    RETURN edges

QUERY ListArchetypeDomainsTo(id: String) =>
    edges <- N<Domains>({id: id})::FIRST::InE<ArchetypeDomains>
    RETURN edges

QUERY DeleteArchetypeDomainsFrom(id: String) =>
    edges <- N<Archetypes>({id: id})::FIRST::OutE<ArchetypeDomains>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteArchetypeDomainsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Archetypes>({id: fromId})::FIRST::OutE<ArchetypeDomains>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountArchetypeDomainsFrom(id: String) =>
    count <- N<Archetypes>({id: id})::FIRST::OutE<ArchetypeDomains>::COUNT
    RETURN count

QUERY AddBulletSkills(fromId: String, toId: String) =>
    from <- N<Bullets>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<BulletSkills>::From(from)::To(to)
    RETURN edge

QUERY ListBulletSkillsFrom(id: String) =>
    edges <- N<Bullets>({id: id})::FIRST::OutE<BulletSkills>
    RETURN edges

QUERY ListBulletSkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<BulletSkills>
    RETURN edges

QUERY DeleteBulletSkillsFrom(id: String) =>
    edges <- N<Bullets>({id: id})::FIRST::OutE<BulletSkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteBulletSkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Bullets>({id: fromId})::FIRST::OutE<BulletSkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountBulletSkillsFrom(id: String) =>
    count <- N<Bullets>({id: id})::FIRST::OutE<BulletSkills>::COUNT
    RETURN count

QUERY AddBulletSources(fromId: String, toId: String, is_primary?: Boolean) =>
    from <- N<Bullets>({id: fromId})::FIRST
    to <- N<Sources>({id: toId})::FIRST
    edge <- AddE<BulletSources>::From(from)::To(to)
    RETURN edge

QUERY ListBulletSourcesFrom(id: String) =>
    edges <- N<Bullets>({id: id})::FIRST::OutE<BulletSources>
    RETURN edges

QUERY ListBulletSourcesTo(id: String) =>
    edges <- N<Sources>({id: id})::FIRST::InE<BulletSources>
    RETURN edges

QUERY DeleteBulletSourcesFrom(id: String) =>
    edges <- N<Bullets>({id: id})::FIRST::OutE<BulletSources>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteBulletSourcesByEndpoints(fromId: String, toId: String) =>
    edges <- N<Bullets>({id: fromId})::FIRST::OutE<BulletSources>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountBulletSourcesFrom(id: String) =>
    count <- N<Bullets>({id: id})::FIRST::OutE<BulletSources>::COUNT
    RETURN count

QUERY AddPerspectiveSkills(fromId: String, toId: String) =>
    from <- N<Perspectives>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<PerspectiveSkills>::From(from)::To(to)
    RETURN edge

QUERY ListPerspectiveSkillsFrom(id: String) =>
    edges <- N<Perspectives>({id: id})::FIRST::OutE<PerspectiveSkills>
    RETURN edges

QUERY ListPerspectiveSkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<PerspectiveSkills>
    RETURN edges

QUERY DeletePerspectiveSkillsFrom(id: String) =>
    edges <- N<Perspectives>({id: id})::FIRST::OutE<PerspectiveSkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeletePerspectiveSkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Perspectives>({id: fromId})::FIRST::OutE<PerspectiveSkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountPerspectiveSkillsFrom(id: String) =>
    count <- N<Perspectives>({id: id})::FIRST::OutE<PerspectiveSkills>::COUNT
    RETURN count

QUERY AddSourceSkills(fromId: String, toId: String) =>
    from <- N<Sources>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<SourceSkills>::From(from)::To(to)
    RETURN edge

QUERY ListSourceSkillsFrom(id: String) =>
    edges <- N<Sources>({id: id})::FIRST::OutE<SourceSkills>
    RETURN edges

QUERY ListSourceSkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<SourceSkills>
    RETURN edges

QUERY DeleteSourceSkillsFrom(id: String) =>
    edges <- N<Sources>({id: id})::FIRST::OutE<SourceSkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteSourceSkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Sources>({id: fromId})::FIRST::OutE<SourceSkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountSourceSkillsFrom(id: String) =>
    count <- N<Sources>({id: id})::FIRST::OutE<SourceSkills>::COUNT
    RETURN count

QUERY AddSkillDomains(fromId: String, toId: String, created_at?: String) =>
    from <- N<Skills>({id: fromId})::FIRST
    to <- N<Domains>({id: toId})::FIRST
    edge <- AddE<SkillDomains>::From(from)::To(to)
    RETURN edge

QUERY ListSkillDomainsFrom(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::OutE<SkillDomains>
    RETURN edges

QUERY ListSkillDomainsTo(id: String) =>
    edges <- N<Domains>({id: id})::FIRST::InE<SkillDomains>
    RETURN edges

QUERY DeleteSkillDomainsFrom(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::OutE<SkillDomains>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteSkillDomainsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Skills>({id: fromId})::FIRST::OutE<SkillDomains>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountSkillDomainsFrom(id: String) =>
    count <- N<Skills>({id: id})::FIRST::OutE<SkillDomains>::COUNT
    RETURN count

QUERY AddJobDescriptionSkills(fromId: String, toId: String) =>
    from <- N<JobDescriptions>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<JobDescriptionSkills>::From(from)::To(to)
    RETURN edge

QUERY ListJobDescriptionSkillsFrom(id: String) =>
    edges <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionSkills>
    RETURN edges

QUERY ListJobDescriptionSkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<JobDescriptionSkills>
    RETURN edges

QUERY DeleteJobDescriptionSkillsFrom(id: String) =>
    edges <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionSkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteJobDescriptionSkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<JobDescriptions>({id: fromId})::FIRST::OutE<JobDescriptionSkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountJobDescriptionSkillsFrom(id: String) =>
    count <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionSkills>::COUNT
    RETURN count

QUERY AddJobDescriptionResumes(fromId: String, toId: String, created_at?: String) =>
    from <- N<JobDescriptions>({id: fromId})::FIRST
    to <- N<Resumes>({id: toId})::FIRST
    edge <- AddE<JobDescriptionResumes>::From(from)::To(to)
    RETURN edge

QUERY ListJobDescriptionResumesFrom(id: String) =>
    edges <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionResumes>
    RETURN edges

QUERY ListJobDescriptionResumesTo(id: String) =>
    edges <- N<Resumes>({id: id})::FIRST::InE<JobDescriptionResumes>
    RETURN edges

QUERY DeleteJobDescriptionResumesFrom(id: String) =>
    edges <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionResumes>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteJobDescriptionResumesByEndpoints(fromId: String, toId: String) =>
    edges <- N<JobDescriptions>({id: fromId})::FIRST::OutE<JobDescriptionResumes>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountJobDescriptionResumesFrom(id: String) =>
    count <- N<JobDescriptions>({id: id})::FIRST::OutE<JobDescriptionResumes>::COUNT
    RETURN count

QUERY AddSummarySkills(fromId: String, toId: String, created_at?: String) =>
    from <- N<Summaries>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<SummarySkills>::From(from)::To(to)
    RETURN edge

QUERY ListSummarySkillsFrom(id: String) =>
    edges <- N<Summaries>({id: id})::FIRST::OutE<SummarySkills>
    RETURN edges

QUERY ListSummarySkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<SummarySkills>
    RETURN edges

QUERY DeleteSummarySkillsFrom(id: String) =>
    edges <- N<Summaries>({id: id})::FIRST::OutE<SummarySkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteSummarySkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Summaries>({id: fromId})::FIRST::OutE<SummarySkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountSummarySkillsFrom(id: String) =>
    count <- N<Summaries>({id: id})::FIRST::OutE<SummarySkills>::COUNT
    RETURN count

QUERY AddCertificationSkills(fromId: String, toId: String, created_at?: String) =>
    from <- N<Certifications>({id: fromId})::FIRST
    to <- N<Skills>({id: toId})::FIRST
    edge <- AddE<CertificationSkills>::From(from)::To(to)
    RETURN edge

QUERY ListCertificationSkillsFrom(id: String) =>
    edges <- N<Certifications>({id: id})::FIRST::OutE<CertificationSkills>
    RETURN edges

QUERY ListCertificationSkillsTo(id: String) =>
    edges <- N<Skills>({id: id})::FIRST::InE<CertificationSkills>
    RETURN edges

QUERY DeleteCertificationSkillsFrom(id: String) =>
    edges <- N<Certifications>({id: id})::FIRST::OutE<CertificationSkills>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteCertificationSkillsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Certifications>({id: fromId})::FIRST::OutE<CertificationSkills>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountCertificationSkillsFrom(id: String) =>
    count <- N<Certifications>({id: id})::FIRST::OutE<CertificationSkills>::COUNT
    RETURN count

QUERY AddContactOrganizations(fromId: String, toId: String, relationship?: String) =>
    from <- N<Contacts>({id: fromId})::FIRST
    to <- N<Organizations>({id: toId})::FIRST
    edge <- AddE<ContactOrganizations>::From(from)::To(to)
    RETURN edge

QUERY ListContactOrganizationsFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactOrganizations>
    RETURN edges

QUERY ListContactOrganizationsTo(id: String) =>
    edges <- N<Organizations>({id: id})::FIRST::InE<ContactOrganizations>
    RETURN edges

QUERY DeleteContactOrganizationsFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactOrganizations>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteContactOrganizationsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Contacts>({id: fromId})::FIRST::OutE<ContactOrganizations>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountContactOrganizationsFrom(id: String) =>
    count <- N<Contacts>({id: id})::FIRST::OutE<ContactOrganizations>::COUNT
    RETURN count

QUERY AddContactJobDescriptions(fromId: String, toId: String, relationship?: String) =>
    from <- N<Contacts>({id: fromId})::FIRST
    to <- N<JobDescriptions>({id: toId})::FIRST
    edge <- AddE<ContactJobDescriptions>::From(from)::To(to)
    RETURN edge

QUERY ListContactJobDescriptionsFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactJobDescriptions>
    RETURN edges

QUERY ListContactJobDescriptionsTo(id: String) =>
    edges <- N<JobDescriptions>({id: id})::FIRST::InE<ContactJobDescriptions>
    RETURN edges

QUERY DeleteContactJobDescriptionsFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactJobDescriptions>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteContactJobDescriptionsByEndpoints(fromId: String, toId: String) =>
    edges <- N<Contacts>({id: fromId})::FIRST::OutE<ContactJobDescriptions>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountContactJobDescriptionsFrom(id: String) =>
    count <- N<Contacts>({id: id})::FIRST::OutE<ContactJobDescriptions>::COUNT
    RETURN count

QUERY AddContactResumes(fromId: String, toId: String, relationship?: String) =>
    from <- N<Contacts>({id: fromId})::FIRST
    to <- N<Resumes>({id: toId})::FIRST
    edge <- AddE<ContactResumes>::From(from)::To(to)
    RETURN edge

QUERY ListContactResumesFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactResumes>
    RETURN edges

QUERY ListContactResumesTo(id: String) =>
    edges <- N<Resumes>({id: id})::FIRST::InE<ContactResumes>
    RETURN edges

QUERY DeleteContactResumesFrom(id: String) =>
    edges <- N<Contacts>({id: id})::FIRST::OutE<ContactResumes>
    FOR edge IN edges {
        DROP edge
    }
    RETURN NONE

QUERY DeleteContactResumesByEndpoints(fromId: String, toId: String) =>
    edges <- N<Contacts>({id: fromId})::FIRST::OutE<ContactResumes>
    FOR edge IN edges {
        target <- edge::ToN
        DROP edge
    }
    RETURN NONE

QUERY CountContactResumesFrom(id: String) =>
    count <- N<Contacts>({id: id})::FIRST::OutE<ContactResumes>::COUNT
    RETURN count

// === jobs.hx ===
QUERY AddSummaries(id?: String, title?: String, role?: String, description?: String, is_template?: Boolean, industry_id?: String, role_type_id?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Summaries>({id: id, title: title, role: role, description: description, is_template: is_template, industry_id: industry_id, role_type_id: role_type_id, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetSummaries(id: String) =>
    node <- N<Summaries>({id: id})::FIRST
    RETURN node

QUERY UpdateSummaries(id: String, title?: String, role?: String, description?: String, is_template?: Boolean, industry_id?: String, role_type_id?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- N<Summaries>({id: id})::FIRST
    node <- node::UPDATE({title: title, role: role, description: description, is_template: is_template, industry_id: industry_id, role_type_id: role_type_id, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteSummaries(id: String) =>
    node <- N<Summaries>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSummaries(offset: U32, limit: U32) =>
    nodes <- N<Summaries>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSummaries() =>
    nodes <- N<Summaries>
    RETURN nodes

QUERY CountSummaries() =>
    count <- N<Summaries>::COUNT
    RETURN count

QUERY AddJobDescriptions(id?: String, organization_id?: String, title?: String, url?: String, raw_text?: String, status?: String, salary_range?: String, salary_min?: I64, salary_max?: I64, location?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<JobDescriptions>({id: id, organization_id: organization_id, title: title, url: url, raw_text: raw_text, status: status, salary_range: salary_range, salary_min: salary_min, salary_max: salary_max, location: location, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetJobDescriptions(id: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    RETURN node

QUERY UpdateJobDescriptions(id: String, organization_id?: String, title?: String, url?: String, raw_text?: String, status?: String, salary_range?: String, salary_min?: I64, salary_max?: I64, location?: String, notes?: String, created_at?: String, updated_at?: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, title: title, url: url, raw_text: raw_text, status: status, salary_range: salary_range, salary_min: salary_min, salary_max: salary_max, location: location, notes: notes, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteJobDescriptions(id: String) =>
    node <- N<JobDescriptions>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListJobDescriptions(offset: U32, limit: U32) =>
    nodes <- N<JobDescriptions>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllJobDescriptions() =>
    nodes <- N<JobDescriptions>
    RETURN nodes

QUERY CountJobDescriptions() =>
    count <- N<JobDescriptions>::COUNT
    RETURN count

// === named.hx ===
// Hand-written graph traversal queries that exploit HelixDB's native
// capabilities. These correspond to the named queries in
// packages/core/src/storage/named-queries.ts.

// traceChain: perspective → bullet → sources
QUERY TraceChain(perspectiveId: String) =>
    perspective <- N<Perspectives>({id: perspectiveId})::FIRST
    bullet <- N<Bullets>({id: perspective::{bullet_id}})::FIRST
    sources <- bullet::In<BulletSources>
    RETURN {perspective: perspective, bullet: bullet, sources: sources}

// listDriftedBullets: bullets where snapshot != primary source description
// Returns all bullets — drift comparison (snapshot vs current) is done in
// TypeScript since HQL doesn't support string inequality across traversals.
QUERY ListDriftedBullets() =>
    bullets <- N<Bullets>
    RETURN bullets

// listDriftedPerspectives: perspectives where snapshot != bullet content
// Returns all perspectives — drift comparison done in TypeScript.
QUERY ListDriftedPerspectives() =>
    perspectives <- N<Perspectives>
    RETURN perspectives

// === organizations.hx ===
QUERY AddOrganizations(id?: String, name?: String, org_type?: String, industry?: String, size?: String, worked?: Boolean, employment_type?: String, website?: String, linkedin_url?: String, glassdoor_url?: String, glassdoor_rating?: F64, reputation_notes?: String, notes?: String, status?: String, created_at?: String, updated_at?: String, industry_id?: String) =>
    node <- AddN<Organizations>({id: id, name: name, org_type: org_type, industry: industry, size: size, worked: worked, employment_type: employment_type, website: website, linkedin_url: linkedin_url, glassdoor_url: glassdoor_url, glassdoor_rating: glassdoor_rating, reputation_notes: reputation_notes, notes: notes, status: status, created_at: created_at, updated_at: updated_at, industry_id: industry_id})
    RETURN node

QUERY GetOrganizations(id: String) =>
    node <- N<Organizations>({id: id})::FIRST
    RETURN node

QUERY UpdateOrganizations(id: String, name?: String, org_type?: String, industry?: String, size?: String, worked?: Boolean, employment_type?: String, website?: String, linkedin_url?: String, glassdoor_url?: String, glassdoor_rating?: F64, reputation_notes?: String, notes?: String, status?: String, created_at?: String, updated_at?: String, industry_id?: String) =>
    node <- N<Organizations>({id: id})::FIRST
    node <- node::UPDATE({name: name, org_type: org_type, industry: industry, size: size, worked: worked, employment_type: employment_type, website: website, linkedin_url: linkedin_url, glassdoor_url: glassdoor_url, glassdoor_rating: glassdoor_rating, reputation_notes: reputation_notes, notes: notes, status: status, created_at: created_at, updated_at: updated_at, industry_id: industry_id})
    RETURN node

QUERY DeleteOrganizations(id: String) =>
    node <- N<Organizations>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrganizations(offset: U32, limit: U32) =>
    nodes <- N<Organizations>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrganizations() =>
    nodes <- N<Organizations>
    RETURN nodes

QUERY CountOrganizations() =>
    count <- N<Organizations>::COUNT
    RETURN count

QUERY AddOrgCampuses(id?: String, organization_id?: String, name?: String, modality?: String, address?: String, city?: String, state?: String, country?: String, created_at?: String, zipcode?: String, is_headquarters?: Boolean) =>
    node <- AddN<OrgCampuses>({id: id, organization_id: organization_id, name: name, modality: modality, address: address, city: city, state: state, country: country, created_at: created_at, zipcode: zipcode, is_headquarters: is_headquarters})
    RETURN node

QUERY GetOrgCampuses(id: String) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    RETURN node

QUERY UpdateOrgCampuses(id: String, organization_id?: String, name?: String, modality?: String, address?: String, city?: String, state?: String, country?: String, created_at?: String, zipcode?: String, is_headquarters?: Boolean) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, name: name, modality: modality, address: address, city: city, state: state, country: country, created_at: created_at, zipcode: zipcode, is_headquarters: is_headquarters})
    RETURN node

QUERY DeleteOrgCampuses(id: String) =>
    node <- N<OrgCampuses>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrgCampuses(offset: U32, limit: U32) =>
    nodes <- N<OrgCampuses>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgCampuses() =>
    nodes <- N<OrgCampuses>
    RETURN nodes

QUERY CountOrgCampuses() =>
    count <- N<OrgCampuses>::COUNT
    RETURN count

QUERY AddOrgTags(organization_id?: String, tag?: String) =>
    node <- AddN<OrgTags>({organization_id: organization_id, tag: tag})
    RETURN node

QUERY ListOrgTags(offset: U32, limit: U32) =>
    nodes <- N<OrgTags>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgTags() =>
    nodes <- N<OrgTags>
    RETURN nodes

QUERY CountOrgTags() =>
    count <- N<OrgTags>::COUNT
    RETURN count

QUERY AddOrgAliases(id?: String, organization_id?: String, alias?: String) =>
    node <- AddN<OrgAliases>({id: id, organization_id: organization_id, alias: alias})
    RETURN node

QUERY GetOrgAliases(id: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    RETURN node

QUERY UpdateOrgAliases(id: String, organization_id?: String, alias?: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    node <- node::UPDATE({organization_id: organization_id, alias: alias})
    RETURN node

QUERY DeleteOrgAliases(id: String) =>
    node <- N<OrgAliases>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListOrgAliases(offset: U32, limit: U32) =>
    nodes <- N<OrgAliases>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllOrgAliases() =>
    nodes <- N<OrgAliases>
    RETURN nodes

QUERY CountOrgAliases() =>
    count <- N<OrgAliases>::COUNT
    RETURN count

// === qualifications.hx ===
QUERY AddCredentials(id?: String, credential_type?: String, label?: String, status?: String, organization_id?: String, details?: String, issued_date?: String, expiry_date?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Credentials>({id: id, credential_type: credential_type, label: label, status: status, organization_id: organization_id, details: details, issued_date: issued_date, expiry_date: expiry_date, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetCredentials(id: String) =>
    node <- N<Credentials>({id: id})::FIRST
    RETURN node

QUERY UpdateCredentials(id: String, credential_type?: String, label?: String, status?: String, organization_id?: String, details?: String, issued_date?: String, expiry_date?: String, created_at?: String, updated_at?: String) =>
    node <- N<Credentials>({id: id})::FIRST
    node <- node::UPDATE({credential_type: credential_type, label: label, status: status, organization_id: organization_id, details: details, issued_date: issued_date, expiry_date: expiry_date, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteCredentials(id: String) =>
    node <- N<Credentials>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListCredentials(offset: U32, limit: U32) =>
    nodes <- N<Credentials>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllCredentials() =>
    nodes <- N<Credentials>
    RETURN nodes

QUERY CountCredentials() =>
    count <- N<Credentials>::COUNT
    RETURN count

QUERY AddCertifications(id?: String, short_name?: String, long_name?: String, cert_id?: String, issuer_id?: String, date_earned?: String, expiry_date?: String, credential_id?: String, credential_url?: String, credly_url?: String, in_progress?: Boolean, created_at?: String, updated_at?: String) =>
    node <- AddN<Certifications>({id: id, short_name: short_name, long_name: long_name, cert_id: cert_id, issuer_id: issuer_id, date_earned: date_earned, expiry_date: expiry_date, credential_id: credential_id, credential_url: credential_url, credly_url: credly_url, in_progress: in_progress, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetCertifications(id: String) =>
    node <- N<Certifications>({id: id})::FIRST
    RETURN node

QUERY UpdateCertifications(id: String, short_name?: String, long_name?: String, cert_id?: String, issuer_id?: String, date_earned?: String, expiry_date?: String, credential_id?: String, credential_url?: String, credly_url?: String, in_progress?: Boolean, created_at?: String, updated_at?: String) =>
    node <- N<Certifications>({id: id})::FIRST
    node <- node::UPDATE({short_name: short_name, long_name: long_name, cert_id: cert_id, issuer_id: issuer_id, date_earned: date_earned, expiry_date: expiry_date, credential_id: credential_id, credential_url: credential_url, credly_url: credly_url, in_progress: in_progress, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteCertifications(id: String) =>
    node <- N<Certifications>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListCertifications(offset: U32, limit: U32) =>
    nodes <- N<Certifications>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllCertifications() =>
    nodes <- N<Certifications>
    RETURN nodes

QUERY CountCertifications() =>
    count <- N<Certifications>::COUNT
    RETURN count

// === resumes.hx ===
QUERY AddResumes(id?: String, name?: String, target_role?: String, target_employer?: String, archetype?: String, status?: String, notes?: String, header?: String, summary_id?: String, markdown_override?: String, markdown_override_updated_at?: String, latex_override?: String, latex_override_updated_at?: String, created_at?: String, updated_at?: String, generated_tagline?: String, tagline_override?: String, summary_override?: String, summary_override_updated_at?: String, show_clearance_in_header?: Boolean) =>
    node <- AddN<Resumes>({id: id, name: name, target_role: target_role, target_employer: target_employer, archetype: archetype, status: status, notes: notes, header: header, summary_id: summary_id, markdown_override: markdown_override, markdown_override_updated_at: markdown_override_updated_at, latex_override: latex_override, latex_override_updated_at: latex_override_updated_at, created_at: created_at, updated_at: updated_at, generated_tagline: generated_tagline, tagline_override: tagline_override, summary_override: summary_override, summary_override_updated_at: summary_override_updated_at, show_clearance_in_header: show_clearance_in_header})
    RETURN node

QUERY GetResumes(id: String) =>
    node <- N<Resumes>({id: id})::FIRST
    RETURN node

QUERY UpdateResumes(id: String, name?: String, target_role?: String, target_employer?: String, archetype?: String, status?: String, notes?: String, header?: String, summary_id?: String, markdown_override?: String, markdown_override_updated_at?: String, latex_override?: String, latex_override_updated_at?: String, created_at?: String, updated_at?: String, generated_tagline?: String, tagline_override?: String, summary_override?: String, summary_override_updated_at?: String, show_clearance_in_header?: Boolean) =>
    node <- N<Resumes>({id: id})::FIRST
    node <- node::UPDATE({name: name, target_role: target_role, target_employer: target_employer, archetype: archetype, status: status, notes: notes, header: header, summary_id: summary_id, markdown_override: markdown_override, markdown_override_updated_at: markdown_override_updated_at, latex_override: latex_override, latex_override_updated_at: latex_override_updated_at, created_at: created_at, updated_at: updated_at, generated_tagline: generated_tagline, tagline_override: tagline_override, summary_override: summary_override, summary_override_updated_at: summary_override_updated_at, show_clearance_in_header: show_clearance_in_header})
    RETURN node

QUERY DeleteResumes(id: String) =>
    node <- N<Resumes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumes(offset: U32, limit: U32) =>
    nodes <- N<Resumes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumes() =>
    nodes <- N<Resumes>
    RETURN nodes

QUERY CountResumes() =>
    count <- N<Resumes>::COUNT
    RETURN count

QUERY AddResumeSections(id?: String, resume_id?: String, title?: String, entry_type?: String, position?: I64, created_at?: String, updated_at?: String) =>
    node <- AddN<ResumeSections>({id: id, resume_id: resume_id, title: title, entry_type: entry_type, position: position, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetResumeSections(id: String) =>
    node <- N<ResumeSections>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeSections(id: String, resume_id?: String, title?: String, entry_type?: String, position?: I64, created_at?: String, updated_at?: String) =>
    node <- N<ResumeSections>({id: id})::FIRST
    node <- node::UPDATE({resume_id: resume_id, title: title, entry_type: entry_type, position: position, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteResumeSections(id: String) =>
    node <- N<ResumeSections>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumeSections(offset: U32, limit: U32) =>
    nodes <- N<ResumeSections>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumeSections() =>
    nodes <- N<ResumeSections>
    RETURN nodes

QUERY CountResumeSections() =>
    count <- N<ResumeSections>::COUNT
    RETURN count

QUERY AddResumeEntries(id?: String, resume_id?: String, section_id?: String, perspective_id?: String, content?: String, perspective_content_snapshot?: String, position?: I64, notes?: String, created_at?: String, updated_at?: String, source_id?: String) =>
    node <- AddN<ResumeEntries>({id: id, resume_id: resume_id, section_id: section_id, perspective_id: perspective_id, content: content, perspective_content_snapshot: perspective_content_snapshot, position: position, notes: notes, created_at: created_at, updated_at: updated_at, source_id: source_id})
    RETURN node

QUERY GetResumeEntries(id: String) =>
    node <- N<ResumeEntries>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeEntries(id: String, resume_id?: String, section_id?: String, perspective_id?: String, content?: String, perspective_content_snapshot?: String, position?: I64, notes?: String, created_at?: String, updated_at?: String, source_id?: String) =>
    node <- N<ResumeEntries>({id: id})::FIRST
    node <- node::UPDATE({resume_id: resume_id, section_id: section_id, perspective_id: perspective_id, content: content, perspective_content_snapshot: perspective_content_snapshot, position: position, notes: notes, created_at: created_at, updated_at: updated_at, source_id: source_id})
    RETURN node

QUERY DeleteResumeEntries(id: String) =>
    node <- N<ResumeEntries>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumeEntries(offset: U32, limit: U32) =>
    nodes <- N<ResumeEntries>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumeEntries() =>
    nodes <- N<ResumeEntries>
    RETURN nodes

QUERY CountResumeEntries() =>
    count <- N<ResumeEntries>::COUNT
    RETURN count

QUERY AddResumeSkills(id?: String, section_id?: String, skill_id?: String, position?: I64, created_at?: String) =>
    node <- AddN<ResumeSkills>({id: id, section_id: section_id, skill_id: skill_id, position: position, created_at: created_at})
    RETURN node

QUERY GetResumeSkills(id: String) =>
    node <- N<ResumeSkills>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeSkills(id: String, section_id?: String, skill_id?: String, position?: I64, created_at?: String) =>
    node <- N<ResumeSkills>({id: id})::FIRST
    node <- node::UPDATE({section_id: section_id, skill_id: skill_id, position: position, created_at: created_at})
    RETURN node

QUERY DeleteResumeSkills(id: String) =>
    node <- N<ResumeSkills>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumeSkills(offset: U32, limit: U32) =>
    nodes <- N<ResumeSkills>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumeSkills() =>
    nodes <- N<ResumeSkills>
    RETURN nodes

QUERY CountResumeSkills() =>
    count <- N<ResumeSkills>::COUNT
    RETURN count

QUERY AddResumeCertifications(id?: String, resume_id?: String, certification_id?: String, section_id?: String, position?: I64, created_at?: String) =>
    node <- AddN<ResumeCertifications>({id: id, resume_id: resume_id, certification_id: certification_id, section_id: section_id, position: position, created_at: created_at})
    RETURN node

QUERY GetResumeCertifications(id: String) =>
    node <- N<ResumeCertifications>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeCertifications(id: String, resume_id?: String, certification_id?: String, section_id?: String, position?: I64, created_at?: String) =>
    node <- N<ResumeCertifications>({id: id})::FIRST
    node <- node::UPDATE({resume_id: resume_id, certification_id: certification_id, section_id: section_id, position: position, created_at: created_at})
    RETURN node

QUERY DeleteResumeCertifications(id: String) =>
    node <- N<ResumeCertifications>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumeCertifications(offset: U32, limit: U32) =>
    nodes <- N<ResumeCertifications>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumeCertifications() =>
    nodes <- N<ResumeCertifications>
    RETURN nodes

QUERY CountResumeCertifications() =>
    count <- N<ResumeCertifications>::COUNT
    RETURN count

QUERY AddResumeTemplates(id?: String, name?: String, description?: String, sections?: String, is_builtin?: Boolean, created_at?: String, updated_at?: String) =>
    node <- AddN<ResumeTemplates>({id: id, name: name, description: description, sections: sections, is_builtin: is_builtin, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetResumeTemplates(id: String) =>
    node <- N<ResumeTemplates>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeTemplates(id: String, name?: String, description?: String, sections?: String, is_builtin?: Boolean, created_at?: String, updated_at?: String) =>
    node <- N<ResumeTemplates>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, sections: sections, is_builtin: is_builtin, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteResumeTemplates(id: String) =>
    node <- N<ResumeTemplates>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListResumeTemplates(offset: U32, limit: U32) =>
    nodes <- N<ResumeTemplates>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllResumeTemplates() =>
    nodes <- N<ResumeTemplates>
    RETURN nodes

QUERY CountResumeTemplates() =>
    count <- N<ResumeTemplates>::COUNT
    RETURN count

// === system.hx ===
QUERY AddPromptLogs(id?: String, entity_type?: String, entity_id?: String, prompt_template?: String, prompt_input?: String, raw_response?: String, created_at?: String) =>
    node <- AddN<PromptLogs>({id: id, entity_type: entity_type, entity_id: entity_id, prompt_template: prompt_template, prompt_input: prompt_input, raw_response: raw_response, created_at: created_at})
    RETURN node

QUERY GetPromptLogs(id: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    RETURN node

QUERY UpdatePromptLogs(id: String, entity_type?: String, entity_id?: String, prompt_template?: String, prompt_input?: String, raw_response?: String, created_at?: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, prompt_template: prompt_template, prompt_input: prompt_input, raw_response: raw_response, created_at: created_at})
    RETURN node

QUERY DeletePromptLogs(id: String) =>
    node <- N<PromptLogs>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListPromptLogs(offset: U32, limit: U32) =>
    nodes <- N<PromptLogs>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllPromptLogs() =>
    nodes <- N<PromptLogs>
    RETURN nodes

QUERY CountPromptLogs() =>
    count <- N<PromptLogs>::COUNT
    RETURN count

QUERY AddEmbeddings(id?: String, entity_type?: String, entity_id?: String, content_hash?: String, vector?: String, created_at?: String) =>
    node <- AddN<Embeddings>({id: id, entity_type: entity_type, entity_id: entity_id, content_hash: content_hash, vector: vector, created_at: created_at})
    RETURN node

QUERY GetEmbeddings(id: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    RETURN node

QUERY UpdateEmbeddings(id: String, entity_type?: String, entity_id?: String, content_hash?: String, vector?: String, created_at?: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, content_hash: content_hash, vector: vector, created_at: created_at})
    RETURN node

QUERY DeleteEmbeddings(id: String) =>
    node <- N<Embeddings>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListEmbeddings(offset: U32, limit: U32) =>
    nodes <- N<Embeddings>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllEmbeddings() =>
    nodes <- N<Embeddings>
    RETURN nodes

QUERY CountEmbeddings() =>
    count <- N<Embeddings>::COUNT
    RETURN count

QUERY AddPendingDerivations(id?: String, entity_type?: String, entity_id?: String, client_id?: String, prompt?: String, snapshot?: String, derivation_params?: String, locked_at?: String, expires_at?: String, created_at?: String) =>
    node <- AddN<PendingDerivations>({id: id, entity_type: entity_type, entity_id: entity_id, client_id: client_id, prompt: prompt, snapshot: snapshot, derivation_params: derivation_params, locked_at: locked_at, expires_at: expires_at, created_at: created_at})
    RETURN node

QUERY GetPendingDerivations(id: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    RETURN node

QUERY UpdatePendingDerivations(id: String, entity_type?: String, entity_id?: String, client_id?: String, prompt?: String, snapshot?: String, derivation_params?: String, locked_at?: String, expires_at?: String, created_at?: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    node <- node::UPDATE({entity_type: entity_type, entity_id: entity_id, client_id: client_id, prompt: prompt, snapshot: snapshot, derivation_params: derivation_params, locked_at: locked_at, expires_at: expires_at, created_at: created_at})
    RETURN node

QUERY DeletePendingDerivations(id: String) =>
    node <- N<PendingDerivations>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListPendingDerivations(offset: U32, limit: U32) =>
    nodes <- N<PendingDerivations>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllPendingDerivations() =>
    nodes <- N<PendingDerivations>
    RETURN nodes

QUERY CountPendingDerivations() =>
    count <- N<PendingDerivations>::COUNT
    RETURN count

// === taxonomy.hx ===
QUERY AddSkills(id?: String, name?: String, category?: String, notes?: String, created_at?: String) =>
    node <- AddN<Skills>({id: id, name: name, category: category, notes: notes, created_at: created_at})
    RETURN node

QUERY GetSkills(id: String) =>
    node <- N<Skills>({id: id})::FIRST
    RETURN node

QUERY GetSkillsByName(name: String) =>
    nodes <- N<Skills>({name: name})
    RETURN nodes

QUERY UpdateSkills(id: String, name?: String, category?: String, notes?: String, created_at?: String) =>
    node <- N<Skills>({id: id})::FIRST
    node <- node::UPDATE({name: name, category: category, notes: notes, created_at: created_at})
    RETURN node

QUERY DeleteSkills(id: String) =>
    node <- N<Skills>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSkills(offset: U32, limit: U32) =>
    nodes <- N<Skills>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSkills() =>
    nodes <- N<Skills>
    RETURN nodes

QUERY CountSkills() =>
    count <- N<Skills>::COUNT
    RETURN count

QUERY AddSkillCategories(id?: String, slug?: String, display_name?: String, position?: I64) =>
    node <- AddN<SkillCategories>({id: id, slug: slug, display_name: display_name, position: position})
    RETURN node

QUERY GetSkillCategories(id: String) =>
    node <- N<SkillCategories>({id: id})::FIRST
    RETURN node

QUERY GetSkillCategoriesBySlug(slug: String) =>
    nodes <- N<SkillCategories>({slug: slug})
    RETURN nodes

QUERY UpdateSkillCategories(id: String, slug?: String, display_name?: String, position?: I64) =>
    node <- N<SkillCategories>({id: id})::FIRST
    node <- node::UPDATE({slug: slug, display_name: display_name, position: position})
    RETURN node

QUERY DeleteSkillCategories(id: String) =>
    node <- N<SkillCategories>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListSkillCategories(offset: U32, limit: U32) =>
    nodes <- N<SkillCategories>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllSkillCategories() =>
    nodes <- N<SkillCategories>
    RETURN nodes

QUERY CountSkillCategories() =>
    count <- N<SkillCategories>::COUNT
    RETURN count

QUERY AddDomains(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Domains>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetDomains(id: String) =>
    node <- N<Domains>({id: id})::FIRST
    RETURN node

QUERY GetDomainsByName(name: String) =>
    nodes <- N<Domains>({name: name})
    RETURN nodes

QUERY UpdateDomains(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Domains>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteDomains(id: String) =>
    node <- N<Domains>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListDomains(offset: U32, limit: U32) =>
    nodes <- N<Domains>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllDomains() =>
    nodes <- N<Domains>
    RETURN nodes

QUERY CountDomains() =>
    count <- N<Domains>::COUNT
    RETURN count

QUERY AddArchetypes(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Archetypes>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetArchetypes(id: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    RETURN node

QUERY GetArchetypesByName(name: String) =>
    nodes <- N<Archetypes>({name: name})
    RETURN nodes

QUERY UpdateArchetypes(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteArchetypes(id: String) =>
    node <- N<Archetypes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListArchetypes(offset: U32, limit: U32) =>
    nodes <- N<Archetypes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllArchetypes() =>
    nodes <- N<Archetypes>
    RETURN nodes

QUERY CountArchetypes() =>
    count <- N<Archetypes>::COUNT
    RETURN count

QUERY AddIndustries(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<Industries>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetIndustries(id: String) =>
    node <- N<Industries>({id: id})::FIRST
    RETURN node

QUERY GetIndustriesByName(name: String) =>
    nodes <- N<Industries>({name: name})
    RETURN nodes

QUERY UpdateIndustries(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<Industries>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteIndustries(id: String) =>
    node <- N<Industries>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListIndustries(offset: U32, limit: U32) =>
    nodes <- N<Industries>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllIndustries() =>
    nodes <- N<Industries>
    RETURN nodes

QUERY CountIndustries() =>
    count <- N<Industries>::COUNT
    RETURN count

QUERY AddRoleTypes(id?: String, name?: String, description?: String, created_at?: String) =>
    node <- AddN<RoleTypes>({id: id, name: name, description: description, created_at: created_at})
    RETURN node

QUERY GetRoleTypes(id: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    RETURN node

QUERY GetRoleTypesByName(name: String) =>
    nodes <- N<RoleTypes>({name: name})
    RETURN nodes

QUERY UpdateRoleTypes(id: String, name?: String, description?: String, created_at?: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    node <- node::UPDATE({name: name, description: description, created_at: created_at})
    RETURN node

QUERY DeleteRoleTypes(id: String) =>
    node <- N<RoleTypes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListRoleTypes(offset: U32, limit: U32) =>
    nodes <- N<RoleTypes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllRoleTypes() =>
    nodes <- N<RoleTypes>
    RETURN nodes

QUERY CountRoleTypes() =>
    count <- N<RoleTypes>::COUNT
    RETURN count

// === user.hx ===
QUERY AddAddresses(id?: String, name?: String, street_1?: String, street_2?: String, city?: String, state?: String, zip?: String, country_code?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Addresses>({id: id, name: name, street_1: street_1, street_2: street_2, city: city, state: state, zip: zip, country_code: country_code, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetAddresses(id: String) =>
    node <- N<Addresses>({id: id})::FIRST
    RETURN node

QUERY UpdateAddresses(id: String, name?: String, street_1?: String, street_2?: String, city?: String, state?: String, zip?: String, country_code?: String, created_at?: String, updated_at?: String) =>
    node <- N<Addresses>({id: id})::FIRST
    node <- node::UPDATE({name: name, street_1: street_1, street_2: street_2, city: city, state: state, zip: zip, country_code: country_code, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteAddresses(id: String) =>
    node <- N<Addresses>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListAddresses(offset: U32, limit: U32) =>
    nodes <- N<Addresses>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllAddresses() =>
    nodes <- N<Addresses>
    RETURN nodes

QUERY CountAddresses() =>
    count <- N<Addresses>::COUNT
    RETURN count

QUERY AddProfileUrls(id?: String, profile_id?: String, key?: String, url?: String, position?: I64, created_at?: String) =>
    node <- AddN<ProfileUrls>({id: id, profile_id: profile_id, key: key, url: url, position: position, created_at: created_at})
    RETURN node

QUERY GetProfileUrls(id: String) =>
    node <- N<ProfileUrls>({id: id})::FIRST
    RETURN node

QUERY UpdateProfileUrls(id: String, profile_id?: String, key?: String, url?: String, position?: I64, created_at?: String) =>
    node <- N<ProfileUrls>({id: id})::FIRST
    node <- node::UPDATE({profile_id: profile_id, key: key, url: url, position: position, created_at: created_at})
    RETURN node

QUERY DeleteProfileUrls(id: String) =>
    node <- N<ProfileUrls>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListProfileUrls(offset: U32, limit: U32) =>
    nodes <- N<ProfileUrls>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllProfileUrls() =>
    nodes <- N<ProfileUrls>
    RETURN nodes

QUERY CountProfileUrls() =>
    count <- N<ProfileUrls>::COUNT
    RETURN count

QUERY AddUserProfile(id?: String, name?: String, email?: String, phone?: String, address_id?: String, salary_minimum?: I64, salary_target?: I64, salary_stretch?: I64, created_at?: String, updated_at?: String) =>
    node <- AddN<UserProfile>({id: id, name: name, email: email, phone: phone, address_id: address_id, salary_minimum: salary_minimum, salary_target: salary_target, salary_stretch: salary_stretch, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetUserProfile(id: String) =>
    node <- N<UserProfile>({id: id})::FIRST
    RETURN node

QUERY UpdateUserProfile(id: String, name?: String, email?: String, phone?: String, address_id?: String, salary_minimum?: I64, salary_target?: I64, salary_stretch?: I64, created_at?: String, updated_at?: String) =>
    node <- N<UserProfile>({id: id})::FIRST
    node <- node::UPDATE({name: name, email: email, phone: phone, address_id: address_id, salary_minimum: salary_minimum, salary_target: salary_target, salary_stretch: salary_stretch, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteUserProfile(id: String) =>
    node <- N<UserProfile>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListUserProfile(offset: U32, limit: U32) =>
    nodes <- N<UserProfile>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllUserProfile() =>
    nodes <- N<UserProfile>
    RETURN nodes

QUERY CountUserProfile() =>
    count <- N<UserProfile>::COUNT
    RETURN count

QUERY AddUserNotes(id?: String, title?: String, content?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<UserNotes>({id: id, title: title, content: content, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetUserNotes(id: String) =>
    node <- N<UserNotes>({id: id})::FIRST
    RETURN node

QUERY UpdateUserNotes(id: String, title?: String, content?: String, created_at?: String, updated_at?: String) =>
    node <- N<UserNotes>({id: id})::FIRST
    node <- node::UPDATE({title: title, content: content, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY DeleteUserNotes(id: String) =>
    node <- N<UserNotes>({id: id})::FIRST
    DROP node
    RETURN NONE

QUERY ListUserNotes(offset: U32, limit: U32) =>
    nodes <- N<UserNotes>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllUserNotes() =>
    nodes <- N<UserNotes>
    RETURN nodes

QUERY CountUserNotes() =>
    count <- N<UserNotes>::COUNT
    RETURN count

QUERY AddNoteReferences(note_id?: String, entity_type?: String, entity_id?: String) =>
    node <- AddN<NoteReferences>({note_id: note_id, entity_type: entity_type, entity_id: entity_id})
    RETURN node

QUERY ListNoteReferences(offset: U32, limit: U32) =>
    nodes <- N<NoteReferences>::RANGE(offset, ADD(offset, limit))
    RETURN nodes

QUERY ListAllNoteReferences() =>
    nodes <- N<NoteReferences>
    RETURN nodes

QUERY CountNoteReferences() =>
    count <- N<NoteReferences>::COUNT
    RETURN count
