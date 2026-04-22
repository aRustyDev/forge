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
