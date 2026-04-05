-- Forge Resume Builder — Null auto-populated content on direct-source entries
-- Migration: 036_null_auto_content_on_direct_source_entries
-- Date: 2026-04-05
--
-- NOTE on numbering: 035 is reserved for Phase 92 (Tagline Engine) being
-- developed in a parallel worktree. This migration is 036 to stay clear
-- of that reservation.
--
-- Follow-up data repair for migration 034. An earlier version of
-- SourcePicker passed `content = source.description` alongside `source_id`
-- for direct-source (perspective-less) entries. That put those entries in
-- clone/override mode with auto-populated text, which prevented the IR
-- compiler from falling back to `source.title` for the display label.
--
-- Concretely, education entries added via the picker rendered as the
-- source description ("GIAC certifications included") instead of the
-- canonical source title ("Cloud Security"), and certifications showed
-- verbose descriptions instead of their short identifier.
--
-- SourcePicker has since been fixed to pass only `source_id`. This
-- migration cleans up the stale rows it already created: for any
-- resume_entry where content exactly matches the source description AND
-- the row was linked directly to a source (perspective_id IS NULL), null
-- out the content so the compiler treats the entry as a pure reference.
-- User-edited content is preserved because the match requires content to
-- equal the source's unmodified description text.

UPDATE resume_entries
SET content = NULL,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
WHERE perspective_id IS NULL
  AND source_id IS NOT NULL
  AND content IS NOT NULL
  AND content = (SELECT description FROM sources WHERE sources.id = resume_entries.source_id);
