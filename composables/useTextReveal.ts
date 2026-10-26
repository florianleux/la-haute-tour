import { revealedLength } from '../utils/dialogue'
import type { ComputedRef, Ref } from 'vue'

/**
 * Le rythme du jeu : le temps qu'un caractère met à sortir quand la scène n'en
 * demande pas un autre. Écrit ici une fois, comme TICK_MS dans useClockTick :
 * une scène qui veut ralentir le dit (`revealMs`), les autres suivent ce
 * rythme-là sans avoir à le recopier.
 */
export const REVEAL_MS = 30

export interface TextReveal {
  /** Ce qui est sorti du texte. */
  shown: ComputedRef<string>
  /** Il est sorti en entier. */
  revealed: ComputedRef<boolean>
  /** Le fait défiler depuis le début : un nouveau texte, ou le premier. */
  restart: () => void
  /** Le sort en entier d'un coup : un geste du joueur. */
  revealAll: () => void
  /** Arrête la minuterie : le texte reste où il en est. */
  stop: () => void
}

/**
 * Le défilé d'un texte, caractère par caractère : celui des dialogues
 * (useDialogue) et des fenêtres de l'introduction du boss (BossIntro). Rien ne
 * part seul : l'appelant lance `restart()` à chaque nouveau texte.
 *
 * `now` est l'horloge de l'appelant quand il en tient une — un test. Fournie,
 * le défilé n'a plus de minuterie à lui : il lit l'heure qu'on lui donne. La
 * minuterie ne tourne de toute façon que dans un navigateur, même garde que
 * useQuestionRun.
 */
export function useTextReveal(text: Ref<string>, revealMs: Ref<number>, now?: Ref<number>): TextReveal {
  /**
   * L'horloge du défilé : celle de l'appelant s'il en tient une, sinon la
   * sienne, que la minuterie ci-dessous avance. On ne lui écrit jamais — celle
   * de l'appelant est à lui. Elle sert à faire recalculer ce qui est sorti,
   * jamais à dater le départ d'un texte : elle est figée dès que la minuterie
   * s'arrête, donc en retard sur l'heure vraie.
   */
  const ticks = ref(Date.now())
  const clock = computed(() => now?.value ?? ticks.value)
  const startedAt = ref(clock.value)
  /** Un geste a tout révélé d'un coup : le temps ne décide plus de ce texte. */
  const forced = ref(false)

  const count = computed(() => (forced.value
    ? text.value.length
    : revealedLength(clock.value - startedAt.value, revealMs.value, text.value.length)))
  const shown = computed(() => text.value.slice(0, count.value))
  const revealed = computed(() => count.value === text.value.length)

  let timer: ReturnType<typeof setInterval> | null = null

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function revealAll(): void {
    stop()
    forced.value = true
  }

  /**
   * Rien n'attend le montage : à l'hydratation, rien n'est encore sorti et la
   * boîte rend le vide, exactement comme le rendu serveur. Les deux côtés
   * partent donc du même premier état.
   */
  function restart(): void {
    stop()
    forced.value = false
    // L'heure vraie, pas `clock.value` : celle-ci est restée sur le dernier
    // battement d'avant l'arrêt de la minuterie, et le temps passé à lire le
    // texte précédent aurait été compté comme du défilé déjà écoulé.
    startedAt.value = now?.value ?? Date.now()

    if (now || !import.meta.client) {
      return
    }

    timer = setInterval(() => {
      ticks.value = Date.now()

      if (revealed.value) {
        stop()
      }
    }, revealMs.value)
  }

  onScopeDispose(stop)

  return { shown, revealed, restart, revealAll, stop }
}
