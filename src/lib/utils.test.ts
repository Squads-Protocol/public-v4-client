import { describe, expect, it } from 'vitest';
import { cn, range } from './utils';

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', true && 'visible')).toBe('base visible');
  });

  it('should merge tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('range', () => {
  it('should return an array of numbers from start to end inclusive', () => {
    expect(range(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should return single element when start equals end', () => {
    expect(range(3, 3)).toEqual([3]);
  });

  it('should handle zero', () => {
    expect(range(0, 3)).toEqual([0, 1, 2, 3]);
  });

  it('should handle negative numbers', () => {
    expect(range(-2, 2)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('should return empty array when start is greater than end', () => {
    expect(range(5, 1)).toEqual([]);
  });
});
