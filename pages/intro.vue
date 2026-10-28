<template>
  <div class="contents">
    <DialogueScene
      :dialogue="dialogue"
      @answer="name = $event"
      @choose="pick"
      @end="end"
    />

    <!-- Le Fromage pris : il se montre pour lui seul, et OK fait entrer dans
         la Tour. -->
    <ItemReveal
      v-if="gifted"
      :label="CHEESE.name"
      @close="leave"
    >
      <template v-if="leaveFailed" #notice>
        L'entrée dans la Tour a échoué. Réessaie.
      </template>
      <img
        :src="CHEESE.image"
        :alt="CHEESE.name"
        class="size-full object-contain"
      >
    </ItemReveal>
  </div>
</template>

<script setup lang="ts">
// L'introduction de l'aventure : la scène par laquelle le joueur entre dans la
// Tour. Toute page y ramène tant qu'il ne l'a pas finie (voir
// middleware/auth.global.ts) ; finie, elle se ferme, sauf à un admin qui la
// relit.
//
// L'Inconnu salue, demande son nom au joueur, puis ce qu'il est, et répond
// ensuite à ses questions — la Tour, comment on y monte — jusqu'à ce que le
// joueur en sache assez. Autant de dialogues enchaînés : l'affiche d'un dialogue
// est déclarée une fois pour toutes (voir ADR 0010), si bien qu'un joueur qui
// passe de « ??? » à son nom change de dialogue, et un dialogue ne connaît pas
// d'avance ce qu'on y choisira. C'est aussi la réponse du joueur qui lui donne
// son portrait : silhouette jusque-là.
//
// Le joueur nommé, et avant ses questions, L'Inconnu lit sa guilde sur sa
// bannière : le joueur ne la choisit pas, l'admin l'a décidée en l'invitant
// (voir specs/equipes.md).
//
// Le nom et le genre sont gardés sur le compte du joueur servi : le nom est
// celui sous lequel le jeu le montrera ensuite (voir specs/spec.md, glossaire,
// « Nom d'aventurier »).
import type { Dialogue, DialogueLine, Speaker } from '~~/utils/dialogue'
import { ADVENTURER_NAME_MAX_LENGTH } from '~~/shared/utils/adventurerName'
import type { Gender } from '~~/shared/utils/genders'
import { TEAM_IDS } from '~~/shared/utils/teams'
import type { TeamId } from '~~/shared/utils/teams'

// Le décor flou de l'attente en attendant le sien, cf. components/PlayFrame.vue.
const BACKGROUND = '/images/blurry-cooldown-bg.webp'

// Chacun parle dans la couleur de son habit : la robe de L'Inconnu, la tunique
// du joueur.
const UNKNOWN: Speaker = { name: 'L\'Inconnu', portrait: '/images/intro-unknown.webp', color: 'brown' }
/**
 * Le joueur tant qu'il n'a pas dit ce qu'il est : une silhouette, qui ne
 * présume pas de sa réponse. Elle a le cadrage des trois portraits, si bien que
 * le corps ne change pas de taille au moment où il répond.
 */
const SILHOUETTE = '/images/intro-player-unknown.webp'

/**
 * Le joueur sous sa silhouette. Jamais en retrait : déjà délavée, elle
 * disparaîtrait dans le décor une fois reculée et assombrie.
 */
function faceless(name: string): Speaker {
  return { name, portrait: SILHOUETTE, retreats: false, color: 'orange' }
}

/**
 * La rencontre : il salue, jauge, puis demande le nom. Condescendant — il aide
 * parce qu'il croit l'aventurier perdu d'avance (voir specs/lore.md).
 */
const GREETING_LINES: [DuoLine, ...DuoLine[]] = [
  { place: 'right', text: 'Tiens. Encore un.' },
  {
    place: 'right',
    text: 'Salut à toi, aventurier. Tu viens pour la Tour, comme les autres. '
      + 'Ils venaient tous pour la Tour.',
  },
  {
    place: 'right',
    text: 'Donne-moi ton nom. Qu\'on sache au moins quoi raconter après.',
    prompt: { label: 'Ton nom', minLength: 1, maxLength: ADVENTURER_NAME_MAX_LENGTH },
  },
]

/** Ce que le joueur peut répondre à L'Inconnu, dans l'ordre où il le voit. */
const REPLIES = ['Un aventurier', 'Une aventurière', 'C\'est pas tes oignons'] as const

type Reply = typeof REPLIES[number]

/** Le genre que dit chaque réponse. */
const GENDER_OF: Record<Reply, Gender> = {
  'Un aventurier': 'MALE',
  'Une aventurière': 'FEMALE',
  'C\'est pas tes oignons': 'NEUTRAL',
}

