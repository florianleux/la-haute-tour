/**
 * Fetch options for a read of our own API from a composable.
 *
 * On SSR the internal call carries no cookie of its own: without forwarding it the
 * server sees an anonymous visitor and bounces a signed-in player.
 */
export function useApiFetchOptions(): { headers: Record<string, string> | undefined } {
  return {
    headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
  }
}
