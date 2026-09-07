import { and, eq, sql } from 'drizzle-orm'
import { rulesForFloor } from './rules'
import { activeEffects, missedPool, users } from '../db/schema'
import type { FloorRules } from './rules'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import { SPELL_IDS } from '../../shared/utils/spells'
import type { SpellEffect, SpellFace, SpellId } from '../../shared/utils/spells'

/**
 * Le grimoire : ce que fait chaque sort, en un seul endroit.
 *
 * Un sort a deux faces d'action : il **module les règles** de la tentative où il
 * s'ancre (Vitalité change les vies, Chronomancie les timers, Répit l'attente,
 * Indulgence le tirage de rattrapage), et il peut **agir à l'instant** du lancer
 * (Purge vide une ligne du Pool Échecs, Répit recalcule l'échéance). Le grimoire
 * possède les deux ; le reste du système dispatch par identifiant de sort.
 *
 * Ajouter un sort au catalogue, c'est ajouter une entrée ci-dessous — et rien
 * d'autre. Le déclencheur « attente ou tentative » est déjà un catalogue
 * (`WAIT_BOUND_SPELL_IDS` dans `shared/utils/spells.ts`) ; la modulation et
 * l'action instantanée le sont ici. Voir ADR 0004 et `specs/bonus.md#catalogue`.
 */
interface SpellEntry {
  /**
   * La part des règles que ce sort module. Reçoit les règles de l'étage (la
   * base, jamais l'accumulateur du fold) et les effets posés sur le joueur.
   * Compte ses propres faces — chaque sort est self-contained.
   */
  modulateRules?: (rules: FloorRules, effects: SpellEffect[]) => Partial<FloorRules>

  /**
   * Ce que ce sort fait à l'instant du lancer, sur la cible. `face` est la face
   * appliquée (blanche sur soi/allié, noire sur ennemi) — chaque sort décide
   * s'il en lit. Optionnel : Vitalité et Chronomancie n'agissent pas à l'instant.
   */
  actInstantly?: (db: Database, target: User, face: SpellFace) => Promise<void>
}

