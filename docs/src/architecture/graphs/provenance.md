# Provenance Graph

> Type: Persistent, implicit in relational schema
> Status: Exists (not explicitly modeled as a graph)

## Purpose

Content lineage — tracing where resume content came from. Answering "which bullets feed this resume?" and "which resumes use this bullet?"

## Structure

```
Source (Role at Org)
  → Bullet ("Managed K8s clusters...")
    → Perspective (reframed for DevOps resume)
      → Resume Entry (in Resume "Anthropic Fellows")
        → Resume Section ("Experience")
```

## Query Patterns

- "Show all resumes using bullets from this role"
- "What perspectives exist for this bullet?"
- "If I update this bullet, which resumes are affected?"
- "What's the provenance chain for this resume entry?" (trace back to original source)

## Current Implementation

This graph is implicit in the relational schema via foreign keys:
- `resume_entries.perspective_id` → `perspectives.id`
- `perspectives.bullet_id` → `bullets.id`
- `bullets.source_id` → `sources.id`
- `sources.organization_id` → `organizations.id`

No separate graph storage is needed — SQL joins traverse the provenance chain.

## Connection to Alignment

When alignment scoring finds a match ("your resume matches this JD requirement"), the provenance graph answers "which specific bullet demonstrates this skill?" This makes alignment results actionable — the user can see exactly where the evidence is.