/**
 * Le joueur nommé, L'Inconnu revient sur son « aventurier » de la rencontre et
 * demande ce qu'il est.
 */
function question(name: string): [DuoLine, ...DuoLine[]] {
  return [
    { place: 'right', text: `${name}. Soit.` },
    {
      place: 'right',
      text: 'J\'ai dit aventurier. J\'ai peut-être parlé trop vite. T\'es quoi, au juste ?',
      choices: REPLIES,
    },
  ]
}

/**
 * Ce que le joueur peut demander à L'Inconnu, dans l'ordre où il le voit. Le
 * départ n'en fait pas partie : offert dès le premier sujet abordé, il ferme la
 * liste.
 */
const TOPICS = [
  'C\'est quoi, cette Tour ?',
  'Qu\'est-ce qu\'il y a, tout en haut ?',
  'Comment on monte ?',
  'Et quand je n\'ai plus de vies ?',
  'Il n\'y a que des questions ?',
] as const

type Topic = typeof TOPICS[number]

/** Ce qui clôt la scène au lieu de ramener au menu. */
const LEAVE = 'J\'en sais assez.'

/**
 * Les questions précises n'arrivent qu'après la large dont elles découlent :
 * on demande ce qu'il y a en haut de la Tour, ou comment on y monte, une fois
 * qu'on sait ce qu'elle est ; ce qui arrive sans vies, une fois qu'on sait
 * comment on monte.
 */
const UNLOCKED_BY: Partial<Record<Topic, Topic>> = {
  'Qu\'est-ce qu\'il y a, tout en haut ?': 'C\'est quoi, cette Tour ?',
  'Comment on monte ?': 'C\'est quoi, cette Tour ?',
  'Et quand je n\'ai plus de vies ?': 'Comment on monte ?',
  'Il n\'y a que des questions ?': 'Comment on monte ?',
}

type DuoLine = DialogueLine<'left' | 'right'>

/**
 * Ce que L'Inconnu répond à chaque sujet. Les règles y restent vagues (« une
 * minute à peine », « une demi-journée ») : leurs valeurs vivent dans les règles
 * de l'étage, et un réglage ne doit pas faire mentir le texte. Voir
 * specs/mecanique.md#règles-chiffrées.
 */
const ANSWERS: Record<Topic, DuoLine[]> = {
  'C\'est quoi, cette Tour ?': [
    {
      place: 'right',
      text: 'Tu ne sais même pas ça ? Bon. Il y a des années, il y a eu le Grand Événement : '
        + 'la fin de QPUC.',
    },
    {
      place: 'right',
      text: 'Comme redouté, après la fin des quotidiennes, ça n\'a pas tenu longtemps.',
    },
    {
      place: 'right',
      text: 'Depuis, la culture a disparu presque partout. Le peu qui en reste est là-dedans, '
        + 'dans la Tour.',
    },
    {
      place: 'right',
      text: 'Six étages, à gravir l\'un après l\'autre.',
    },
    {
      place: 'right',
      text: 'Les deux guildes se la disputent : c\'est à qui en atteindra le premier le sommet.',
    },
  ],
  'Qu\'est-ce qu\'il y a, tout en haut ?': [
    {
      place: 'right',
      text: 'Une prophétie. Celui qui achèvera l\'ascension ramènera QPUC, paraît-il.',
    },
    {
      place: 'right',
      text: 'Une jolie histoire. Personne n\'en a jamais vu la fin. Et franchement, tout le '
        + 'monde s\'en porte très bien.',
    },
  ],
  'Comment on monte ?': [
    {
      place: 'right',
      text: 'En répondant. La Tour pose ses questions une à une. Tu écris ta réponse, elle juge.',
    },
    {
      place: 'right',
      text: 'Ne traîne pas : chaque question a son temps, une minute à peine. Passé ce temps, '
        + 'c\'est une erreur.',
    },
    {
      place: 'right',
      text: 'Chaque erreur te coûte une vie, et tu n\'en as que quelques-unes.',
    },
    {
      place: 'right',
      text: 'Viens à bout de toutes les questions d\'un étage, et la porte du suivant t\'attend. '
        + 'Simple. C\'est ce qu\'ils disaient tous.',
    },
  ],
  'Et quand je n\'ai plus de vies ?': [
    {
      place: 'right',
      text: 'Alors tu attends. Une demi-journée, à peu près. Tu reprendras là où tu es tombé.',
    },
    {
      place: 'right',
      text: 'Mais la Tour n\'oublie rien. Chaque question ratée, elle la garde de côté.',
    },
    {
      place: 'right',
      text: 'L\'attente finie, elle t\'en ressort quelques-unes. Réponds juste et tes vies '
        + 'reviennent. Rate tout, et tu attends encore, un peu moins longtemps.',
    },
    {
      place: 'right',
      text: 'Réponds juste à une même question assez souvent, et elle finira par te la laisser.',
    },
    {
      place: 'right',
      text: 'Profite de l\'attente pour réviser. Tu en auras besoin. Et tu en auras le temps.',
    },
  ],
  // La magie s'annonce sans s'expliquer : coffres et Sorts se découvrent en
  // montant (voir specs/bonus.md).
  'Il n\'y a que des questions ?': [
    {
      place: 'right',
      text: 'Pas seulement. En montant, il arrive qu\'on trouve de quoi user de magie.',
    },
    { place: 'right', text: 'Je ne t\'en dirai pas plus. Tu verras bien, si tu montes assez haut.' },
  ],
}

