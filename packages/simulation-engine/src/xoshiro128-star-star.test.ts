import { describe, expect, it } from 'vitest';

import { uint32ToOpenUnitInterval, Xoshiro128StarStar } from './xoshiro128-star-star';

const VECTOR_SEED = '00000001000000020000000300000004';

describe('Xoshiro128StarStar', () => {
  it('matches the committed xoshiro128** 1.1 uint32 vector', () => {
    const source = new Xoshiro128StarStar(VECTOR_SEED);

    expect(Array.from({ length: 10 }, () => source.nextUint32())).toEqual([
      0x00002d00, 0x00000000, 0x005a7080, 0x04389d80, 0x79199d9b, 0x61963b24,
      0x4cb9b57a, 0xde9d7431, 0xde458f35, 0xfdce1a54,
    ]);
  });

  it('produces equal sequences from equal seeds', () => {
    const first = new Xoshiro128StarStar(VECTOR_SEED);
    const second = new Xoshiro128StarStar(VECTOR_SEED);

    for (let index = 0; index < 1_000; index += 1) {
      expect(first.nextUint32()).toBe(second.nextUint32());
    }
  });

  it('produces a different sequence from a different seed', () => {
    const first = new Xoshiro128StarStar(VECTOR_SEED);
    const second = new Xoshiro128StarStar('00000001000000020000000300000005');
    const firstSequence = Array.from({ length: 16 }, () => first.nextUint32());
    const secondSequence = Array.from({ length: 16 }, () => second.nextUint32());

    expect(secondSequence).not.toEqual(firstSequence);
  });

  it('keeps every generated word inside the uint32 range', () => {
    const source = new Xoshiro128StarStar('ffffffffffffffffffffffffffffffff');

    for (let index = 0; index < 10_000; index += 1) {
      const value = source.nextUint32();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffff_ffff);
    }
  });

  it.each(['00000000000000000000000000000000', 'not-a-128-bit-hexadecimal-seed'])(
    'rejects invalid state seed %s',
    (seed) => {
      expect(() => new Xoshiro128StarStar(seed)).toThrow(RangeError);
    },
  );
});

describe('uint32ToOpenUnitInterval', () => {
  it('maps both uint32 endpoints strictly inside the unit interval', () => {
    const lower = uint32ToOpenUnitInterval(0);
    const upper = uint32ToOpenUnitInterval(0xffff_ffff);

    expect(lower).toBe(0.5 / 0x1_0000_0000);
    expect(upper).toBe((0xffff_ffff + 0.5) / 0x1_0000_0000);
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeLessThan(1);
  });

  it.each([-1, 0x1_0000_0000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a value outside uint32: %s',
    (value) => {
      expect(() => uint32ToOpenUnitInterval(value)).toThrow(RangeError);
    },
  );
});
