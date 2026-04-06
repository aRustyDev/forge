-- Forge Resume Builder — Project Open Source Flag
-- Migration: 042_project_open_source
-- Date: 2026-04-05
--
-- Adds an open_source boolean flag to source_projects.

ALTER TABLE source_projects ADD COLUMN open_source INTEGER NOT NULL DEFAULT 0;
