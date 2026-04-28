# Domain / Archetype Graph

> Type: Future, persistent
> Status: Design

## Purpose

Career navigation, skill clustering, archetype definitions. Sits ABOVE the Skill Graph — groups skills into meaningful clusters and defines career navigation paths.

## Structure

```
Archetype: "ML Research Engineer"
  ├── expects → [PyTorch, Statistics, Experiment Design, Python, Linux]
  ├── career_path_from → "ML Engineer", "Software Engineer"
  ├── career_path_to → "Research Scientist"
  └── domain → "AI/ML"

Domain: "Cybersecurity"
  ├── typical_skills → [DFIR, Threat Hunting, SIEM, Network Analysis]
  ├── overlaps_with → "AI Safety" (emerging overlap)
  ├── overlaps_with → "DevOps" (via cloud security)
  └── typical_archetypes → ["Security Analyst", "Security Engineer", "Pentester"]
```

## What This Powers

- **JD classification:** "This JD is for an ML Research Engineer archetype in the AI/ML domain"
- **Summary selection:** "Use the ML-focused summary for this archetype"
- **Skill prioritization:** "For this archetype, Python matters more than Bash"
- **Career Target analysis:** The "target" in Career Target IS an archetype node
- **Future: archetype-weighted alignment:** A DevOps JD values Terraform higher than a Data Science JD

## Edge Types

| Type | Semantics | Example |
|------|-----------|---------|
| `expects` | Archetype → Skills (cluster) | ML Research Engineer → PyTorch |
| `career_path_from` | Archetype → Archetype (transition) | ML Engineer → ML Research Engineer |
| `career_path_to` | Archetype → Archetype (progression) | ML Research Engineer → Research Scientist |
| `domain` | Archetype → Domain (membership) | ML Research Engineer → AI/ML |
| `overlaps_with` | Domain → Domain (adjacency) | Cybersecurity ↔ AI Safety |
| `typical_skills` | Domain → Skills (aggregate) | Cybersecurity → [DFIR, Threat Hunting, ...] |
| `typical_archetypes` | Domain → Archetypes | Cybersecurity → [Security Analyst, ...] |

## Connection to Org Graph

Industry → Domain edges link the Organization Graph to this graph:
- "Cybersecurity Vendors" (industry) → "Cybersecurity" (domain)
- This means: when we see a JD from CrowdStrike, we know the domain context
