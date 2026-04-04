import { describe, expect, it } from 'bun:test';
import {
  FRAMINGS,
  RESUME_SECTIONS,
  THIN_COVERAGE_THRESHOLD,
} from '../archetypes';

describe('FRAMINGS', () => {
  it('contains exactly 3 framings', () => {
    expect(FRAMINGS).toHaveLength(3);
  });

  it('contains the expected values', () => {
    expect(FRAMINGS).toContain('accomplishment');
    expect(FRAMINGS).toContain('responsibility');
    expect(FRAMINGS).toContain('context');
  });
});

describe('THIN_COVERAGE_THRESHOLD', () => {
  it('is a positive number', () => {
    expect(typeof THIN_COVERAGE_THRESHOLD).toBe('number');
    expect(THIN_COVERAGE_THRESHOLD).toBeGreaterThan(0);
  });

  it('equals 2', () => {
    expect(THIN_COVERAGE_THRESHOLD).toBe(2);
  });
});

describe('RESUME_SECTIONS', () => {
  it('contains exactly 10 sections', () => {
    expect(RESUME_SECTIONS).toHaveLength(10);
  });

  it('contains the expected values', () => {
    expect(RESUME_SECTIONS).toContain('summary');
    expect(RESUME_SECTIONS).toContain('experience');
    expect(RESUME_SECTIONS).toContain('projects');
    expect(RESUME_SECTIONS).toContain('education');
    expect(RESUME_SECTIONS).toContain('skills');
    expect(RESUME_SECTIONS).toContain('certifications');
    expect(RESUME_SECTIONS).toContain('clearance');
    expect(RESUME_SECTIONS).toContain('presentations');
    expect(RESUME_SECTIONS).toContain('awards');
    expect(RESUME_SECTIONS).toContain('custom');
  });
});
