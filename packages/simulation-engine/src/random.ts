/** Source of independent standard-normal values (mean 0, variance 1). */
export interface NormalRandomSource {
  nextStandardNormal(): number;
}

/** Source of unsigned 32-bit integers in the range 0..2^32-1. */
export interface Uint32RandomSource {
  nextUint32(): number;
}
