import { validateSimulationSeed, type SimulationSeed } from '@marketsim/domain';

import type { Uint32RandomSource } from './random';

const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = 0xffff_ffff;

function rotateLeft(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

function assertValidSeed(seed: SimulationSeed): string {
  const validation = validateSimulationSeed(seed);

  if (!validation.valid) {
    throw new RangeError(validation.issues[0]?.message ?? 'Invalid simulation seed.');
  }

  return validation.value;
}

/**
 * xoshiro128** 1.1 with a four-word uint32 state.
 *
 * The seed is read as four consecutive big-endian hexadecimal uint32 words.
 * All state transitions are explicitly reduced to uint32 values.
 */
export class Xoshiro128StarStar implements Uint32RandomSource {
  #state0: number;
  #state1: number;
  #state2: number;
  #state3: number;

  constructor(seed: SimulationSeed) {
    const normalizedSeed = assertValidSeed(seed);
    this.#state0 = Number.parseInt(normalizedSeed.slice(0, 8), 16) >>> 0;
    this.#state1 = Number.parseInt(normalizedSeed.slice(8, 16), 16) >>> 0;
    this.#state2 = Number.parseInt(normalizedSeed.slice(16, 24), 16) >>> 0;
    this.#state3 = Number.parseInt(normalizedSeed.slice(24, 32), 16) >>> 0;
  }

  nextUint32(): number {
    const result = Math.imul(rotateLeft(Math.imul(this.#state1, 5) >>> 0, 7), 9) >>> 0;
    const shifted = (this.#state1 << 9) >>> 0;

    this.#state2 = (this.#state2 ^ this.#state0) >>> 0;
    this.#state3 = (this.#state3 ^ this.#state1) >>> 0;
    this.#state1 = (this.#state1 ^ this.#state2) >>> 0;
    this.#state0 = (this.#state0 ^ this.#state3) >>> 0;
    this.#state2 = (this.#state2 ^ shifted) >>> 0;
    this.#state3 = rotateLeft(this.#state3, 11);

    return result;
  }
}

/** Maps every uint32 value to the midpoint of one of 2^32 bins in (0, 1). */
export function uint32ToOpenUnitInterval(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new RangeError('value must be an unsigned 32-bit integer.');
  }

  return (value + 0.5) / UINT32_RANGE;
}
