<template>
  <!-- En leçon, le décor et le poster s'assombrissent : seul ce que Michel
       montre reste éclairé — sa bannière comprise, à la leçon de la chute.
       Voir spotlightOn. -->
  <div
    class="fixed inset-0 z-0 bg-[url(/images/cooldown-bg.webp)] bg-cover bg-center"
    :class="shade"
  />

  <!-- Les objets du camp, entre le décor et le poster. Voir CooldownCamp. -->
  <CooldownCamp
    :ready="action !== null"
    :advancing="advancing"
    :team="team"
    :volumen="state.seenTotal > 0"
    :spellbook="state.spellDiscovered"
    :lesson="lesson"
    @advance="$emit('advance')"
    @open="$emit('open', $event)"
    @michel="$emit('michel')"
  />

  <!-- Le poster est presque carré (918×980) là où le cadre de l'ascension est en
       paysage : le contraindre par la largeur seule le ferait déborder en
       hauteur dès que la fenêtre est large et basse. La largeur prend donc le
       plus petit de « toute la place disponible » et « ce qui tient dans la
       hauteur restante », et l'aspect-ratio en déduit la hauteur — le poster
       reste entier à toutes les tailles, sans JS ni mesure. `svh` plutôt que
       `vh` pour la barre d'adresse mobile. container-type (@container) fait de
       la largeur du poster l'unité `cqw` de son contenu, comme le cadre de
       QuestionCard : le texte doit rétrécir avec le parchemin, pas rester fixe
       quand il se redimensionne.

       `fixed`, comme le décor, et pour la même raison qu'eux deux : un élément
       `absolute` est ancré au document, un `fixed` au viewport. Les mélanger
       faisait de la parallaxe — au moindre rebond de scroll, même sans barre, le
       poster glissait sur un décor qui, lui, ne bougeait pas. Ancrés au même
       repère, ils ne peuvent plus se désolidariser. Hors flux également : le
       poster n'a plus de hauteur dans la page, donc il ne peut plus la faire
       déborder.

       Une conséquence de `fixed` : les pourcentages se mesurent sur le viewport
       et non plus sur le <main>, dont le `p-6` ne s'applique donc plus. Les 3rem
       de gouttière et le 1.5rem sous le poster sont repris explicitement ici pour
       garder le cadrage réglé juste avant.

       Ancré par le bas, pas centré. Le poster est planté dans le sol : ses
       piquets reposent sur des pierres, qui doivent tomber dans l'herbe du
       décor. Centré verticalement il s'en décollait — la moitié haute du décor
       étant du ciel, toute hauteur gagnée le soulevait en l'air. L'herbe occupe
       les ~15% inférieurs de cooldown-bg.webp (au-delà de 85%, le bleu s'effondre
       quand rouge et vert restent hauts : c'est le jaune-vert du sol), et
       `bg-cover` garde toujours ce bas d'image en bas de fenêtre — un ancrage à
       4svh du bord y pose donc les pierres quel que soit le format d'écran, assez
       haut pour qu'elles mordent dans l'herbe sans raser le bord.
       La hauteur disponible retranche cet ancrage et le `p-6` du gabarit, contre le
       bord intérieur duquel le poster se mesure.

       Puis le poster se décale, sans changer de taille : la taille garde le
       calcul ci-dessus, le décalage vient après, en translate. En 16:9 et plus
       large, il descend de 5svh : il dégage le ciel et laisse le décor respirer
       au-dessus de sa bannière. Plus étroite, la fenêtre fait grandir les objets
       du sol (calés sur la hauteur) face au poster (calé sur la largeur) : il
       remonte alors d'un sixième de ce qui manque à la largeur pour faire du
       16:9, plafonné à 8svh, et laisse le sol aux objets — sans que sa
       bannière ne vienne buter contre le haut de l'écran.

       Transparent aux clics, sauf ce qu'il porte : sa boîte rectangulaire
       déborde de l'image détourée et recouvrait la corde du camp, qui ne se
       survolait plus à moitié.

       Deux boîtes de même géométrie (POSTER_BOX) : l'image du poster, puis ce
       qu'il porte. Les objets posés au sol du camp (z-[12]) se glissent entre
       les deux : devant les piquets et leurs pierres, derrière le texte et le
       bouton, qu'ils ne recouvrent donc jamais, quel que soit le format. Le tout
       sous le sélecteur d'incarnation (z-20), que le poster ne doit pas masquer. -->
  <div
    class="fixed z-10 bg-[url(/images/cooldown-poster.webp)] bg-contain bg-center bg-no-repeat"
    :class="[POSTER_BOX, shade]"
  />
  <!-- La bannière du poster, quand Michel la montre : la même image, découpée
       au ras de l'étoffe et de ses cordes, reposée par-dessus le poster
       assombri, sous le décompte qu'elle porte. L'ombre se pose donc sur les
       parties du poster plutôt que sur lui en entier : un enfant ne sort pas de
       l'ombre de son parent. -->
  <div
    v-if="bannerLit"
    class="pointer-events-none fixed z-[11]"
    :class="POSTER_BOX"
  >
    <img
      src="/images/cooldown-poster-banner.webp"
      alt=""
      class="absolute left-0 top-0 w-[96.73%]"
    >
  </div>
  <!-- En leçon, rien du poster ne se clique : « Commencer » sauterait la
       leçon, c'est la corde que Michel montre. -->
  <div
    class="pointer-events-none fixed z-[15] *:pointer-events-auto @container"
    :class="POSTER_BOX"
    :inert="lesson !== null"
  >
    <!-- La bannière en haut du poster, plus étroite que le panneau et décalée
         à droite par la corde nouée sur le piquet gauche. Elle porte le décompte
         pendant l'attente : c'est le seul chiffre que le joueur vient chercher,
         et le drapeau est ce qu'on lit en premier. Hors attente il n'y a plus
         rien à décompter : la bannière dit que l'attente est finie. Au repos,
         il n'y a eu aucune attente : la bannière reste vide.
         `tabular-nums` comme le chrono de l'ascension, sinon le cadrage tremble
         à chaque seconde ; pas d'`uppercase` sur le décompte, qui rendrait
         « 4m 12s » en « 4M 12S ». -->
    <h1
      class="absolute left-[19.5%] top-[2%] flex h-[13%] w-[69%] items-center justify-center text-center font-semibold tracking-wide text-amber-800"
      :class="[inCooldown ? '-translate-y-[0.5cqw] text-[9.35cqw] leading-none tabular-nums' : 'text-[5cqw] uppercase', bannerLit ? 'transition duration-200' : shade]"
    >
      {{ inCooldown ? (cooldownRemaining || 'Attente') : atRest ? '' : 'Attente terminée' }}
    </h1>

    <!-- Le panneau de parchemin porte tout ce que l'écran a à dire : décompte,
         rappels, résultat de coffre et sorts en attente. Le contenu est écrit
         ici en tons parchemin plutôt que repris des composants Base*, qui
         portent le thème sombre — les recouvrir en ligne est ce que CLAUDE.md
         interdit, et c'est déjà le parti pris de QuestionCard et de ChestCard,
         qui porte sa propre copie des messages de coffre pour la même raison.

         Le panneau ne défile pas : un parchemin cloué entre deux piquets ne
         défile pas. L'échelle est donc calculée pour que le pire cas tienne.
         Tout étant en cqw, le contenu occupe la même fraction du panneau quelle
         que soit la taille de la fenêtre : ce qui tient tient partout, et seule
         la quantité de contenu compte. Panneau = 46% de la hauteur du poster (il
         s'arrête au bouton, qui mord sur le parchemin), soit 49 cqw ; le cumul le
         plus lourd (attente admin + rattrapage raté + Répit + coffre + sorts +
         chargement) en pèse ~42, le décompte étant passé dans la bannière. -->
    <div
      class="absolute left-[23%] top-[21%] flex h-[46%] w-[62%] flex-col items-center justify-center gap-[1.5cqw] overflow-hidden px-[2cqw] text-center text-[2.6cqw] leading-snug text-amber-800"
      :class="shade"
    >
      <!-- Le décompte est monté dans la bannière : le répéter ici ferait lire
           deux fois le même chiffre à dix centimètres d'écart. Une seule phrase
           pour les deux phases : ce que le joueur a à faire, attendre ou jouer.
           Au repos, l'accueil du camp. -->
      <p class="text-[4.16cqw]">
        {{ atRest ? 'Bienvenue au camp de base' : inCooldown && state.cooldownUntil ? `Reviens ${formatReturnAt(state.cooldownUntil, Date.now())} pour tenter le rattrapage.` : 'Tu peux lancer ton rattrapage.' }}
      </p>

      <!-- Ce qui est posé sur le joueur : la plupart des sorts attendent sa
           prochaine tentative, le Répit a déjà agi sur l'attente qu'il lit.
           Voir specs/bonus.md#ancrage-et-durée-de-vie. -->
      <div
        v-if="screen.pendingEffects.length"
        class="mt-[5cqw] w-full"
      >
        <p class="text-[2.3cqw] font-semibold uppercase tracking-wide text-amber-900/70">
          Sorts lancés sur toi
        </p>
        <!-- Le sort écrit en toutes lettres plutôt qu'EffectPip, qui sert aux
             rubans de l'ascension et tait le sort faute de place — le poster en
             a. -->
        <div class="mt-[1.2cqw] flex flex-wrap justify-center gap-[1cqw]">
          <SpellMention
            v-for="(effect, index) in screen.pendingEffects"
            :key="index"
            :subject="effect"
            class="text-[2.1cqw]"
          />
        </div>
      </div>

      <BaseParchmentNote v-if="loading">
        Mise à jour de ta partie…
      </BaseParchmentNote>
    </div>

    <!-- Les deux actions ne coexistent jamais : « Passer l'attente » n'existe
         que pour l'admin pendant le cooldown, « Commencer » qu'une fois
         l'attente échue, ou au repos. Un seul emplacement suffit donc, entre
         le bas du panneau et les pierres des piquets. -->
    <BaseCardButton
      v-if="action"
      :label="action.label"
      anchor="poster"
      face="plank"
      :class="shade"
      :loading="advancing"
      @click="$emit('advance')"
    />
    <BaseCardButton
      v-else-if="isAdmin && inCooldown"
      label="Passer"
      anchor="poster"
      face="plank"
      :class="shade"
      :loading="skipping"
      @click="$emit('skipCooldown')"
    />
  </div>
</template>

<script setup lang="ts">
// Le camp — l'attente, le rattrapage prêt à démarrer et l'ascension au repos.
// Partagé entre la vraie partie (pages/index.vue) et son banc de design (pages/test/cooldown.vue) :
// modifier l'un modifie l'autre, comme QuestionCard pour l'ascension.
//
// Reskin parchemin/médiéval au même titre que l'ascension : les deux phases se
// jouent au camp, donc les deux reçoivent le décor. Tout le contenu vit sur le
// poster, positionné en absolu et dimensionné en cqw — rien ne subsiste sous
// l'image. Voir specs/ecrans.md#cooldown--attente.
import type { GameState } from '~~/server/utils/game'
import type { TeamId } from '~~/shared/utils/teams'
import type { LessonLine } from '~~/utils/lessons'
import type { CampOverlayId, GameScreen, PlayAction } from '~~/utils/phase'

const props = defineProps<{
  state: GameState
  screen: GameScreen
  /** « Commencer » une fois l'attente échue ou au repos, null pendant. Voir utils/phase.ts (playView). */
  action: PlayAction | null
  cooldownRemaining: string
  loading: boolean
  isAdmin: boolean
  skipping: boolean
  advancing: boolean
  /** La guilde du joueur, qui choisit la couleur de la bannière. Sans équipe, pas de bannière. */
  team: TeamId | null
  /** La réplique de Michel en cours, null hors leçon. Voir CooldownCamp. */
  lesson: LessonLine | null
}>()

defineEmits<{ skipCooldown: [], advance: [], open: [screen: CampOverlayId], michel: [] }>()

/**
 * En leçon, le décor et le poster restent dans l'ombre : Michel ne les montre
 * jamais. La transition, toujours posée, adoucit l'entrée comme la sortie.
 */
const shade = computed(() => ['transition duration-200', lessonDims(props.lesson) && LESSON_SHADE])

/** Michel montre la bannière du poster : elle seule échappe à l'ombre. */
const bannerLit = computed(() => lessonDims(props.lesson) && !spotlightOn(props.lesson, 'posterBanner').dimmed)

const inCooldown = computed(() => isCooldown(props.state))
const atRest = computed(() => isAtRest(props.state))

// La place et la taille du poster, partagées par son image et son contenu.
const POSTER_BOX = 'bottom-[calc(4svh+1.5rem)] left-1/2 aspect-918/980 w-[min(calc(100%-3rem),calc((94svh-3rem)*918/980))] -translate-x-1/2 translate-y-[calc(5svh_-_min(8svh,max(0px,(100svh*16/9_-_100vw)/6)))]'

</script>
