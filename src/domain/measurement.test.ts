import { describe, expect, it } from 'vitest';
import { formatMeasurement, measureDistance } from './measurement';

describe('plan measurements', () => {
  it('measures zero and diagonal distances without mutating points', () => {
    const start = Object.freeze({ x: 2, y: -1 });
    const end = Object.freeze({ x: 5, y: 3 });
    expect(measureDistance(start, start)).toBe(0);
    expect(measureDistance(start, end)).toBe(5);
    expect(start).toEqual({ x: 2, y: -1 });
    expect(end).toEqual({ x: 5, y: 3 });
  });

  it('formats measurements in the active project unit to two decimals', () => {
    expect(formatMeasurement({ x: 0, y: 0 }, { x: 1.234, y: 0 }, 'm')).toBe('1.23 m');
    expect(formatMeasurement({ x: 0, y: 0 }, { x: 0, y: 2.5 }, 'ft')).toBe('2.50 ft');
  });

  it('rejects non-finite coordinates and unsupported units', () => {
    expect(() => measureDistance({ x: 0, y: Number.NaN }, { x: 1, y: 1 })).toThrow(/finite/);
    expect(() => formatMeasurement({ x: 0, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 1 }, 'm')).toThrow(/finite/);
    expect(() => formatMeasurement({ x: 0, y: 0 }, { x: 1, y: 1 }, 'cm' as 'm')).toThrow(/units/);
  });
});
