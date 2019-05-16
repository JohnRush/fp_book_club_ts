export interface RNG {
  nextInt(): [number, RNG];
}

export class SimpleRNG implements RNG {
  readonly seed: bigint;

  constructor(seed: bigint) {
    this.seed = BigInt.asIntN(64, seed);
  }

  /* tslint:disable:no-bitwise */
  nextInt(): [number, RNG] {
    const newSeed = BigInt.asIntN(64, this.seed * 0x5deece66dn + 0xbn) & 0xffffffffffffn;
    const nextRNG = new SimpleRNG(newSeed);
    const n = Number(BigInt.asIntN(32, newSeed >> 16n));
    return [n, nextRNG];
  }
  /* tslint:enable:no-bitwise */
}
