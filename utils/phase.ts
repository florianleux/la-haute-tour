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

    return recoveryLine(state.recovery).result === null
      ? "Suivant"
      : "Terminer le rattrapage";
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
  /** Le libellé du bouton qui fait avancer, null quand rien n'avance ici. */
  action: string | null;
  /** Le coffre à ouvrir, null quand il n'y en a pas à cet endroit. */
  chest: GameState["chest"];
  /** Les sorts qui attendent la prochaine tentative : l'attente les récapitule. */
  pendingEffects: GameState["effects"];
  /** Ceux qui courent sur la tentative en jeu : l'ascension en affiche une icône. */
  activeEffects: GameState["effects"];
  /**
   * L'attente en cours a été raccourcie par un Répit. L'écran le dit, parce
   * qu'une attente écourtée mène au rattrapage comme une autre : sans cette
   * ligne, le joueur croit reprendre l'ascension et tombe sur un rattrapage.
   * Voir specs/bonus.md#catalogue.
   */
  shortenedWait: boolean;
}

export interface RecoveryLine {
  /** La question en cours, de 1 au total. */
  position: number;
  total: number;
  successes: number;
  /** Une Indulgence a rallongé ce rattrapage : l'écran le dit. */
  lengthened: boolean;
  /** Le sort du rattrapage, annoncé une fois toutes les questions jouées. */
  result: "resumed" | "waiting" | null;
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
 * L'attente : la seule phase où les Sorts existent, donc la seule d'où la page
 * qui les porte est atteignable. Dit ici, comme isAnswering, plutôt qu'à chaque
 * endroit qui en dépend — la baguette de la barre et la garde de la page.
 * Voir specs/ecrans.md#sorts.
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
    chest,
    // Deux lectures du même champ, parce que tous les effets s'ancrent sur la
    // tentative suivante : ce qui attend se lit pendant l'attente, ce qui court
    // s'affiche pendant l'ascension. Voir specs/bonus.md#écrans.
    pendingEffects: state.effects.filter(
      (effect) => effect.state === "pending",
    ),
    activeEffects: state.effects.filter((effect) => effect.state === "active"),
    // Les Répit d'une attente passée ne sont plus servis — server/utils/effects.ts
    // les retire. Reste la garde de phase : hors attente, il n'y a rien à écourter.
    shortenedWait:
      state.phase === "cooldown" &&
      state.effects.some(
        (effect) => effect.spell === "RESPITE" && effect.face === "boon",
      ),
    // Pendant une question, aucune action à part répondre. L'attente porte les
    // siennes — passer l'attente, lancer le rattrapage — et la fin de partie n'en
    // a plus aucune. Voir specs/ecrans.md#principes.
    action:
      answering ||
      holdsChest ||
      state.phase === "cooldown" ||
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

/** Le résultat ne s'annonce qu'à la fin, jamais question par question. */
function recoveryLine(
  recovery: NonNullable<GameState["recovery"]>,
): RecoveryLine {
  const over = recovery.played >= recovery.total;

  return {
    position: Math.min(recovery.played + 1, recovery.total),
    total: recovery.total,
    successes: recovery.successes,
    lengthened: recovery.lengthened,
    result: over ? (recovery.resumes ? "resumed" : "waiting") : null,
  };
}
