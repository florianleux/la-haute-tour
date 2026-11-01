<template>
  <!-- Plein écran, au-dessus de tout : un voile éteint ce qui est dessous,
       l'objet jaillit au centre dans un halo de rayons qui tourne, son titre
       au-dessus, et OK le referme. Téléporté dans `body` : une boîte animée
       de l'appelant (le cadre de jeu qui rebondit) capterait le `fixed`.
       @container : le titre se mesure sur la largeur de l'écran. -->
  <Teleport to="body">
    <div class="@container fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/75 motion-safe:animate-fade-in">
      <!-- « Obtenu », puis le nom à la ligne : la mise en page du titre d'un
           boss, son épithète au-dessus de son nom. Devant les rayons, qui
           débordent jusque sous lui (`z-10`). -->
      <div
        class="relative z-10 flex flex-col items-center [--title-ms:2s]"
      >
        <p
          class="-mb-[0.3cqw] text-[1.6cqw] leading-none"
          :class="TITLE_YELLOW"
        >
          {{ title }}
        </p>
        <p
          class="text-[4.6cqw]"
          :class="TITLE_YELLOW"
          :style="{ animationDelay: '0.3s' }"
        >
          {{ label }}
        </p>
        <div
          class="mt-[0.4cqw] h-[0.15cqw] w-[36cqw] origin-left bg-linear-to-r from-transparent via-[#fcd400] to-transparent motion-safe:animate-title-rule"
          :style="{ animationDelay: '0.3s' }"
        />
      </div>

      <!-- L'objet, en carré : ses rayons derrière lui, deux fois plus larges,
           qui tournent ; il flotte, et des étincelles l'entourent. Trois
           boîtes, une par `transform` : le jaillissement, le flottement, et
           les rayons qui tournent par `rotate`. La boîte externe ne bouge pas :
           c'est elle qu'on mesure pour partir de `from`. -->
      <div
        ref="itemBox"
        class="relative mt-[3cqw] aspect-square w-[min(18cqw,32dvh)]"
        :style="jump"
      >
        <div class="absolute inset-0 motion-safe:animate-item-pop">
          <RaysHalo
            :color="glow"
            class="w-[240%] motion-safe:animate-item-rays"
          />
          <div class="relative size-full motion-safe:animate-float">
            <slot>
              <img :src="image" alt="" class="size-full object-contain">
            </slot>
            <SparkleField
              :sparks="SPARKS"
              :glow="glow"
            />
          </div>
        </div>
      </div>

      <!-- Ce que l'appelant a à dire sous l'objet : un OK qui n'a pas abouti. -->
      <p
        v-if="$slots.notice"
        class="mt-[3dvh] text-[max(0.95rem,2.2dvh)] text-rose-300"
      >
        <slot name="notice" />
      </p>

      <BaseButton
        variant="link"
        class="mt-[4dvh]"
        @click="$emit('close')"
      >
        OK
      </BaseButton>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Un objet obtenu, montré pour lui seul : le sort sorti du coffre, le Fromage
// que L'Inconnu tend à la fin de l'introduction. L'objet lui-même vient de
// l'appelant, par le slot, à la taille de sa boîte carrée. Rien ne se ferme
// tout seul : le joueur lit, puis clique OK. Voir specs/ecrans.md.

const props = withDefaults(defineProps<{
  /** Le nom de l'objet, sous le titre. */
  label: string
  /** Le titre au-dessus du nom : « Obtenu », « Relique obtenue ». */
  title?: string
  /** L'image de l'objet, quand le slot ne le dessine pas lui-même (un sort, son médaillon). */
  image?: string
  /** La lueur des rayons et des étincelles. */
  glow?: string
  /**
   * D'où l'objet part, à l'écran : son centre et sa largeur, en px. Il y
   * part à sa taille, et saute jusqu'au centre (le sort, de la fente du
   * coffre). Sans lui, il jaillit de rien, sur place (le Fromage).
   */
  from?: { x: number, y: number, width: number }
}>(), { title: 'Obtenu', image: undefined, glow: 'rgb(254 243 199 / 0.9)', from: undefined })

defineEmits<{ close: [] }>()

const itemBox = useTemplateRef<HTMLElement>('itemBox')

/**
 * Le saut de `animate-item-pop`, de `from` à la place de l'objet : mesuré au
 * montage, avant la première image, sur la boîte qui ne bouge pas.
 */
const jump = ref<Record<string, string>>({})

onMounted(() => {
  if (!props.from) {
    return
  }
  const box = itemBox.value!.getBoundingClientRect()
  jump.value = {
    '--from-x': `${Math.round(props.from.x - (box.left + box.width / 2))}px`,
    '--from-y': `${Math.round(props.from.y - (box.top + box.height / 2))}px`,
    '--from-scale': `${(props.from.width / box.width).toFixed(3)}`,
  }
})

/** Le scintillement autour de l'objet, en % de sa boîte, une fois posé. */
const SPARKS = [
  { left: '-6%', top: '8%', size: '12%', delay: '0.5s' },
  { left: '90%', top: '2%', size: '9%', delay: '1s' },
  { left: '96%', top: '58%', size: '11%', delay: '0.7s' },
  { left: '-10%', top: '66%', size: '8%', delay: '1.3s' },
  { left: '44%', top: '-14%', size: '10%', delay: '1.6s' },
  { left: '70%', top: '92%', size: '8%', delay: '0.85s' },
]
</script>
