// === resumes.hx ===

QUERY AddResumes(id?: String, name?: String, target_role?: String, target_employer?: String, archetype?: String, status?: String, header?: String, summary_id?: String, markdown_override?: String, markdown_override_updated_at?: String, latex_override?: String, latex_override_updated_at?: String, created_at?: String, updated_at?: String, generated_tagline?: String, tagline_override?: String, summary_override?: String, summary_override_updated_at?: String, show_clearance_in_header?: Boolean) =>
    node <- AddN<Resumes>({id: id, name: name, target_role: target_role, target_employer: target_employer, archetype: archetype, status: status, header: header, summary_id: summary_id, markdown_override: markdown_override, markdown_override_updated_at: markdown_override_updated_at, latex_override: latex_override, latex_override_updated_at: latex_override_updated_at, created_at: created_at, updated_at: updated_at, generated_tagline: generated_tagline, tagline_override: tagline_override, summary_override: summary_override, summary_override_updated_at: summary_override_updated_at, show_clearance_in_header: show_clearance_in_header})
    RETURN node

QUERY GetResumes(id: String) =>
    node <- N<Resumes>({id: id})::FIRST
    RETURN node

QUERY UpdateResumes(id: String, name?: String, target_role?: String, target_employer?: String, archetype?: String, status?: String, header?: String, summary_id?: String, markdown_override?: String, markdown_override_updated_at?: String, latex_override?: String, latex_override_updated_at?: String, created_at?: String, updated_at?: String, generated_tagline?: String, tagline_override?: String, summary_override?: String, summary_override_updated_at?: String, show_clearance_in_header?: Boolean) =>
    node <- N<Resumes>({id: id})::FIRST
    node <- node::UPDATE({name: name, target_role: target_role, target_employer: target_employer, archetype: archetype, status: status, header: header, summary_id: summary_id, markdown_override: markdown_override, markdown_override_updated_at: markdown_override_updated_at, latex_override: latex_override, latex_override_updated_at: latex_override_updated_at, created_at: created_at, updated_at: updated_at, generated_tagline: generated_tagline, tagline_override: tagline_override, summary_override: summary_override, summary_override_updated_at: summary_override_updated_at, show_clearance_in_header: show_clearance_in_header})
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

QUERY AddResumeEntries(id?: String, resume_id?: String, section_id?: String, perspective_id?: String, content?: String, perspective_content_snapshot?: String, position?: I64, created_at?: String, updated_at?: String, source_id?: String) =>
    node <- AddN<ResumeEntries>({id: id, resume_id: resume_id, section_id: section_id, perspective_id: perspective_id, content: content, perspective_content_snapshot: perspective_content_snapshot, position: position, created_at: created_at, updated_at: updated_at, source_id: source_id})
    RETURN node

QUERY GetResumeEntries(id: String) =>
    node <- N<ResumeEntries>({id: id})::FIRST
    RETURN node

QUERY UpdateResumeEntries(id: String, resume_id?: String, section_id?: String, perspective_id?: String, content?: String, perspective_content_snapshot?: String, position?: I64, created_at?: String, updated_at?: String, source_id?: String) =>
    node <- N<ResumeEntries>({id: id})::FIRST
    node <- node::UPDATE({resume_id: resume_id, section_id: section_id, perspective_id: perspective_id, content: content, perspective_content_snapshot: perspective_content_snapshot, position: position, created_at: created_at, updated_at: updated_at, source_id: source_id})
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