export const SPELLS: Record<SpellId, SpellEntry> = {
  VITALITY: {
    // Additive : le mode de cumul est propre à chaque sort. Le plancher n'est
    // pas la règle — c'est la limite d'effets négatifs qui garantit qu'il reste
    // une vie, et elle suffit tant qu'elle tient. Elle se tient au tirage, donc
    // par une lecture : deux lanceurs qui frappent la même cible au même instant
    // peuvent lui poser une malédiction de trop. Assumé pour tout le reste — un
    // timer divisé une fois de plus ne casse rien — mais pas ici : une tentative
    // à zéro vie ne se joue pas. Voir specs/bonus.md#limite-deffets-négatifs.
    modulateRules: (rules, effects) => ({
      lives: Math.max(1, rules.lives + netOf(effects, 'VITALITY') * rules.vitalityLives),
    }),
  },

  RESPITE: {
    // Multiplicatif : diviser plutôt que soustraire est ce qui empêche une
    // attente d'atteindre zéro, quel que soit l'empilement. Le blanc raccourcit
    // l'attente — d'où la division. Voir specs/bonus.md#cumul.
    modulateRules: (rules, effects) => ({
      cooldownMs: rules.cooldownMs / rules.respiteFactor ** netOf(effects, 'RESPITE'),
    }),

    // L'échéance de l'attente, refaite à partir de son début et de tout ce qui
    // est posé sur elle — jamais grignotée depuis ce qu'il en restait. Deux Répit
    // divisent donc la durée d'origine par quatre, dans l'ordre qu'on voudra.
    // Sur un allié en pleine ascension, il n'y a rien à raccourcir et le sort est
    // gaspillé — même logique qu'un pool vide. Voir specs/bonus.md#catalogue.
    actInstantly: async (db, target) => {
      const startedAt = target.cooldownStartedAt
      if (!startedAt) {
        return
      }
      await reshapeCooldown(db, target, startedAt)
    },
  },

  CHRONOMANCY: {
    // Toute la tentative, ascension et rattrapage : Chronomancie ne porte pas
    // sur une question mais sur celles qu'ouvre la tentative où elle s'ancre.
    // Multiplicatif comme Répit, et pour la même raison : aucun empilement ne
    // ramène un timer à zéro, donc aucun plancher n'est nécessaire.
    // Voir specs/bonus.md#cumul.
    modulateRules: (rules, effects) => {
      const chronomancy = netOf(effects, 'CHRONOMANCY')
      return {
        ascentTimerMs: rules.ascentTimerMs * rules.chronomancyFactor ** chronomancy,
        recoveryTimerMs: rules.recoveryTimerMs * rules.chronomancyFactor ** chronomancy,
      }
    },
  },

  INDULGENCE: {
    // Indulgence n'est pas symétrique : sa face noire exige un perfect, elle ne
    // raccourcit pas le tirage. Seules les blanches comptent dans le nombre de
    // questions. Voir specs/bonus.md#cumul.
    //
    // Le seuil qui autorise le rattrapage ne bouge pas : `poolSizeForRecovery`
    // reste ce qu'il est, sinon le sort empêcherait le rattrapage qu'il est censé
    // rallonger. Le sort ne touche pas à ce champ — le fold le laisse à sa valeur
    // de base. Voir specs/bonus.md#catalogue.
    modulateRules: (rules, effects) => {
      const indulgence = boonsOf(effects, 'INDULGENCE')
      const perfectRequired = cursesOf(effects, 'INDULGENCE') > 0

      // Arrondi à l'entier : on tire des questions, pas des fractions. Le tirage
      // s'arrête de toute façon à ce que le pool contient.
      const recoveryQuestions = Math.round(rules.recoveryQuestions * rules.indulgenceFactor ** indulgence)

      // Le perfect exigé : autant de bonnes réponses que de questions tirées. Il
      // est booléen, donc idempotent — deux Indulgence noires valent une. Et il se
      // compose avec la blanche plutôt que de s'annuler : deux fois plus de
      // questions, toutes à réussir. Voir specs/bonus.md#cumul.
      return {
        recoveryQuestions,
        recoverySuccessesToResume: perfectRequired ? recoveryQuestions : rules.recoverySuccessesToResume,
      }
    },
  },

  PURGE: {
    // Purge ne module rien : elle mord le Pool Échecs à l'instant du lancer. Le
    // pool existe quelle que soit la phase de la cible, donc elle agit même sur
    // qui n'attend pas. Sa face décide de ce qu'elle y fait : la blanche en sort
    // une question, la noire remet à zéro le compteur de réussites de l'une
    // d'elles. Voir specs/bonus.md#catalogue.
    actInstantly: purgePool,
  },
}

/**
 * Les règles telles qu'un joueur les joue : celles de son étage, modulées par
 * les effets posés sur lui. Un effet ne remplace jamais une règle — il l'écarte
 * de ce que le jeu de règles dit, du facteur que ce même jeu de règles porte.
 * C'est ici que la lecture cesse de dépendre du seul étage.
 *
 * Le fold passe les règles de base à chaque sort, et chaque sort rend la part
 * qu'il module. Aucun sort ne lit la sortie d'un autre : ce que Vitalité fait
 * des vies ne dépend pas de ce que Répit fait de l'attente.
 *
 * Les deux faces se composent plutôt qu'elles ne s'annulent : deux blanches et
 * une noire valent une vie de plus, pas deux qui se neutralisent puis une.
 * Voir `specs/mecanique.md#ce-que-les-sorts-modifient` et `specs/bonus.md#cumul`.
 */
export function rulesWithEffects(rules: FloorRules, effects: SpellEffect[]): FloorRules {
  return SPELL_IDS.reduce<FloorRules>(
    (acc, id) => {
      const modulate = SPELLS[id]?.modulateRules
      return modulate ? { ...acc, ...modulate(rules, effects) } : acc
    },
    { ...rules },
  )
}

/**
 * Ce que Purge fait au Pool Échecs de l'étage courant, selon sa face.
 *
 * Blanche, une question tirée au hasard en sort sans avoir été rejouée — le seul
 * chemin du jeu pour ça. Elle en sort comme elle en sortirait par le seuil de
 * réussites : la ligne du pool part, le passage reste vu, la progression d'étage
 * ne bouge pas.
 *
 * Noire, la question reste et c'est son **compteur de réussites** qui retombe à
 * zéro : tout le rattrapage déjà fait sur elle est à refaire.
 *
 * Sur un pool vide il n'y a rien à mordre, et le sort est gaspillé — sans
 * erreur, et sans vérification préalable au lancer : on ne bloque pas le
 * ciblage. Voir `specs/bonus.md#catalogue`.
 */
