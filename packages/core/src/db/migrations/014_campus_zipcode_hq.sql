-- Campus: add zipcode and is_headquarters columns
-- Migration: 014_campus_zipcode_hq

ALTER TABLE org_campuses ADD COLUMN zipcode TEXT;
ALTER TABLE org_campuses ADD COLUMN is_headquarters INTEGER NOT NULL DEFAULT 0;

INSERT INTO _migrations (name) VALUES ('014_campus_zipcode_hq');
