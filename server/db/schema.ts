import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { ACHIEVEMENT_IDS } from '../../shared/utils/achievements'
import { FLOOR_COUNT } from '../../shared/utils/floors'
import { GENDERS } from '../../shared/utils/genders'
import { CHEST_STATES, SPELL_FACES, SPELL_IDS } from '../../shared/utils/spells'
import { TEAM_IDS } from '../../shared/utils/teams'
import type { AchievementId } from '../../shared/utils/achievements'

/**
 * Discord IDs allowed to sign up. Filled manually (admin UI or raw SQL).
 * No row here, no account created. See specs/anti-triche.md.
 */
export const whitelist = sqliteTable('whitelist', {
  discordId: text('discord_id').primaryKey(),
  /**
   * L'équipe que le joueur aura en arrivant. Choisie au moment où l'admin
   * autorise l'ID : c'est le seul instant où l'on sait pourquoi on l'invite, et
   * décider là évite d'avoir à y repenser à sa première connexion.
   *
   * Elle ne sert qu'une fois, à la création du compte. Ensuite c'est la fiche
   * joueur qui fait foi : rééditer la whitelist ne déplace personne, sinon elle
   * défarait en silence ce que l'admin a décidé après coup.
   * Voir specs/equipes.md.
   */
  team: text('team', { enum: TEAM_IDS }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * A player and their game state (current floor, lives). Game state lives in the
 * database, never in a client session. See specs/architecture.md.
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordId: text('discord_id').notNull().unique(),
  username: text('username').notNull(),
  email: text('email'),
  /**
   * Le hash d'avatar Discord, resynchronisé à chaque connexion. Null tant que le
   * joueur ne s'est pas reconnecté depuis l'ajout de la colonne, ou s'il n'a pas
   * d'avatar : l'affichage retombe alors sur l'avatar Discord par défaut.
   */
  avatar: text('avatar'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  /**
   * Un joueur créé par l'admin pour éprouver le jeu, sans compte Discord
   * derrière. Il joue une vraie partie — mêmes règles, mêmes tables — mais dans
   * un monde scellé : il n'apparaît ni dans les fiches joueurs, ni dans le
   * tirage des cibles d'un vrai lanceur. Voir specs/admin.md#joueurs-test.
   */
  isTest: integer('is_test', { mode: 'boolean' }).notNull().default(false),
  /**
   * L'équipe du joueur, assignée à la main par l'admin. Null tant qu'il n'en a
   * pas : l'appartenance est facultative, l'admin lui-même n'en a pas. Elle ne
   * sert qu'à dériver allié ou ennemi au moment d'un lancer — la relation, elle,
   * ne se stocke jamais. Voir specs/equipes.md.
   */
  team: text('team', { enum: TEAM_IDS }),
  /**
   * Ce que le joueur a répondu à L'Inconnu, à l'introduction. Null tant qu'il
   * n'a pas répondu. Rien ne le lit encore : il servira plus tard. Voir
   * specs/spec.md (glossaire, « Genre »).
   */
  gender: text('gender', { enum: GENDERS }),
  /**
   * Quand le joueur a fini l'introduction. Null tant qu'il ne l'a pas finie :
   * elle lui est alors rejouée à chaque connexion. Voir specs/spec.md
   * (glossaire, « Introduction »).
   */
  introDoneAt: integer('intro_done_at', { mode: 'timestamp' }),
  currentFloor: integer('current_floor').notNull().default(1),
  lives: integer('lives').notNull().default(3),
  /** When the cooldown ends. Null outside a cooldown. The phase derives from it. */
  cooldownUntil: integer('cooldown_until', { mode: 'timestamp' }),
  /**
   * Quand l'attente a commencé. Null hors attente.
   *
   * L'échéance ne suffit plus à la décrire depuis que Répit la déplace : c'est
   * de ce début-là qu'elle se recalcule à chaque lancer, pour que deux Répit
   * divisent la durée d'origine par quatre plutôt que de grignoter ce qu'il
   * reste. Il identifie aussi l'attente auprès des effets, là où l'échéance,
   * mouvante, ne le peut plus. Voir specs/bonus.md#catalogue.
   */
  cooldownStartedAt: integer('cooldown_started_at', { mode: 'timestamp' }),
  /**
   * Ce que cette attente-ci dure, avant qu'aucun Répit ne la touche. Null hors
   * attente.
   *
   * Portée et non relue dans le jeu de règles, parce qu'elles ne durent pas
   * toutes pareil : une dernière vie perdue en ouvre une de douze heures, un
   * rattrapage entièrement manqué une de quatre. Recalculer depuis la première
   * rallongerait la seconde au lieu de l'écourter.
   * Voir specs/mecanique.md#règles-chiffrées.
   */
  cooldownBaseMs: integer('cooldown_base_ms'),
  /**
   * Où le joueur en est du deck de son étage : le rang de la dernière question
   * qui lui a été servie. Remis à zéro en franchissant le palier.
   *
   * Porté par le joueur et non déduit de sa réservation : un rattrapage écrase
   * celle-ci avec une question du Pool Échecs, dont le rang n'a rien à voir avec
   * l'ascension. Voir specs/mecanique.md#ascension.
   */
  floorCursor: integer('floor_cursor').notNull().default(0),
  /**
   * Questions vues à l'étage courant, portées plutôt que comptées. Remis à zéro
   * en franchissant le palier.
   *
   * Le décompte se lisait par un `count(*)` sur les questions vues, à chaque
   * lecture d'état : la base facture les lignes lues, et un étage de mille
   * questions en coûtait jusqu'à mille pour en servir une. Ce nombre-là voyage
   * maintenant avec le joueur, et s'écrit dans le même lot que la question vue
   * qui le fait bouger. Voir specs/mecanique.md#ascension.
   */
  floorSeen: integer('floor_seen').notNull().default(0),
  /**
   * Questions vues depuis le début de la tentative en cours. Même raison d'être
   * que `floorSeen` : porté, jamais compté. Remis à zéro à l'ouverture d'une
   * tentative.
   */
  attemptSeen: integer('attempt_seen').notNull().default(0),
  /**
   * Début de la tentative en cours — repoussé chaque fois que les vies
   * reviennent. C'est lui qui dit quelles erreurs sont encore contestables.
   *
   * Défaut à l'époque zéro, et non à maintenant : SQLite refuse d'ajouter une
   * colonne NOT NULL dont le défaut n'est pas constant, donc la migration ne
   * s'appliquerait sur aucune base existante. Une tentative ouverte « depuis
   * toujours » dit la même chose pour un joueur qui commence — il n'a pas
   * d'erreur antérieure. Voir specs/validation.md#contestation.
   */
  attemptStartedAt: integer('attempt_started_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`0`),
  /**
   * Bonnes réponses d'affilée dans la tentative en cours, sans qu'aucune vie ait
   * été perdue. Remis à zéro par une erreur, par un Mimic, et par l'ouverture
   * d'une tentative.
   *
   * C'est aussi lui qui prouve l'étage sans faute : l'atteindre sur la taille de
   * l'étage au moment du palier ne peut arriver qu'en une seule traite, puisque
   * tout ce qui coupe l'étage le remet à zéro. Un second champ pour le dire
   * pourrait le contredire. Voir specs/succes.md#étage-sans-faute.
   */
  streak: integer('streak').notNull().default(0),
  /**
   * Questions vues depuis la dernière remise à zéro du joueur, tous étages et
   * toutes tentatives confondus. Ne redescend jamais d'ici là.
   *
   * Porté plutôt que compté, pour la raison qui vaut à `floorSeen`. Et il ne se
   * déduit pas des questions vues : celles-ci ne gardent qu'une ligne par
   * question, jusqu'à la remise à zéro.
   */
  seenTotal: integer('seen_total').notNull().default(0),
  /**
   * Le dernier jour où le joueur a résolu une question, en `YYYY-MM-DD` et au
   * fuseau Europe/Paris — celui que les écrans utilisent déjà, voir utils/date.ts.
   *
   * Une date en texte plutôt qu'un horodatage : ce qu'on compare est un jour, et
   * le stocker sous la forme où on le compare évite de rejouer le découpage à
   * chaque lecture. Voir specs/succes.md#assiduité.
   */
  lastPlayedDay: text('last_played_day'),
  /** Jours joués distincts. */
  daysPlayed: integer('days_played').notNull().default(0),
  /** Jours joués qui se suivent, le dernier compris. */
  playStreak: integer('play_streak').notNull().default(0),
  /**
   * Les succès déjà acquis, portés plutôt que relus.
   *
   * La table `achievements` reste la source : elle seule les date, et c'est
   * elle que la page Succès lit. Ceci en est le double, tenu par `unlock()`
   * dans le même lot que l'écriture qui le fait bouger.
   *
   * Il existe parce que les fonctions de décision rendent des **seuils
   * atteints** : elles redisent à chaque réponse tout ce qui est déjà gagné, et
   * il faut donc le retrancher avant d'écrire. Le retranchement se faisait sur
   * une lecture de la table, à chaque requête de jeu — une ligne par succès
   * acquis, facturée jusque sur les requêtes qui n'attribuent rien. Ce
   * palmarès-là voyage maintenant avec le joueur, dont la ligne est de toute
   * façon lue. Même raison d'être que `floorSeen` et `seenTotal`.
   * Voir server/utils/achievements.ts.
   *
   * Un tableau JSON et non un masque de bits : les identifiants se dérivent de
   * paliers, donc un palier inséré au milieu décalerait tout un masque
   * positionnel, en silence.
   */
  achievementsHeld: text('achievements_held', { mode: 'json' })
    .$type<AchievementId[]>()
    .notNull()
    // Constant, comme SQLite l'exige d'une colonne NOT NULL ajoutée à une table
    // qui porte déjà des lignes.
    .default(sql`'[]'`),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

/**
 * A question of the shared deck. `floor` says where the question sits, nothing
 * more: the import deals questions across the six floors at random, so the floors
 * are equivalent and no difficulty is carried anywhere. See specs/spec.md.
 *
 * `answerLabel` is what the player is shown on failure ("FLEMING (Alexander)");
 * it is never matched against. Matching goes through `acceptedAnswers`.
 */
export const questions = sqliteTable('questions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  statement: text('statement').notNull(),
  answerLabel: text('answer_label').notNull(),
  floor: integer('floor').notNull(),
  /**
   * La place de la question dans l'ordre de son étage, écrite une fois à
   * l'import. Le deck a un ordre, le même pour tous : servir la question
   * suivante est un saut dans l'index plutôt qu'un parcours de tout l'étage.
   * Voir specs/mecanique.md#ascension.
   */
  rank: integer('rank').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  check('questions_floor_range', sql`${table.floor} BETWEEN 1 AND ${sql.raw(String(FLOOR_COUNT))}`),
  // L'ordre du deck : c'est cet index qui rend le tirage constant, et l'unicité
  // qui garantit qu'aucun rang ne se dédouble sous les joueurs.
  unique('questions_floor_rank').on(table.floor, table.rank),
])

/**
 * Every wording that validates a question — none is privileged, the typo tolerance
 * applies to each. One row per answer so accepting a dispute is a single insert and
 * the admin CRUD can address one. See specs/validation.md.
 */
export const acceptedAnswers = sqliteTable('accepted_answers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
}, table => [index('accepted_answers_question_idx').on(table.questionId)])

/** Themes a question belongs to (Histoire, Musique, Sport…). Seeded by the import. */
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const questionCategories = sqliteTable('question_categories', {
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
}, table => [
  primaryKey({ columns: [table.questionId, table.categoryId] }),
  index('question_categories_category_idx').on(table.categoryId),
])

/**
 * A question resolved in ascent, right or wrong. The only unit of progress:
 * it is the count of seen questions that ends a floor and the game.
 */
export const seenQuestions = sqliteTable('seen_questions', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** The floor it was seen on — a floor's progress is read without joining. */
  floor: integer('floor').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  /**
   * Ce que le joueur avait répondu. Conservé au-delà de la réservation : c'est
   * la pièce que l'admin arbitre quand la question est contestée, et elle doit
   * survivre au passage à la question suivante.
   */
  submittedAnswer: text('submitted_answer'),
  seenAt: integer('seen_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('seen_questions_user_floor_idx').on(table.userId, table.floor),
  // Le Volumen lit les vues du joueur de la plus récente à la plus ancienne,
  // vingt à la fois. Couvrant : la page se choisit, et ses onglets se comptent
  // (Sues filtre sur `correct`), sans quitter l'index — Turso facture chaque
  // ligne lue, et une page sautée n'y coûte qu'une entrée.
  // Voir specs/ecrans.md#volumen et server/utils/game.ts (readQuestionLog).
  index('seen_questions_user_log_idx').on(table.userId, table.seenAt, table.questionId, table.correct),
])

/**
 * The question served to a player, held server-side until it resolves. At most
 * one per player — hence the primary key. Once resolved it carries the verdict,
 * which survives a refresh and a change of device, until the player moves on.
 * See specs/mecanique.md#réservation.
 */
export const reservations = sqliteTable('reservations', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** Which phase served it: the timer and what a failure costs differ. */
  mode: text('mode', { enum: ['ascent', 'recovery'] }).notNull().default('ascent'),
  /** Fixed when the question was reserved; the client's countdown only renders it. */
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  /** Verdict, null while the reservation is still live. */
  correct: integer('correct', { mode: 'boolean' }),
  submittedAnswer: text('submitted_answer'),
  /**
   * Le coffre de cette question loot : `closed` tant qu'il n'est pas ouvert,
   * puis `mimic` ou le sort trouvé. Null quand il n'y a pas de coffre — question
   * ordinaire, ou ratée.
   *
   * Gravé à la résolution, et non dérivé comme le statut loot dont il découle :
   * une contestation acceptée rend la question juste après coup, et le coffre,
   * lui, reste perdu. Le statut est attaché au passage, et le passage est fini.
   * Voir specs/bonus.md#contestation.
   */
  chest: text('chest', { enum: CHEST_STATES }),
})

/**
 * Questions missed on the current floor, waiting for recovery. Persistent: never
 * reset while the player stays on the floor. See specs/mecanique.md#pool-échecs.
 */
export const missedPool = sqliteTable('missed_pool', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  floor: integer('floor').notNull(),
  /** Consecutive recovery successes; a wrong answer puts it back to zero. */
  poolSuccesses: integer('pool_successes').notNull().default(0),
  lastFailedAt: integer('last_failed_at', { mode: 'timestamp' }).notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('missed_pool_user_floor_idx').on(table.userId, table.floor, table.lastFailedAt),
])

/**
 * The questions drawn for one recovery, in the order they are played. Rows exist
 * only while a recovery is under way: every question is played, and the run's
 * outcome — lives back, or a shorter cooldown — is settled when the last one is.
 * See specs/mecanique.md#déroulement-du-rattrapage.
 */
export const recoveryQuestions = sqliteTable('recovery_questions', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  /** Null until the question has been played. */
  correct: integer('correct', { mode: 'boolean' }),
}, table => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index('recovery_questions_user_position_idx').on(table.userId, table.position),
])

