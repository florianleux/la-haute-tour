/**
 * Les questions par page du Volumen, la même pour ses trois onglets : le serveur
 * découpe, l'écran en déduit le nombre de pages. Voir specs/ecrans.md#volumen.
 */
export const QUESTION_PAGE_SIZE = 20

/**
 * Les onglets du Volumen : le Pool Échecs de l'étage, les Sangsues, les questions
 * connues, toutes les vues. Voir specs/ecrans.md#volumen.
 */
export const QUESTION_LOG_TABS = ['missed', 'leeches', 'correct', 'all'] as const

export type QuestionLogTab = typeof QUESTION_LOG_TABS[number]
