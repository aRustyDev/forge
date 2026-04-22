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