/**
 * Une contestation : le joueur affirme que sa réponse valait la bonne, l'admin
 * tranche. Une seule par question et par joueur — contester deux fois n'ajoute
 * rien à arbitrer. La réponse contestée n'est pas recopiée ici : elle vit dans
 * la question vue, qui ne change plus. Voir specs/validation.md#contestation.
 */
export const disputes = sqliteTable('disputes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  /** Quand l'admin a tranché. Null tant que la contestation attend. */
  settledAt: integer('settled_at', { mode: 'timestamp' }),
}, table => [
  unique('disputes_user_question_unique').on(table.userId, table.questionId),
  index('disputes_status_idx').on(table.status, table.createdAt),
])

/**
 * Une tentative achevée : de la reprise à vies pleines jusqu'à la suivante.
 * Écrite au moment où la tentative d'après s'ouvre — pas à la perte de la
 * dernière vie, qu'une contestation acceptée peut annuler.
 *
 * La longueur d'une tentative se compte en questions vues, l'unité de
 * progression du jeu, et non en heures : une soirée entrecoupée de pauses ne
 * vaut pas une longue ascension. Voir specs/ecrans.md#profil.
 */
export const attempts = sqliteTable('attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }).notNull(),
  /** Questions vues pendant la tentative — sa longueur. */
  seen: integer('seen').notNull(),
  /** L'étage où elle s'est achevée. */
  floor: integer('floor').notNull(),
}, table => [index('attempts_user_idx').on(table.userId, table.endedAt)])

