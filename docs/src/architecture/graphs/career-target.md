# Career Target Graph

> Type: Future, computed + persistent snapshots
> Status: Design

## Purpose

Strategic gap analysis — "what do I need to learn?" Answers a different question than alignment scoring: alignment is per-resume × per-JD, Career Target is aggregate experience × target archetype.

## Two Modes

### Per-JD Career Target

"What do I need to be competitive for THIS specific JD?"

Extends the Alignment Graph gap report with actionable recommendations:
- Not just "you're missing Python" but "here's what to do: take this course, build this project, get this cert"
- Connects gaps to the Certification Graph (what cert covers this gap?)
- Connects gaps to the Domain/Archetype Graph (is this gap critical for this archetype?)

### Global Career Target

"Given ALL saved JDs (or a filtered subset), what should I invest in?"

Aggregate skill demand across JDs, weighted by interest:
```
Unweighted demand:
  Python: needed by 80% of saved JDs
  Kubernetes: needed by 60%
  Graph ML: needed by 40%

Interest weights (from archetype targets + JD starring):
  ML Research direction: weight 3x
  DevOps direction: weight 0.5x

Weighted priority:
  Graph ML: 40% × 3x = 1.2   ← focus here
  Python: 80% × 1.5x = 1.2   ← equally important
  Kubernetes: 60% × 0.5x = 0.3  ← lower priority
```

## Interest Weighting (Interest Epistemology)

Rather than a separate graph, interest is a **weighting function** on the Career Target:

- User sets archetype targets (e.g., "ML Research" = high priority, "DevOps" = low)
- JD starring/priority applies per-JD weights
- These weights multiply skill demand to produce prioritized gap lists

## Temporal Snapshots

Storing timestamped target changes captures interest epistemology without a separate graph:

```
2024-Q1: target=DevOps, weight=3x → priority: Terraform, K8s, CI/CD
2025-Q1: target=Security, weight=3x → priority: DFIR, Threat Hunting
2026-Q1: target=ML Research, weight=3x → priority: PyTorch, Statistics, Interp
```

The delta between snapshots IS the interest trajectory. No separate "interest graph" needed.

## Dependencies

- Requires: Skill Graph (for skill relationships)
- Requires: Domain/Archetype Graph (for archetype definitions and expected skills)
- Optionally uses: Certification Graph (for cert recommendations)
- Optionally uses: Job Market Epistemology stats (for market-aware prioritization)
