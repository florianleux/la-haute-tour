import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { activeEffects, deckFloors, reservations, users } from '../db/schema'
import { countsTowardMaxBoons, drawByRank, hasStarted, isBorneBy, phaseOf } from './mechanics'
import { rulesForFloor } from './rules'
import { faceFor, SPELL_FACES } from '../../shared/utils/spells'
import { bondBetween } from '../../shared/utils/teams'
import type { Database } from '../db/client'
import type { User } from '../db/schema'
import type { SpellFace } from '../../shared/utils/spells'
import type { DrawnTargetKind, TargetKind } from '../../shared/utils/teams'

/**
 * Qui le sort touche, faute d'avoir été choisi. Le lanceur désigne une catégorie
 * et le serveur tire dedans : aléatoire, mais pondéré, et jamais annoncé avant
 * le lancer. Voir specs/bonus.md#tirage-de-la-cible.
 *
 * Personne, quand le pool éligible est vide : le sort part quand même et ne fait
 * rien, comme une Purge sur un Pool Échecs vide.
 *
 * Le hasard vient de l'appelant, comme pour le coffre — c'est ce qui rend le
 * tirage jouable dans un test sans dé.
 */
export async function drawTarget(
  db: Database,
  caster: User,
  kind: DrawnTargetKind,
  now: Date,
  random: () => number = Math.random,
): Promise<User | null> {
  // Sans équipe, le lanceur ne désigne aucun pool : ni allié ni ennemi n'existe
  // pour lui. Voir specs/equipes.md#le-joueur-sans-équipe.
  if (caster.team === null) {
    return null
  }

  const rows = await candidatesQuery(db, caster, kind)

  // Le filtre des saturés passe **avant** le classement : un joueur retiré du
  // pool n'y occupe plus de rang, donc ne pèse plus dans la distribution. Un
  // ennemi sature de magies noires, un allié de magies blanches.
  // Voir specs/bonus.md#limite-deffets-négatifs et
  // specs/bonus.md#limite-deffets-positifs.
  const eligible = await unsaturated(db, reachable(rows, caster, kind, now), faceFor(kind))

  return drawByRank(eligible, kind, random)
}

/**
 * Ceux que le lanceur peut atteindre, avec de quoi savoir s'ils jouent encore,
 * classés par progression. Une catégorie réduit la lecture à sa seule équipe ;
 * sans catégorie, les deux équipes viennent ensemble, pour le Grimoire qui
 * demande les deux. Rendue plutôt qu'exécutée : le Grimoire la fait voyager
 * dans le lot de ses autres lectures. Voir tests/server/query-budget.test.ts.
 */
export function candidatesQuery(db: Database, caster: User, kind?: DrawnTargetKind): CandidatesQuery {
  return buildCandidatesQuery(db, caster, kind)
}

type CandidatesQuery = ReturnType<typeof buildCandidatesQuery>

function buildCandidatesQuery(db: Database, caster: User, kind?: DrawnTargetKind) {
  return db
    .select({
      user: users,
      // Ce que l'étage du candidat contient, pour savoir s'il a fini sa partie.
      // Lu au deck en une ligne jointe, comme les fiches de l'administration.
      floorTotal: deckFloors.total,
      // La question qu'il tient peut-être. Jointe plutôt que comptée : un joueur
      // n'a jamais qu'une réservation, et elle porte son identifiant en clé —
      // la jointure lit donc une ligne, là où un `count(*)` en parcourrait.
      heldQuestion: reservations.questionId,
    })
    .from(users)
    .leftJoin(deckFloors, eq(deckFloors.floor, users.currentFloor))
    .leftJoin(reservations, and(
      eq(reservations.userId, users.id),
      isNull(reservations.resolvedAt),
    ))
    // Le pool se réduit en base à la seule équipe concernée, et au seul monde du
    // lanceur : la facture est aux lignes lues, et lire la table entière pour la
    // filtrer ensuite en mémoire les paierait toutes. Sans équipe, le lanceur
    // n'atteint personne : aucune ligne.
    .where(and(
      ne(users.id, caster.id),
      caster.team === null
        ? sql`false`
        : kind === 'ally'
          ? eq(users.team, caster.team)
          : kind === 'foe' ? ne(users.team, caster.team) : isNotNull(users.team),
      eq(users.isTest, caster.isTest),
    ))
    // Le classement de progression, croissant : étage, puis questions vues à
    // l'étage, puis ancienneté du compte pour que l'ordre soit total et stable.
    // Il ne sort jamais du serveur — il pondère, il ne se montre pas.
    // Voir specs/ecrans.md#ce-quaucun-écran-joueur-ne-montre.
    .orderBy(asc(users.currentFloor), asc(users.floorSeen), asc(users.createdAt), asc(users.id))
}

/** Les candidats d'une catégorie qui jouent encore, dans l'ordre du classement. */
function reachable(rows: Candidate[], caster: User, kind: DrawnTargetKind, now: Date): User[] {
  return rows
    // La relation se lit d'un seul endroit, jamais réécrite ici : c'est elle qui
    // scelle les deux mondes autant qu'elle dit la couleur.
    .filter(row => bondBetween(caster, row.user) === kind)
    .filter(row => isEligible(row, now))
    .map(row => row.user)
}