/**
 * Une réponse soumise parce que le joueur a quitté la page pendant qu'un timer
 * tournait. Réservé à l'administration : le profil joueur n'en porte aucune
 * trace, et une question résolue ainsi n'est pas contestable.
 * Voir specs/anti-triche.md#perte-de-focus.
 */
export const focusLosses = sqliteTable('focus_losses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  /** La phase qui servait la question : l'ascension coûte une vie, le rattrapage non. */
  mode: text('mode', { enum: ['ascent', 'recovery'] }).notNull(),
  lostAt: integer('lost_at', { mode: 'timestamp' }).notNull(),
}, table => [index('focus_losses_user_idx').on(table.userId, table.lostAt)])

/**
 * Les sorts que le joueur possède et n'a pas encore lancés. Une ligne par
 * exemplaire : les doublons sont illimités, et un lancer en consomme un seul.
 * Voir specs/bonus.md#sorts.
 */
export const inventory = sqliteTable('inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  spell: text('spell', { enum: SPELL_IDS }).notNull(),
  obtainedAt: integer('obtained_at', { mode: 'timestamp' }).notNull(),
}, table => [index('inventory_user_idx').on(table.userId, table.obtainedAt)])

/**
 * Un sort lancé, et ce qu'il attend pour agir. Une ligne par lancer : le sort
 * est consommé de l'inventaire, et ce qu'il devient vit ici.
 *
 * `anchoredAt` porte tout le cycle de vie, sans second champ qui pourrait le
 * contredire. Null, l'effet attend la prochaine tentative de sa cible. Posé, il
 * vaut le `attemptStartedAt` de la tentative sur laquelle il s'est ancré : il
 * est actif tant que la cible joue celle-là, et mort dès qu'elle en ouvre une
 * autre — consommé ou non, sans qu'aucun ménage n'ait à passer.
 *
 * Le lanceur est gardé pour le journal nominatif, des deux côtés.
 * Voir specs/bonus.md#ancrage-et-durée-de-vie.
 */
