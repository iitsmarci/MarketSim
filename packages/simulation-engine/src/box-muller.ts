import type { NormalRandomSource, Uint32RandomSource } from './random';
import { uint32ToOpenUnitInterval } from './xoshiro128-star-star';

const FULL_TURN_RADIANS = 2 * Math.PI;

/** Standard Box-Muller transform with one cached variate per generated pair. */
export class BoxMullerNormalSource implements NormalRandomSource {
  readonly #uniformSource: Uint32RandomSource;
  #cachedNormal: number | undefined;

  constructor(uniformSource: Uint32RandomSource) {
    this.#uniformSource = uniformSource;
  }

  nextStandardNormal(): number {
    if (this.#cachedNormal !== undefined) {
      const value = this.#cachedNormal;
      this.#cachedNormal = undefined;
      return value;
    }

    const radialUniform = uint32ToOpenUnitInterval(this.#uniformSource.nextUint32());
    const angularUniform = uint32ToOpenUnitInterval(this.#uniformSource.nextUint32());
    const magnitude = Math.sqrt(-2 * Math.log(radialUniform));
    const angle = FULL_TURN_RADIANS * angularUniform;
    const first = magnitude * Math.cos(angle);
    const second = magnitude * Math.sin(angle);

    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      throw new RangeError('Box-Muller transform produced a non-finite value.');
    }

    this.#cachedNormal = second;
    return first;
  }
}
