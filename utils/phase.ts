import type { ChestView, GameState, ServedQuestion } from "~~/server/utils/game";
import type { Phase } from "~~/server/utils/mechanics";
import type { LessonId } from "~~/shared/utils/lessons";

/**
 * La phase, dite en français. L'onglet Joueurs de l'administration l'affiche
 * telle quelle : on y lit où en est un joueur, on ne lui propose rien.
 * Voir specs/admin.md#gestion-des-joueurs.
 */
export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "ascent":
      return "En ascension";
    case "cooldown":
      return "En attente";
    case "recovery":
      return "En rattrapage";
    case "floorEnd":
      return "Au palier";
    case "deckEnd":
      return "Deck épuisé";
    case "bossDoor":
      return "Devant la porte";
    case "bossFight":
      return "Contre le boss";
    case "gameOver":
      return "Partie terminée";
  }
}

/** Le libellé qui passe à la suite, du verdict comme du coffre ouvert. */
const NEXT = "Suivant";

/**
 * Ce que propose le bouton qui fait avancer la partie : lire la suite d'un
 * rattrapage, franchir un palier, ou reprendre l'ascension. Le libellé suit la
 * phase renvoyée par le serveur ; la page n'en déduit aucune.
 *
 * Il nomme un geste, plus une destination : le jeu étant la page d'accueil, il
 * n'y a plus d'ailleurs à annoncer. Voir specs/ecrans.md.
 */
export function nextActionLabel(state: GameState): string {
  if (state.phase === "recovery") {
    if (!state.recovery) {
      // Le mot court du glossaire (Rattrapage) : les boutons des écrans
      // illustrés tiennent en un mot.
      return "Commencer";
    }

    const { resumes } = recoveryLine(state.recovery);

    if (resumes === true) {
      return "Reprendre";
    }

    if (resumes === false) {
      return "Terminer";
    }

    return NEXT;
  }

  // Au combat : l'épreuve suivante, ou, le boss battu ou passé, le palier franchi.
  if (state.phase === "bossFight") {
    return state.boss?.outcome ? "Continuer" : NEXT;
  }

  // Un verdict lu en pleine ascension : la suite est la question d'après.
  if (state.verdict) {
    return NEXT;
  }

  // Au repos : le bouton du poster, un mot comme celui du rattrapage.
  return "Commencer";
}

/**
 * Ce que la carte de jeu montre pour un état donné. Le verdict et l'annonce de la
 * phase ne s'excluent pas : la question qui a fini l'étage est justement celle
 * dont la réponse reste à lire, et le palier s'affiche par-dessus.
 * Voir specs/ecrans.md#jeu.
 */
export interface GameScreen {
  /** La question servie, avec son décompte — null quand aucune ne tourne. */
  question: GameState["question"];
  /** Le verdict à lire, null tant qu'une question tourne. */
  verdict: GameState["verdict"];
  /** Où en est le rattrapage, tel qu'il s'affiche. Null hors rattrapage. */
  recovery: RecoveryLine | null;
  /** La phase que le serveur a rendue — l'écran l'annonce, il n'en déduit rien. */
  phase: GameState["phase"];
  /** Le coffre à ouvrir, null quand il n'y en a pas à cet endroit. */
  chest: GameState["chest"];
  /** Les sorts qui attendent la prochaine tentative : l'attente les récapitule. */
  pendingEffects: GameState["effects"];
  /** Ceux qui courent sur la tentative en jeu : l'ascension en affiche une icône. */
  activeEffects: GameState["effects"];
}

/** Les libellés du verdict de rattrapage, affichés sur le verdict de la
 *  question qui le scelle. */
export const RECOVERY_SUCCESS_MESSAGE = "Rattrapage réussi : tes vies sont restaurées.";
export const RECOVERY_FAILURE_MESSAGE = "Rattrapage raté : une nouvelle attente commence.";

export interface RecoveryLine {
  /** La question en cours, de 1 au total. */
  position: number;
  total: number;
  successes: number;
  /** Les bonnes réponses exigées, bornées aux questions tirées. */
  required: number;
  /** Le sort du rattrapage, annoncé dès que le verdict est scellé — quota
   *  atteint (true : le joueur reprend) ou mathématiquement impossible (false).
   *  Null tant qu'il ne l'est pas. */
  resumes: boolean | null;
}

/**
 * Une question tourne : le chrono court, et rien d'autre que répondre n'est
 * permis. Dit ici plutôt qu'à chaque endroit qui en dépend.
 * Voir specs/ecrans.md#principes.
 */