export const activeEffects = sqliteTable('active_effects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /**
   * La cible : celle qui subit ou reçoit l'effet. Null quand le tirage n'a
   * désigné personne — le pool d'alliés était vide, le sort est parti et n'a
   * rien touché. La ligne reste : elle a coûté un exemplaire et un lancer, et le
   * journal doit pouvoir le dire. Voir specs/bonus.md#tirage-de-la-cible.
   */
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  casterId: integer('caster_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  spell: text('spell', { enum: SPELL_IDS }).notNull(),
  /** Magie blanche sur soi ou un allié, noire sur un ennemi. */
  face: text('face', { enum: SPELL_FACES }).notNull(),
  castAt: integer('cast_at', { mode: 'timestamp' }).notNull(),
  /**
   * L'attente pendant laquelle le sort est parti, désignée par son **début** —
   * un sort ne se lance que là, donc elle existe toujours. Elle comptait le
   * budget de lancers d'une attente, retiré depuis (docs/adr/0011) ; elle reste
   * pour dire dans quelle attente un sort est parti.
   *
   * Son début et non son échéance : Répit déplace l'échéance, qui ne peut donc
   * pas désigner une attente. Le début, lui, ne bouge pas.
   */
  castCooldownStartedAt: integer('cast_cooldown_started_at', { mode: 'timestamp' })
    .notNull()
    // Même raison qu'`attemptStartedAt` : SQLite refuse une colonne NOT NULL
    // dont le défaut n'est pas constant, donc la migration ne s'appliquerait sur
    // aucune base existante. Le remplissage suit, dans la même migration.
    .default(sql`0`),
  /**
   * L'attente **de la cible** sur laquelle un sort lié à l'attente agit, par son
   * début. Null quand elle n'en vivait pas — ou qu'il n'y avait pas de cible.
   *
   * Distincte de `castCooldownStartedAt` depuis qu'on lance sur un allié : le
   * lanceur est toujours en attente, la cible ne l'est pas forcément, et ce ne
   * sont plus les mêmes. L'une date le lancer, l'autre borne la vie de l'effet
   * chez la cible. Voir specs/bonus.md#ancrage-et-durée-de-vie.
   */
  targetCooldownStartedAt: integer('target_cooldown_started_at', { mode: 'timestamp' }),
  /** La tentative sur laquelle l'effet s'est ancré. Null tant qu'il attend. */
  anchoredAt: integer('anchored_at', { mode: 'timestamp' }),
}, table => [
  index('active_effects_user_idx').on(table.userId, table.anchoredAt),
  index('active_effects_caster_idx').on(table.casterId, table.castAt),
  // ponytail: index du budget de lancers, retiré (docs/adr/0011) ; plus rien ne
  // le lit. À supprimer à la prochaine migration, pas de migration pour lui seul.
  index('active_effects_caster_cooldown_idx')
    .on(table.casterId, table.castCooldownStartedAt),
])

