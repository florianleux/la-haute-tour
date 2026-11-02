import type { AchievementId } from '~~/shared/utils/achievements'

/**
 * Guette les outils de développement pendant que le joueur est là, et grave
 * « La curiosité est un vilain défaut » à la première trace. Une fois par
 * page : le serveur écarte de toute façon ce qui est déjà acquis.
 * Voir utils/devtools.ts et specs/succes.md#clins-dœil.
 */
export function useDevtoolsWatch(): void {
  const announce = useAchievementAnnouncer()
  let caught = false

  async function caughtOpen(): Promise<void> {
    if (caught) {
      return
    }

    caught = true
    stop()

    const { unlocked } = await $fetch<{ unlocked: AchievementId[] }>('/api/profile/devtools', {
      method: 'POST',
      ...useApiFetchOptions(),
    })

    announce(unlocked)
  }

  function onKey(event: KeyboardEvent): void {
    if (isDevtoolsShortcut(event)) {
      void caughtOpen()
    }
  }

  function onResize(): void {
    if (looksDocked(window)) {
      void caughtOpen()
    }
  }

  function stop(): void {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('resize', onResize)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    onResize()
  })

  onBeforeUnmount(stop)
}
