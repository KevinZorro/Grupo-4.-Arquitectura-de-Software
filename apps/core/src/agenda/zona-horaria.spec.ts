import { describe, expect, it } from 'vitest';
import { diaSiguiente, fechaEnColombia, inicioDelDiaEnColombia } from './zona-horaria';

describe('zona horaria de Colombia', () => {
  it('starts a Colombian day at 05:00 UTC', () => {
    expect(inicioDelDiaEnColombia('2026-10-28').toISOString()).toBe('2026-10-28T05:00:00.000Z');
  });

  it('keeps a late evening in Colombia on its own day, though UTC has moved on', () => {
    expect(fechaEnColombia(new Date('2026-10-29T04:59:59.999Z'))).toBe('2026-10-28');
    expect(fechaEnColombia(new Date('2026-10-29T05:00:00.000Z'))).toBe('2026-10-29');
  });

  it('rolls over months and years', () => {
    expect(diaSiguiente('2026-10-31')).toBe('2026-11-01');
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01');
  });
});
