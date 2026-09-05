/**
 * Un hasard scripté : les tirages sont décidés par le test, pas subis. Les
 * fonctions du jeu prennent leur hasard en argument précisément pour ça.
 */
export function rolls(...values: number[]): () => number {
  let next = 0

  return () => values[next++]
}