/**
 * Le départ. Il regarde : il préfère sa vie de streamer à la prophétie (voir
 * specs/lore.md). Un clin d'œil, rien de plus — le twist se garde pour la fin.
 */
const FAREWELL: [DuoLine, ...DuoLine[]] = [
  { place: 'left', text: LEAVE },
  { place: 'right', text: 'Ça, j\'en doute. Mais va. La Tour t\'attend, elle a tout son temps.' },
  {
    place: 'right',
    text: 'Moi, je regarderai d\'ici. J\'aime bien regarder.',
    choices: ['Commencer l\'ascension'],
  },
]

/**
 * Ce que défend chaque guilde : l'émission dont elle veut le retour, en
 * italique (voir dialogueSegments). Deux formes : le titre seul (« par… »), et
 * précédé de « de », contracté quand le titre commence par « Les » — pas de
 * « de Les ».
 */
const CREED_OF: Record<TeamId, { title: string, ofTitle: string }> = {
  MIDI: { title: '*Les 12 coups de midi*', ofTitle: 'des *12 coups de midi*' },
  TLM: { title: '*Tout le monde veut prendre sa place*', ofTitle: 'de *Tout le monde veut prendre sa place*' },
}

/**
 * L'Inconnu lit la bannière du joueur : sa guilde, et la rivale (voir
 * specs/lore.md#guildes). Leur course au sommet attend que le joueur demande ce
 * qu'est la Tour. Rien à choisir, rien à recevoir : le joueur porte déjà ses
 * couleurs. Rien à lire sans équipe — l'admin qui relit
 * l'introduction.
 */
function guild(team: TeamId | null): DuoLine[] {
  if (team === null) {
    return []
  }


  const rival = TEAM_IDS.find(id => id !== team) ?? team

  return [
    {
      place: 'right',
      text: `Je vois à ta bannière que tu fais partie de la Guilde des *${teamLabel(team)}*. `
        + `J'imagine que tu es plutôt un amateur ${CREED_OF[team].ofTitle}.`,
    },
    {
      place: 'right',
      text: `Alors méfie-toi des *${teamLabel(rival)}*, `
        + `qui ne jurent que par ${CREED_OF[rival].title}.`,
    },
  ]
}

/**
 * Le don, au moment de partir : il rappelle le joueur et lui tend le Fromage,
 * sans dire pourquoi — c'est lui qui attirera Michel au camp (voir
 * specs/lore.md). Le prendre finit l'introduction.
 */
const GIFT: [DuoLine, ...DuoLine[]] = [
  {
    place: 'right',
    text: 'J\'oubliais ! Prends ceci, ça te sera utile !',
    choices: ['Prendre ce que L\'Inconnu te tend'],
  },
]

/**
 * Où en est l'introduction. Chaque étape porte ce que son dialogue doit
 * afficher, plutôt qu'un état à côté qui pourrait être vide au mauvais moment.
 */
type Step =
  | { scene: 'greeting' | 'question' | 'menu' | 'farewell' | 'gift' }
  | { scene: 'reaction', reply: Reply }
  | { scene: 'topic', topic: Topic }

const { user, refresh: refreshUser } = await useCurrentUser()

const step = ref<Step>({ scene: 'greeting' })
const name = ref('')
/** Ce que le joueur a dit être. Null tant qu'il n'a pas répondu : silhouette. */
const gender = ref<Gender | null>(null)
/** Les sujets déjà abordés : ils sortent du menu, et ouvrent leurs suites. */
const heard = ref<Topic[]>([])
/**
 * Le rang du dernier choix cliqué. Lu par `end` et non traité au clic : la
 * scène rend le choix puis, dans le même geste, la fin du dialogue (voir
 * useDialogue). C'est donc la fin qui décide de la suite, une seule fois.
 */
let picked = 0

function pick(rank: number): void {
  picked = rank
}

const player = computed<Speaker>(() => (gender.value === null
  ? faceless(name.value || '???')
  : { name: name.value, portrait: playerPortrait(gender.value), color: 'orange' }))