export function isAnswering(state: GameState | null): boolean {
  return runningTimer(state) !== null;
}

/** Ce qui court, question ou épreuve de boss : de quoi rendre son chrono et envoyer à temps. */
export interface RunningTimer {
  /** Change d'une question ou d'une épreuve à la suivante : une seule réponse partie par id. */
  id: string;
  expiresAt: string;
  focusGraceMs: number;
}

/** La question servie, ou l'épreuve de boss servie. Null quand rien ne court. */
export function runningTimer(state: GameState | null): RunningTimer | null {
  const trial = state?.boss?.trial;
  // L'échéance désigne l'épreuve : fixée à son service, elle ne se répète pas,
  // là où un même drapeau peut revenir d'un combat à l'autre.
  return state?.question ?? (trial ? { id: trial.expiresAt, expiresAt: trial.expiresAt, focusGraceMs: trial.focusGraceMs } : null);
}

/**
 * La fin d'un combat de boss qui se lit avant la phase d'après : la défaite,
 * sur son outro, avant le camp en attente ; la victoire ou le passage au
 * dernier étage, sur l'arène, avant la fin de partie. Désignée pour que la page ne la montre
 * qu'une fois — la défaite par l'échéance de son attente, propre à chacune.
 * Null partout ailleurs.
 */
export function bossEndId(state: GameState): string | null {
  if (state.phase === "cooldown" && state.boss?.outcome === "defeat") {
    return state.cooldownUntil;
  }
  return state.phase === "gameOver" ? state.boss?.outcome ?? null : null;
}

/**
 * L'attente court. Dit ici, comme isAnswering, plutôt qu'à chaque endroit qui
 * en dépend.
 */
export function isCooldown(state: GameState | null): boolean {
  return state?.phase === "cooldown";
}

/**
 * L'ascension au repos : rien de tiré, rien à lire. Pas une phase — la phase
 * reste `ascent` —, mais ce qui la met au camp. Voir specs/spec.md#glossaire
 * (Au repos) et docs/adr/0012-le-camp-au-repos-se-deduit-de-l-ascension.md.
 */
export function isAtRest(state: GameState | null): boolean {
  return state?.phase === "ascent" && !state.question && !state.verdict;
}

/**
 * La leçon de Michel qui attend d'être jouée d'elle-même, une à la fois, lue
 * dans l'état servi : celle du camp au repos ; sans vies et rien de tiré, celle
 * de la chute, puis celle du rattrapage une fois l'attente échue ; enfin, au
 * camp, celle du Grimoire, le premier sort obtenu. Null quand aucune n'est due.
 * Voir specs/ecrans.md#leçons-de-michel.
 */
export function dueLesson(state: GameState | null): LessonId | null {
  const done = state?.lessonsDone ?? [];
  if (isAtRest(state) && !done.includes("camp")) {
    return "camp";
  }
  if (state?.nextRecovery && !done.includes("fall")) {
    return "fall";
  }
  if (state?.nextRecovery && state.phase === "recovery" && !done.includes("recovery")) {
    return "recovery";
  }
  return isAtCamp(state) && state?.spellDiscovered && !done.includes("spellbook") ? "spellbook" : null;
}

/**
 * Le camp : l'attente, le rattrapage tant qu'il n'a ni question ni tirage,
 * l'ascension au repos, et la porte du boss dont le joueur est redescendu.
 * C'est l'écran d'attente, et le seul moment où les Sorts existent, donc le seul
 * d'où la boîte qui les porte s'ouvre. Dit ici, comme isAnswering, plutôt qu'à
 * chaque endroit qui en dépend — la carte de jeu et les boîtes du camp, qui se
 * ferment quand la partie le quitte. Le serveur tient la même règle (requireCamp).
 * Voir specs/spec.md#glossaire (Camp) et specs/ecrans.md#sorts.
 */
export function isAtCamp(state: GameState | null): boolean {
  return (
    isCooldown(state) ||
    (state?.phase === "recovery" && !state.question && !state.recovery) ||
    isAtRest(state) ||
    isAtCampFromDoor(state)
  );
}

/**
 * Redescendu de la porte du boss (`descendToCamp`) : la phase reste `bossDoor`,
 * la position (`doorSpot`) le met au camp. Voir specs/boss.md#attendre-au-camp.
 */
export function isAtCampFromDoor(state: GameState | null): boolean {
  return state?.phase === "bossDoor" && state.door?.spot === "camp";
}

