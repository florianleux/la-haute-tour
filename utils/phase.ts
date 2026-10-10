import type { GameState } from "~~/server/utils/game";
import type { Phase } from "~~/server/utils/mechanics";

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
    case "gameOver":
      return "Partie terminée";
  }
}

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
      return "Commencer le rattrapage";
    }

    const { resumes } = recoveryLine(state.recovery);

    if (resumes === true) {
      return "Reprendre";
    }

    if (resumes === false) {
      return "Terminer";
    }

    return "Suivant";
  }

  if (state.phase === "floorEnd") {
    return "Continuer vers l'étage suivant";
  }

  // Un verdict lu en pleine ascension : la suite est la question d'après.
  if (state.verdict) {
    return "Suivant";
  }

  return state.started ? "Reprendre l'ascension" : "Commencer l'ascension";
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
  /** L'écran d'attente : l'attente elle-même, ou le rattrapage prêt à démarrer.
   *  Il prime sur la carte de rattrapage : le verdict de la question qui a pris
   *  la dernière vie reste dans l'état, et le ferait relire au lieu du poster. */
  showsCooldownCard: boolean;
  /** Le libellé du bouton qui fait avancer, null quand rien n'avance ici. */
  action: string | null;
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
 * permis. Dit ici plutôt qu'à chaque endroit qui en dépend — l'écran de jeu comme
 * la barre d'icônes. Voir specs/ecrans.md#principes.
 */
export function isAnswering(state: GameState | null): boolean {
  return Boolean(state?.question);
}

/**
 * L'attente court. Dit ici, comme isAnswering, plutôt qu'à chaque endroit qui
 * en dépend. C'est aussi la seule phase où les Sorts existent, donc la seule
 * d'où leur page est atteignable. Voir specs/ecrans.md#sorts.
 */
export function isCooldown(state: GameState | null): boolean {
  return state?.phase === "cooldown";
}

export function gameScreen(state: GameState): GameScreen {
  const answering = isAnswering(state);
  const chest = answering ? null : state.chest;
  // Un coffre fermé retient le joueur : l'ouvrir est un clic distinct de
  // « suivant », sinon l'objet se perdrait. Voir specs/bonus.md#coffre-et-mimic.
  const holdsChest = chest !== null && !chest.opened;

  return {
    question: state.question,
    verdict: answering ? null : state.verdict,
    recovery: state.recovery && recoveryLine(state.recovery),
    phase: state.phase,
    // Même fiche de révision, même file de contestation : seul le compteur cède
    // la place au bouton « Commencer le rattrapage ».
    // Voir specs/ecrans.md#cooldown--attente.
    showsCooldownCard:
      isCooldown(state) ||
      (state.phase === "recovery" && !answering && !state.recovery),
    chest,
    // Deux lectures du même champ. « pending » veut dire non ancré : un effet qui
    // attend la tentative suivante, ou un sort lié à l'attente qui agit déjà sur
    // celle-ci — les deux se lisent pendant l'attente. Ce qui court sur la
    // tentative s'affiche pendant l'ascension. Voir specs/bonus.md#écrans.
    pendingEffects: state.effects.filter(
      (effect) => effect.state === "pending",
    ),
    activeEffects: state.effects.filter((effect) => effect.state === "active"),
    // Pendant une question, aucune action à part répondre. L'attente porte les
    // siennes — passer l'attente, lancer le rattrapage — et la fin de partie n'en
    // a plus aucune. Voir specs/ecrans.md#principes.
    action:
      answering ||
      holdsChest ||
      isCooldown(state) ||
      state.phase === "gameOver"
        ? null
        : nextActionLabel(state),
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
