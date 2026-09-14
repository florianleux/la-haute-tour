<template>
  <div class="fixed inset-0 z-0 bg-[url(/images/cooldown-bg.webp)] bg-cover bg-center" />

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
       bord intérieur duquel le poster se mesure. -->
  <div
    class="fixed bottom-[calc(4svh+1.5rem)] left-1/2 z-10 aspect-918/980 w-[min(calc(100%-3rem),calc((94svh-3rem)*918/980))] -translate-x-1/2 @container bg-[url(/images/cooldown-poster.webp)] bg-contain bg-center bg-no-repeat"
  >
    <!-- La bannière en haut du poster, plus étroite que le panneau et décalée
         à droite par la corde nouée sur le piquet gauche. Elle porte le décompte
         pendant l'attente : c'est le seul chiffre que le joueur vient chercher,
         et le drapeau est ce qu'on lit en premier. Hors attente il n'y a plus
         rien à décompter, la bannière reprend donc le nom de la phase.
         `tabular-nums` comme le chrono de l'ascension, sinon le cadrage tremble
         à chaque seconde ; pas d'`uppercase` sur le décompte, qui rendrait
         « 4m 12s » en « 4M 12S ». -->
    <h1
      class="absolute left-[19.5%] top-[2%] flex h-[13%] w-[69%] items-center justify-center text-center font-semibold tracking-wide text-amber-800"
      :class="state.phase === 'cooldown' ? 'text-[5.5cqw] tabular-nums' : 'text-[5cqw] uppercase'"
    >
      {{ state.phase === 'cooldown' ? (waitRemaining || 'Attente') : 'Rattrapage' }}
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
    >
      <!-- Le décompte est monté dans la bannière : le répéter ici ferait lire
           deux fois le même chiffre à dix centimètres d'écart. -->
      <p v-if="state.phase === 'cooldown'">
        Tu as perdu ta dernière vie.
      </p>
      <p v-else>
        Ton attente est terminée. Tu peux lancer ton rattrapage.
      </p>

      <ParchmentNote
        v-if="state.recoveryResult === 'failed'"
        tone="danger"
      >
        {{ RECOVERY_FAILURE_MESSAGE }}
      </ParchmentNote>

      <!-- Une attente écourtée reste une attente : à son échéance, c'est le
           rattrapage qui s'ouvre, pas l'ascension. Le dire ici évite au joueur
           de croire qu'il reprend. Voir specs/bonus.md#catalogue. -->
      <ParchmentNote
        v-if="screen.shortenedWait"
        tone="success"
      >
        Un Répit a raccourci ton attente. Elle mène au rattrapage comme une
        attente pleine — plus tôt, c'est tout.
      </ParchmentNote>

      <!-- Un Mimic fait basculer en attente au moment même où le joueur l'ouvre :
           son résultat se lit donc ici, pas sur l'écran de verdict qu'il vient de
           quitter. Seulement pendant l'attente qu'il a ouverte : le rattrapage qui
           suit n'a plus à la rappeler. Voir specs/bonus.md#coffre-et-mimic. -->
      <template v-if="state.phase === 'cooldown' && screen.chest?.opened">
        <ParchmentNote
          v-if="screen.chest.mimic"
          tone="danger"
        >
          Un mimic. Aucun objet, et toutes tes vies d'un coup.
        </ParchmentNote>
        <ParchmentNote
          v-else-if="screen.chest.spell"
          tone="success"
        >
          Le coffre contenait <strong>{{ spellLabel(screen.chest.spell) }}</strong>.
          Il rejoint ton inventaire.
        </ParchmentNote>
      </template>

      <!-- Ce qui est posé sur le joueur : la plupart des sorts attendent sa
           prochaine tentative, le Répit a déjà agi sur l'attente qu'il lit.
           Voir specs/bonus.md#ancrage-et-durée-de-vie. -->
      <div
        v-if="screen.pendingEffects.length"
        class="w-full border-t border-amber-900/20 pt-[1.5cqw]"
      >
        <p class="text-[2.3cqw] font-semibold uppercase tracking-wide text-amber-900/70">
          Ce qui est sur toi
        </p>
        <p class="mt-[0.8cqw] text-[2cqw] italic text-amber-900/60">
          Ces sorts s'appliquent à ta prochaine tentative et disparaîtront avec
          elle — sauf le Répit, qui agit sur l'attente en cours.
        </p>
        <!-- Le badge nommé plutôt qu'EffectPip, qui sert aux rubans de
             l'ascension et tait le sort faute de place — le poster en a. Il porte
             aussi le nom du lanceur en aria-label, que specs/bonus.md exige
             lisible et qu'un survol seul rendrait inatteignable au doigt. -->
        <div class="mt-[1.2cqw] flex flex-wrap justify-center gap-[1cqw]">
          <EffectBadge
            v-for="(effect, index) in screen.pendingEffects"
            :key="index"
            :effect="effect"
            theme="parchment"
          />
        </div>
      </div>

      <ParchmentNote v-if="loading">
        Mise à jour de ta partie…
      </ParchmentNote>
    </div>

    <!-- Les deux actions ne coexistent jamais : « Passer l'attente » n'existe
         que pour l'admin pendant le cooldown, « Commencer le rattrapage »
         qu'une fois l'attente échue. Un seul emplacement suffit donc, entre le
         bas du panneau et les pierres des piquets. -->
    <CardButton
      v-if="state.phase === 'recovery'"
      label="Commencer"
      anchor="poster"
      face="plank"
      :loading="advancing"
      @click="$emit('advance')"
    />
    <CardButton
      v-else-if="isAdmin"
      label="Passer"
      anchor="poster"
      face="plank"
      :loading="skipping"
      @click="$emit('skipCooldown')"
    />
  </div>
</template>

<script setup lang="ts">
// L'écran d'attente — cooldown comme rattrapage prêt à démarrer. Partagé entre
// la vraie partie (pages/index.vue) et son banc de design (pages/test/wait.vue) :
// modifier l'un modifie l'autre, comme QuestionCard pour l'ascension.
//
// Reskin parchemin/médiéval au même titre que l'ascension : les deux phases se
// jouent au camp, donc les deux reçoivent le décor. Tout le contenu vit sur le
// poster, positionné en absolu et dimensionné en cqw — rien ne subsiste sous
// l'image. Voir specs/ecrans.md#cooldown--attente.
import type { GameState } from '~~/server/utils/game'
import type { GameScreen } from '~~/utils/phase'
import { RECOVERY_FAILURE_MESSAGE } from '~~/utils/phase'

defineProps<{
  state: GameState
  screen: GameScreen
  waitRemaining: string
  loading: boolean
  isAdmin: boolean
  skipping: boolean
  advancing: boolean
}>()

defineEmits<{ skipCooldown: [], advance: [] }>()
</script>
