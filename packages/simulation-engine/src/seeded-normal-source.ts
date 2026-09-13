import type { SimulationSeed } from '@marketsim/domain';

import { BoxMullerNormalSource } from './box-muller';
import type { NormalRandomSource } from './random';
import { Xoshiro128StarStar } from './xoshiro128-star-star';

/** Production deterministic normal source for the current randomness version. */
export class SeededNormalRandomSource implements NormalRandomSource {
  readonly #normalSource: BoxMullerNormalSource;

  constructor(seed: SimulationSeed) {
    this.#normalSource = new BoxMullerNormalSource(new Xoshiro128StarStar(seed));
  }

  nextStandardNormal(): number {
    return this.#normalSource.nextStandardNormal();
  }
}