/**
 * Quelles catégories ont encore quelqu'un à toucher : soi, s'il n'est pas
 * saturé de magies blanches ; un allié ou un ennemi, si leur pool éligible
 * n'est pas vide. Lu par le Grimoire, qui éteint les autres avant le clic.
 * Les candidats viennent de `candidatesQuery` sans catégorie ; les saturés des
 * deux faces s'écartent en une seule lecture.
 * Voir specs/bonus.md#tirage-de-la-cible.
 */
export async function targetableKinds(db: Database, caster: User, rows: Candidate[], now: Date): Promise<Record<TargetKind, boolean>> {
  const open = await unsaturatedPools(db, {
    boon: [caster, ...reachable(rows, caster, 'ally', now)],
    curse: reachable(rows, caster, 'foe', now),
  })

  return {
    self: open.boon.includes(caster),
    ally: open.boon.some(user => user !== caster),
    foe: open.curse.length > 0,
  }
}

/**
 * Le joueur peut-il encore se lancer un sort ? Sur soi, la face est toujours
 * blanche : faux quand il porte déjà son plafond d'effets positifs. Lu par le
 * lancer, qui refuse alors sans consommer, et par le Grimoire, qui éteint
 * « Sur moi ». Voir specs/bonus.md#limite-deffets-positifs.
 */
export async function canTargetSelf(db: Database, user: User): Promise<boolean> {
  return (await unsaturated(db, [user], 'boon')).length > 0
}

/**
 * Ceux qui ne sont pas encore **saturés** pour cette face : un joueur ne porte
 * jamais plus de `maxCurses` effets négatifs, ni plus de `maxBoons` positifs, à
 * la fois. Au-delà il sort du tirage, silencieusement : le lanceur n'apprend
 * jamais qui est saturé — seulement, quand tout un pool l'est, que la
 * catégorie n'a plus personne à toucher.
 *
 * Conséquence assumée : qui ne meurt pas ne consomme pas ses effets, occupe ses
 * places et s'en trouve protégé — ou privé de nouvelles magies blanches.
 * Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
async function unsaturated(db: Database, candidates: User[], face: SpellFace): Promise<User[]> {
  return (await unsaturatedPools(db, { [face]: candidates }))[face]
}

/**
 * `unsaturated` pour plusieurs faces à la fois — chacune ses candidats —, en
 * une seule lecture des effets portés : le Grimoire demande les deux.
 */
async function unsaturatedPools(db: Database, pools: Partial<Record<SpellFace, User[]>>): Promise<Record<SpellFace, User[]>> {
  const faces = SPELL_FACES.filter(face => pools[face]?.length)

  if (!faces.length) {
    return { boon: [], curse: [] }
  }

  // Ce `where` ne tranche pas, il allège la facture : il écarte les
  // effets morts — ancrés sur une tentative révolue — pour ne pas payer
  // des lignes qu'on jetterait ensuite. C'est `isBorneBy` qui décide, plus bas.
  //
  // L'invariant qui les lie : ce filtre doit rester **plus large** que le
  // prédicat. Élargir ce qu'un joueur porte se fait donc là-bas seul ; le
  // resserrer ici ferait disparaître des lignes que le prédicat aurait gardées.
  const carried = await db
    .select({
      userId: activeEffects.userId,
      face: activeEffects.face,
      spell: activeEffects.spell,
      anchoredAt: activeEffects.anchoredAt,
      targetCooldownStartedAt: activeEffects.targetCooldownStartedAt,
    })
    .from(activeEffects)
    .innerJoin(users, eq(users.id, activeEffects.userId))
    .where(and(
      inArray(activeEffects.userId, faces.flatMap(face => pools[face]!.map(candidate => candidate.id))),
      inArray(activeEffects.face, faces),
      or(
        isNull(activeEffects.anchoredAt),
        eq(activeEffects.anchoredAt, users.attemptStartedAt),
      ),
    ))

  function open(face: SpellFace): User[] {
    // Les deux faces ne se comptent pas pareil : une malédiction ancrée occupe
    // sa place jusqu'à la tentative suivante, une magie blanche ancrée la rend.
    // Voir server/utils/mechanics.ts.
    const counts = face === 'curse' ? isBorneBy : countsTowardMaxBoons

    return (pools[face] ?? []).filter((candidate) => {
      const borne = carried.filter(row =>
        row.userId === candidate.id && row.face === face && counts(row, candidate),
      )

      // Le plafond est celui de la cible : c'est elle qui porte, pas le lanceur.
      const rules = rulesForFloor(candidate.currentFloor)
      return borne.length < (face === 'curse' ? rules.maxCurses : rules.maxBoons)
    })
  }

  return { boon: open('boon'), curse: open('curse') }
}

type Candidate = { user: User, floorTotal: number | null, heldQuestion: string | null }

/**
 * Un joueur que le tirage garde. Sont écartés ceux qui ont fini leur partie —
 * ils n'auront jamais de prochaine tentative, l'effet serait mort-né — et ceux
 * qui n'ont jamais commencé.
 *
 * Le filtre passe **avant** le classement : un joueur retiré du pool ne pèse
 * plus dans la distribution. Voir specs/bonus.md#tirage-de-la-cible.
 */
function isEligible({ user, floorTotal, heldQuestion }: Candidate, now: Date): boolean {
  const hasLiveReservation = heldQuestion !== null

  const phase = phaseOf({
    user,
    hasLiveReservation,
    seen: user.floorSeen,
    floorTotal: floorTotal ?? 0,
  }, now)

  return phase !== 'gameOver' && hasStarted(user, hasLiveReservation)
}