async function purgePool(db: Database, target: User, face: SpellFace): Promise<void> {
  const onThisFloor = and(
    eq(missedPool.userId, target.id),
    eq(missedPool.floor, target.currentFloor),
  )

  // Tirage et coup en une seule instruction. En deux — lire puis écrire — deux
  // lanceurs simultanés pourraient désigner la même ligne et n'en toucher
  // qu'une, là où la spec en promet deux. Voir specs/bonus.md#cumul.
  const drawn = and(
    onThisFloor,
    eq(missedPool.questionId, sql`(select ${missedPool.questionId} from ${missedPool}
      where ${missedPool.userId} = ${target.id}
        and ${missedPool.floor} = ${target.currentFloor}
      order by RANDOM() limit 1)`),
  )

  if (face === 'curse') {
    await db.update(missedPool).set({ poolSuccesses: 0 }).where(drawn)
    return
  }

  await db.delete(missedPool).where(drawn)
}

/**
 * L'échéance de l'attente, refaite à partir de son début et de tout ce qui est
 * posé sur elle — jamais grignotée depuis ce qu'il en restait. Deux Répit
 * divisent donc la durée d'origine par quatre, dans l'ordre qu'on voudra.
 *
 * Ce que cette attente-ci dure, et non ce que le jeu de règles dit d'une
 * attente : celle qui suit un rattrapage entièrement manqué est plus courte, et
 * la recalculer sur les douze heures de l'autre la rallongerait.
 */
async function reshapeCooldown(db: Database, target: User, startedAt: Date): Promise<void> {
  const baseMs = target.cooldownBaseMs

  if (baseMs === null) {
    return
  }

  const onThisWait = await db
    .select({ spell: activeEffects.spell, face: activeEffects.face })
    .from(activeEffects)
    .where(and(
      eq(activeEffects.userId, target.id),
      eq(activeEffects.targetCooldownStartedAt, startedAt),
    ))

  // Le jeu de règles module la durée, on lui donne celle de cette attente-là.
  const rules = { ...rulesForFloor(target.currentFloor), cooldownMs: baseMs }
  const { cooldownMs } = rulesWithEffects(rules, onThisWait)

  await db
    .update(users)
    .set({ cooldownUntil: new Date(startedAt.getTime() + cooldownMs) })
    .where(eq(users.id, target.id))
}

/**
 * Combien d'exemplaires d'un sort, d'une face donnée, sont posés. La brique des
 * deux lectures qui suivent — un sort symétrique compte la différence, un sort
 * qui ne l'est pas compte une face à part. Voir `specs/bonus.md#cumul`.
 */
function facesOf(effects: SpellEffect[], spell: SpellId, face: SpellFace): number {
  return effects.filter(effect => effect.spell === spell && effect.face === face).length
}

/**
 * Ce qu'un empilement d'un même sort pèse : une face blanche compte pour un,
 * une noire pour moins un. Les deux faces se composent — elles ne s'annulent pas
 * d'office, c'est l'arithmétique du sort qui décide de ce que ça donne.
 * Voir `specs/bonus.md#cumul`.
 */
function netOf(effects: SpellEffect[], spell: SpellId): number {
  return facesOf(effects, spell, 'boon') - facesOf(effects, spell, 'curse')
}

/**
 * Les seules faces blanches d'un sort. Pour ceux dont les deux faces ne font pas
 * la même chose en sens inverse : compter une noire pour moins un leur ferait
 * produire un effet que la spec ne leur donne pas. Voir `specs/bonus.md#cumul`.
 */
function boonsOf(effects: SpellEffect[], spell: SpellId): number {
  return facesOf(effects, spell, 'boon')
}

/** Les seules faces noires d'un sort, pour la même raison que `boonsOf`. */
function cursesOf(effects: SpellEffect[], spell: SpellId): number {
  return facesOf(effects, spell, 'curse')
}
