/**
 * Where the player stands. Single read endpoint of the game state: the identity
 * endpoint carries identity only. Reading has no effect — it draws no question and
 * starts no timer. See specs/architecture.md.
 */
export interface GameStateResponse {
  floor: number
  lives: number
}

export default defineEventHandler(async (event): Promise<GameStateResponse> => {
  const user = await requireAuth(event)

  return { floor: user.currentFloor, lives: user.lives }
})
