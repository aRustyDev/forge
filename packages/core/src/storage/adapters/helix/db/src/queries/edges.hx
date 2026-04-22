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
