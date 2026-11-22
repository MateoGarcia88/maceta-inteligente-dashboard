/**
 * Generador de números pseudoaleatorios con semilla.
 *
 * `Math.random()` no acepta semilla, así que cada arranque daría datos distintos.
 * Con una semilla fija, la misma secuencia de números se repite siempre, y con ella
 * toda la simulación: útil para depurar ("el pico raro del martes" sigue ahí al reiniciar).
 *
 * Algoritmo: mulberry32. Es pequeño, rápido y con calidad de sobra para simular datos.
 * NO sirve para criptografía.
 */

export interface Random {
  /** Número en [0, 1), como `Math.random()`. */
  next(): number;
  /** Número en [min, max). */
  between(min: number, max: number): number;
  /** `true` con probabilidad `p` (entre 0 y 1). */
  chance(p: number): boolean;
}

export function createRandom(seed: number): Random {
  // Estado interno de 32 bits; `>>> 0` lo convierte en entero sin signo.
  let state = seed >>> 0;

  function next(): number {
    // mulberry32: avanza el estado y "mezcla" sus bits con multiplicaciones y XOR.
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  }

  return {
    next,
    between: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
  };
}