/** Un dialogue de l'introduction : toujours le joueur face à L'Inconnu. */
function stage(lines: Extract<Dialogue, { left: Speaker }>['lines']): Dialogue {
  return { background: BACKGROUND, left: player.value, right: UNKNOWN, lines }
}

/** Les sujets que le menu propose encore : ni abordés, ni en attente de leur question large. */
const open = computed<Topic[]>(() => TOPICS.filter((topic) => {
  const parent = UNLOCKED_BY[topic]

  return !heard.value.includes(topic) && (parent === undefined || heard.value.includes(parent))
}))

/**
 * La question qui ouvre le menu, et celle qui y ramène. Le départ n'y paraît
 * qu'une fois un sujet abordé : on ne quitte pas L'Inconnu sans l'avoir écouté.
 */
function menu(text: string): DuoLine {
  // Jamais vide : au début la Tour, ensuite le départ, toujours là.
  const [first, ...rest] = heard.value.length === 0 ? open.value : [...open.value, LEAVE]

  return { place: 'right', text, choices: [first, ...rest] }
}

// Servir un autre dialogue à la scène la reprend à sa première réplique (voir
// useDialogue) : c'est ce qui enchaîne les étapes, sans `:key`.
const dialogue = computed<Dialogue>(() => {
  const now = step.value

  switch (now.scene) {
    case 'greeting':
      return stage(GREETING_LINES)
    case 'question':
      return stage(question(name.value))
    case 'reaction':
      return stage([
        { place: 'left', text: now.reply },
        { place: 'right', text: 'Peu importe. La Tour ne fait pas la différence.' },
        { place: 'left', text: 'Et toi, qui es-tu ?' },
        {
          place: 'right',
          text: 'Personne d\'important. Quelqu\'un qui a vu monter beaucoup de monde. '
            + 'Et redescendre à peu près autant.',
        },
        ...guild(user.value?.team ?? null),
        menu('Tu as des questions, je suppose. Ils en ont tous.'),
      ])
    case 'menu':
      return stage([menu('Autre chose ?')])
    case 'farewell':
      return stage(FAREWELL)
    case 'gift':
      return stage(GIFT)
  }

  return stage([{ place: 'left', text: now.topic }, ...ANSWERS[now.topic]])
})

async function end(): Promise<void> {
  const now = step.value

  switch (now.scene) {
    case 'greeting':
      step.value = { scene: 'question' }
      // L'étape suivante est déjà posée : comme pour le genre plus bas, l'écriture
      // ne retient pas le dialogue, et un échec se lit en console.
      await $fetch('/api/profile/name', { method: 'PUT', body: { name: name.value } })
      break
    case 'question': {
      const reply = REPLIES[picked]

      gender.value = GENDER_OF[reply]
      step.value = { scene: 'reaction', reply }
      // Le dialogue n'attend pas l'écriture : la réponse est dite tout de suite,
      // et un échec n'a rien à changer à ce qui se joue ici — il se lit en
      // console.
      await $fetch('/api/profile/gender', { method: 'PUT', body: { gender: gender.value } })
      break
    }
    case 'reaction':
    case 'menu': {
      // Le rang est celui de la liste affichée, pas de TOPICS : elle a été
      // filtrée, et le départ la ferme.
      step.value = picked === open.value.length
        ? { scene: 'farewell' }
        : { scene: 'topic', topic: open.value[picked] }
      break
    }
    case 'topic':
      heard.value.push(now.topic)
      step.value = { scene: 'menu' }
      break
    case 'farewell':
      step.value = { scene: 'gift' }
      break
    case 'gift':
      // Le Fromage pris, il se montre (ItemReveal) ; son OK appelle leave().
      gifted.value = true
      break
  }
}

/** Le Fromage, que L'Inconnu tend au départ. */
const CHEESE = itemLabel('CHEESE')
/** Le Fromage est pris : il se montre jusqu'au OK. */
const gifted = ref(false)
/** Le OK est parti : un second clic ne refinit pas l'introduction. */
const leaving = ref(false)
/** Le OK n'a pas abouti : on le dit, et il redevient cliquable. */
const leaveFailed = ref(false)

/**
 * Le OK du Fromage : l'introduction rend la main au jeu. La page de jeu affiche
 * ce que la phase du joueur désigne, et c'est là qu'il commence. L'identité est
 * relue avant d'y aller : gardée en cache, elle dirait encore l'introduction à
 * faire, et le garde des pages y renverrait le joueur.
 */
async function leave(): Promise<void> {
  if (leaving.value) {
    return
  }
  leaving.value = true
  leaveFailed.value = false
  try {
    await $fetch('/api/profile/intro', { method: 'POST' })
  }
  catch {
    leaveFailed.value = true
    leaving.value = false
    return
  }
  await refreshUser()
  await navigateTo('/')
}
</script>