/**
 * Les boîtes du camp, que ses objets ouvrent par-dessus lui : le Grimoire, le
 * Volumen, les Haut-faits et l'Inventaire. Sans URL : la page de jeu retient
 * laquelle est ouverte. Voir specs/spec.md#glossaire (Boîte du camp).
 */
export type CampOverlayId = "spellbook" | "questionLog" | "achievements" | "inventory";

export function gameScreen(state: GameState): GameScreen {
  const answering = isAnswering(state);
  return {
    question: state.question,
    verdict: answering ? null : state.verdict,
    recovery: state.recovery && recoveryLine(state.recovery),
    phase: state.phase,
    chest: answering ? null : state.chest,
    // Deux lectures du même champ. « pending » veut dire non ancré : un effet qui
    // attend la tentative suivante, ou un sort lié à l'attente qui agit déjà sur
    // celle-ci — les deux se lisent pendant l'attente. Ce qui court sur la
    // tentative s'affiche pendant l'ascension. Voir specs/bonus.md#écrans.
    pendingEffects: state.effects.filter(
      (effect) => effect.state === "pending",
    ),
    activeEffects: state.effects.filter((effect) => effect.state === "active"),
  };
}

/**
 * Le bouton qui avance et ce qu'il fait : demander la suite au serveur, quitter
 * pour le poster l'écran que la page retenait (la chute, le Mimic), entrer
 * dans l'écran du coffre de telle question, ou remonter du camp à la porte du
 * boss. Quitter et entrer dans le coffre sont des allers purement client.
 */
export type PlayAction =
  | { label: string; move: "advance" | "leave" | "climbToDoor" }
  | { label: string; move: "enterChest"; chestOf: string };

/**
 * Ce que la page retient seule, que le serveur ne sait pas. Chacun désigne la
 * question du verdict qu'il concerne : un verdict neuf les rend caducs d'eux-mêmes,
 * sans que personne ait à les remettre à zéro.
 */
export interface PlayClientState {
  /** La question dont le joueur a quitté le verdict pour l'écran du coffre. */
  chestOf: string | null;
  /** La question de la chute que le joueur lit encore. */
  fallenOn: string | null;
  /** La fin de combat que le joueur lit encore (bossEndId). */
  bossEndOn?: string | null;
}

const NO_DETOUR: PlayClientState = { chestOf: null, fallenOn: null };

/**
 * La carte que l'écran de jeu monte — une seule — avec ce qu'elle seule porte :
 * la question pour l'ascension, le coffre pour son écran.
 */
export type PlayView = {
  screen: GameScreen;
  /** Le bouton qui avance, null quand la carte n'en a pas. */
  action: PlayAction | null;
} & (
  | { card: "question"; question: ServedQuestion }
  | { card: "chest"; chest: ChestView }
  | { card: "recovery" | "cooldown" | "result" | "bossDoor" | "bossOutro" }
  | { card: "bossFight"; boss: NonNullable<GameState["boss"]> }
);

/**
 * La question de la chute, si ce verdict en est une : celle qui vient de prendre
 * la dernière vie. Le serveur est déjà en attente, la page retient le verdict le
 * temps d'un clic sur « Redescendre ». `lifeLost` écarte le Mimic et les verdicts
 * de rattrapage. Voir specs/spec.md#glossaire (Chute).
 */
export function fallQuestionId(state: GameState): string | null {
  return state.verdict?.lifeLost && isAtCamp(state)
    ? state.verdict.questionId
    : null;
}

/**
 * Quelle carte l'écran de jeu monte, et ce que fait son bouton. L'ordre des
 * tests compte : chacun écarte un état que les suivants prendraient à tort.
 */