/**
 * Les réglages du jeu, en une seule ligne — d'où la clé figée à 1. Il n'y en a
 * qu'un pour l'instant, la maintenance ; une table plutôt qu'une variable
 * d'environnement parce que l'admin l'actionne en cours de route, sans redéployer.
 * Voir specs/admin.md#maintenance.
 */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  /**
   * Depuis quand le jeu est fermé aux joueurs. Null quand il est ouvert : une date
   * plutôt qu'un booléen, pour que l'administration sache aussi depuis combien de
   * temps elle a fermé.
   */
  maintenanceSince: integer('maintenance_since', { mode: 'timestamp' }),
  /**
   * Le premier joueur à avoir franchi l'étage 1, pour tout le jeu. Réclamé une
   * seule fois, par une écriture qui ne passe que tant que la colonne est nulle :
   * personne ne le reprend ensuite, et aucun classement n'a eu à exister pour le
   * désigner. Ni les joueurs test ni l'admin ne peuvent le réclamer.
   * Voir specs/succes.md#premier-sur-le-serveur.
   */
  firstAscensionUserId: integer('first_ascension_user_id').references(() => users.id, { onDelete: 'set null' }),
}, table => [check('settings_single_row', sql`${table.id} = 1`)])

/**
 * Les succès débloqués, un par ligne, acquis à vie. La clé composite dit tout :
 * un succès ne se débloque qu'une fois, et l'insert n'a donc qu'à ignorer les
 * conflits pour être idempotent — ce qu'il rend alors est exactement ce qui vient
 * d'être gagné. Voir specs/succes.md.
 */
