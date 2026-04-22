// === edges.hx ===

E::BulletSkills {
    From: Bullets,
    To: Skills
}

E::BulletSources {
    From: Bullets,
    To: Sources,
    Properties: {
        is_primary: Boolean DEFAULT false
    }
}

E::PerspectiveSkills {
    From: Perspectives,
    To: Skills
}

E::SourceSkills {
    From: Sources,
    To: Skills
}

E::SkillDomains {
    From: Skills,
    To: Domains,
    Properties: {
        created_at: String
    }
}

E::ArchetypeDomains {
    From: Archetypes,
    To: Domains,
    Properties: {
        created_at: String
    }
}

E::JobDescriptionSkills {
    From: JobDescriptions,
    To: Skills
}

E::JobDescriptionResumes {
    From: JobDescriptions,
    To: Resumes,
    Properties: {
        created_at: String
    }
}

E::SummarySkills {
    From: Summaries,
    To: Skills,
    Properties: {
        created_at: String
    }
}

E::CertificationSkills {
    From: Certifications,
    To: Skills,
    Properties: {
        created_at: String
    }
}

E::ContactOrganizations {
    From: Contacts,
    To: Organizations,
    Properties: {
        relationship: String
    }
}

E::ContactJobDescriptions {
    From: Contacts,
    To: JobDescriptions,
    Properties: {
        relationship: String
    }
}

E::ContactResumes {
    From: Contacts,
    To: Resumes,
    Properties: {
        relationship: String
    }
}