export function playView(
  state: GameState,
  client: PlayClientState = NO_DETOUR,
): PlayView {
  const screen = gameScreen(state);
  const atCamp = isAtCamp(state);
  const verdictId = state.verdict?.questionId;
  // Un aller client ne vaut que pour le verdict qu'il désigne.
  const onVerdict = (id: string | null): boolean => id !== null && id === verdictId;
  const readingFall = atCamp && onVerdict(client.fallenOn);
  const viewingChest = onVerdict(client.chestOf);
  const next: PlayAction = { label: nextActionLabel(state), move: "advance" };

  // La fin du combat se lit avant la phase d'après, comme une chute avant le
  // poster : la défaite sur son outro, la victoire ou le passage du dernier étage sur
  // l'arène. Voir specs/spec.md#glossaire (Outro de défaite).
  const ended = bossEndId(state);
  if (ended !== null && ended === client.bossEndOn && state.boss) {
    return state.boss.outcome === "defeat"
      ? { screen, card: "bossOutro", action: { label: "Redescendre", move: "leave" } }
      : { screen, card: "bossFight", boss: state.boss, action: { label: "Continuer", move: "leave" } };
  }

  // Le combat : l'arène sert l'épreuve, puis son verdict et la suite.
  if (state.phase === "bossFight" && state.boss) {
    return { screen, card: "bossFight", boss: state.boss, action: state.boss.trial ? null : next };
  }

  // Devant la porte, qui porte ses gestes. Redescendu, au camp : « Remonter »,
  // porte déverrouillée seulement. Voir specs/boss.md#attendre-au-camp.
  if (state.phase === "bossDoor") {
    return isAtCampFromDoor(state)
      ? { screen, card: "cooldown", action: state.door?.unlocked ? { label: "Remonter", move: "climbToDoor" } : null }
      : { screen, card: "bossDoor", action: null };
  }

  // Avant l'attente : le rattrapage tiré porte sa question et son verdict.
  // Pendant une question, aucune action à part répondre.
  if (state.phase === "recovery" && !atCamp) {
    return { screen, card: "recovery", action: screen.question ? null : next };
  }

  if (state.phase === "ascent" && screen.question) {
    return { screen, card: "question", question: screen.question, action: null };
  }

  // Avant le verdict : celui de la question qui a pris la dernière vie reste
  // dans l'état, et le ferait relire au lieu du poster — sauf le temps de la
  // chute, que le joueur lit avant de redescendre, et du Mimic, qu'il voit
  // sauter avant le poster. L'attente porte ses propres boutons ; seul le
  // rattrapage prêt à démarrer et l'ascension au repos avancent d'ici — le
  // rattrapage une fois expliqué : Michel retient « Commencer » tant que la
  // leçon de la chute ou du rattrapage reste à voir.
  if (atCamp && !readingFall && !viewingChest) {
    const lesson = dueLesson(state);
    return {
      screen,
      card: "cooldown",
      action: isCooldown(state) || lesson === "fall" || lesson === "recovery" ? null : next,
    };
  }

  if (viewingChest && screen.chest) {
    // Fermé, le coffre porte son propre bouton : l'ouvrir n'avance rien. Le
    // Mimic, lui, a déjà ouvert l'attente côté serveur : son bouton mène au
    // poster. Un rechargement y va droit. Voir specs/bonus.md#coffre-et-mimic.
    return {
      screen,
      card: "chest",
      chest: screen.chest,
      action: !screen.chest.opened ? null : atCamp ? { label: NEXT, move: "leave" } : next,
    };
  }

  // Reste le verdict à lire, le palier et la fin de partie : l'ascension au
  // repos est au camp, et tout rattrapage tiré sur sa carte.

  // Le coffre fermé retient le joueur : « Suivant » mène à son écran, qui
  // a son propre bouton pour l'ouvrir — sinon l'objet se perdrait.
  // Voir specs/bonus.md#coffre-et-mimic.
  if (screen.verdict && screen.chest && !screen.chest.opened) {
    return {
      screen,
      card: "result",
      action: { label: NEXT, move: "enterChest", chestOf: screen.verdict.questionId },
    };
  }

  if (readingFall) {
    return {
      screen,
      card: "result",
      action: { label: "Redescendre", move: "leave" },
    };
  }

  // La fin de partie n'a plus aucune action, la fin du deck non plus.
  // Voir specs/ecrans.md#principes.
  return {
    screen,
    card: "result",
    action: state.phase === "gameOver" || state.phase === "deckEnd" ? null : next,
  };
}

/**
 * Vrai partout sauf sur le jeu quand une question ou son verdict reste à finir :
 * c'est le seul endroit où une interaction commencée avant la fermeture doit
 * pouvoir se terminer. Décide pour toutes les pages à la fois — le layout
 * l'applique, aucune page n'a à le redire. Voir specs/admin.md#maintenance.
 */
export function blockedByMaintenance(
  state: GameState | null,
  path: string,
): boolean {
  if (!state?.maintenance) {
    return false;
  }

  return !(path === "/" && (state.question !== null || state.verdict !== null));
}

/** Le résultat s'annonce dès que le verdict est scellé : quota atteint ou
 *  mathématiquement impossible. Les questions restantes ne se jouent pas. */
function recoveryLine(
  recovery: NonNullable<GameState["recovery"]>,
): RecoveryLine {
  const over = recovery.sealed;

  return {
    position: Math.min(recovery.played + 1, recovery.total),
    total: recovery.total,
    successes: recovery.successes,
    required: recovery.required,
    resumes: over ? recovery.resumes : null,
  };
}
