// === content.hx ===

QUERY AddSources(id?: String, title?: String, description?: String, source_type?: String, start_date?: String, end_date?: String, status?: String, updated_by?: String, last_derived_at?: String, created_at?: String, updated_at?: String) =>
    node <- AddN<Sources>({id: id, title: title, description: description, source_type: source_type, start_date: start_date, end_date: end_date, status: status, updated_by: updated_by, last_derived_at: last_derived_at, created_at: created_at, updated_at: updated_at})
    RETURN node

QUERY GetSources(id: String) =>
    node <- N<Sources>({id: id})::FIRST
    RETURN node

QUERY UpdateSources(id: String, title?: String, description?: String, source_type?: String, start_date?: String, end_date?: String, status?: String, updated_by?: String, last_derived_at?: String, created_at?: String, updated_at?: String) =>
    node <- N<Sources>({id: id})::FIRST
    node <- node::UPDATE({title: title, description: description, source_type: source_type, start_date: start_date, end_date: end_date, status: status, updated_by: updated_by, last_derived_at: last_derived_at, created_at: created_at, updated_at: updated_at})
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

QUERY AddBullets(id?: String, content?: String, source_content_snapshot?: String, metrics?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, domain?: String, created_at?: String) =>
    node <- AddN<Bullets>({id: id, content: content, source_content_snapshot: source_content_snapshot, metrics: metrics, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, domain: domain, created_at: created_at})
    RETURN node

QUERY GetBullets(id: String) =>
    node <- N<Bullets>({id: id})::FIRST
    RETURN node

QUERY UpdateBullets(id: String, content?: String, source_content_snapshot?: String, metrics?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, domain?: String, created_at?: String) =>
    node <- N<Bullets>({id: id})::FIRST
    node <- node::UPDATE({content: content, source_content_snapshot: source_content_snapshot, metrics: metrics, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, domain: domain, created_at: created_at})
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

QUERY AddPerspectives(id?: String, bullet_id?: String, content?: String, bullet_content_snapshot?: String, target_archetype?: String, domain?: String, framing?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, created_at?: String) =>
    node <- AddN<Perspectives>({id: id, bullet_id: bullet_id, content: content, bullet_content_snapshot: bullet_content_snapshot, target_archetype: target_archetype, domain: domain, framing: framing, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, created_at: created_at})
    RETURN node

QUERY GetPerspectives(id: String) =>
    node <- N<Perspectives>({id: id})::FIRST
    RETURN node

QUERY UpdatePerspectives(id: String, bullet_id?: String, content?: String, bullet_content_snapshot?: String, target_archetype?: String, domain?: String, framing?: String, status?: String, rejection_reason?: String, prompt_log_id?: String, approved_at?: String, approved_by?: String, created_at?: String) =>
    node <- N<Perspectives>({id: id})::FIRST
    node <- node::UPDATE({bullet_id: bullet_id, content: content, bullet_content_snapshot: bullet_content_snapshot, target_archetype: target_archetype, domain: domain, framing: framing, status: status, rejection_reason: rejection_reason, prompt_log_id: prompt_log_id, approved_at: approved_at, approved_by: approved_by, created_at: created_at})
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