export const achievements = sqliteTable('achievements', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  achievement: text('achievement', { enum: ACHIEVEMENT_IDS }).notNull(),
  unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull(),
}, table => [primaryKey({ columns: [table.userId, table.achievement] })])

/**
 * Ce que chaque étage contient. Une propriété du deck, partagée par tous les
 * joueurs et changée seulement quand l'administration l'édite — donc écrite une
 * fois là, et lue en une ligne partout ailleurs.
 *
 * Elle se comptait à chaque lecture d'état. Un `count(*)` parcourt l'index de
 * l'étage entier : mille lignes facturées pour apprendre un nombre qui ne bouge
 * pas. Un cache mémoire ne sauvait rien — en serverless, chaque invocation
 * froide repart d'un process neuf. Voir server/utils/deck.ts.
 */
export const deckFloors = sqliteTable('deck_floors', {
  floor: integer('floor').primaryKey(),
  total: integer('total').notNull().default(0),
})

export type User = typeof users.$inferSelect
export type Whitelist = typeof whitelist.$inferSelect
export type Question = typeof questions.$inferSelect
export type AcceptedAnswer = typeof acceptedAnswers.$inferSelect
export type Category = typeof categories.$inferSelect
export type SeenQuestion = typeof seenQuestions.$inferSelect
export type Reservation = typeof reservations.$inferSelect
export type MissedPoolEntry = typeof missedPool.$inferSelect
export type RecoveryQuestion = typeof recoveryQuestions.$inferSelect
export type Dispute = typeof disputes.$inferSelect
export type Attempt = typeof attempts.$inferSelect
export type FocusLoss = typeof focusLosses.$inferSelect
export type InventoryEntry = typeof inventory.$inferSelect
export type ActiveEffect = typeof activeEffects.$inferSelect
export type Settings = typeof settings.$inferSelect
export type Achievement = typeof achievements.$inferSelect
