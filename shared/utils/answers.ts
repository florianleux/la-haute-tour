/** Articles dropped before matching: they carry no answer. */
const ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'l', 'd'])

/**
 * What two answers are compared as: trimmed, lowercased, unaccented, stripped of
 * punctuation and articles. See specs/validation.md.
 */
export function normalizeAnswer(answer: string): string {
  return answer
    .normalize('NFD')
    // Combining marks left by NFD — this is what drops the accents.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0 && !ARTICLES.has(word))
    .join(' ')
}

/** Un chiffre romain bien formé : I, IV, IX, XIV, LXXVI… */
const ROMAN = /^(?=[ivxlcdm])m*(c[md]|d?c{0,3})(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/

/**
 * Le son d'un mot, réduit à un code. Deux orthographes qui se prononcent pareil
 * rendent le même code — c'est tout ce que la comparaison regarde ensuite.
 *
 * Les symboles ne valent que par leur unicité : `C` pour le son ch, `J` pour le j,
 * `N` pour gn, `W` pour oi, et `@` `1` `O` pour les trois nasales. Aucun n'est une
 * lettre du mot d'origine, donc aucun ne peut se confondre avec elle.
 */
function phoneticCode(word: string): string {
  // Un chiffre romain est une valeur, pas une orthographe : Louis IX et Louis II
  // ne se prononcent pas pareil et ne doivent jamais se confondre. Gardé tel quel,
  // marqué pour qu'aucun mot ne puisse produire le même code.
  if (ROMAN.test(word)) {
    return `#${word}`
  }

  let code = word

  // Consonne finale muette, tant qu'elle est encore reconnaissable : après le
  // passage de `x` à `ks`, le x final de « Bordeaux » ne se verrait plus.
  code = code.replace(/x$/, '')

  // Les doubles se replient avant tout le reste. « Vanessa » écrit « Vanesa » est
  // la faute la plus courante du français ; la replier ici la fait passer, au prix
  // de confondre « poisson » et « poison » — un mot commun, là où le deck répond
  // surtout des noms propres.
  code = code.replace(/(.)\1+/g, '$1')

  // Digrammes d'abord : ils décident du son avant que les lettres qui les
  // composent ne soient traitées séparément.
  code = code.replace(/ph/g, 'f')
  code = code.replace(/tch/g, 'C')
  code = code.replace(/s?ch/g, 'C')
  code = code.replace(/sh/g, 'C')
  // Le s ou le z qui précède un ch se fond dedans : « Nietzsche » = « Nietsche ».
  code = code.replace(/[sz]C/g, 'C')
  code = code.replace(/gn/g, 'N')
  code = code.replace(/th/g, 't')
  code = code.replace(/h/g, '')

  // g et c, durs ou doux selon la voyelle qui suit.
  code = code.replace(/gu([eiy])/g, 'g$1')
  code = code.replace(/g([eiy])/g, 'J$1')
  code = code.replace(/ge([aou])/g, 'J$1')
  code = code.replace(/j/g, 'J')
  code = code.replace(/c([eiy])/g, 's$1')
  code = code.replace(/qu/g, 'k')
  code = code.replace(/q/g, 'k')
  code = code.replace(/c/g, 'k')
  code = code.replace(/x/g, 'ks')

  // Le s entre deux voyelles se prononce z : c'est ce qui fait tenir
  // « Sarkosy » et « Sarkozy ».
  code = code.replace(/([aeiouy])s([aeiouy])/g, '$1z$2')

  // Voyelles composées. L'ordre compte : `eau` avant `au`, sinon « eau » sortirait
  // par la seconde règle en laissant un e devant.
  code = code.replace(/eau/g, 'o')
  code = code.replace(/au/g, 'o')
  code = code.replace(/ou/g, 'u')
  code = code.replace(/o[iy]/g, 'W')
  code = code.replace(/e[iy]/g, 'e')
  code = code.replace(/ai/g, 'e')

  // Nasales, seulement quand rien ne suit qui rouvrirait la syllabe : « Monet »
  // nasalise, « Monet » suivi d'une voyelle — « monnaie » — non.
  code = code.replace(/([aeiouy])[nm](?![aeiouynm])/g, (_, vowel: string) => {
    if (vowel === 'a' || vowel === 'e') return '@'
    if (vowel === 'i' || vowel === 'y' || vowel === 'u') return '1'
    return 'O'
  })

  // Finales muettes, en boucle : « escargots » perd son s, puis son t.
  let previous: string
  do {
    previous = code
    code = code.replace(/(?:ent|es|s|t|d|p|z|x|g)$/, '')
  } while (code !== previous && code.length > 1)
  code = code.replace(/e$/, '')

  code = code.replace(/y/g, 'i')
  code = code.replace(/(.)\1+/g, '$1')

  // Un mot entièrement muet ne doit pas devenir la chaîne vide, qui vaudrait
  // n'importe quel autre mot muet.
  return code || word
}

/**
 * Les lectures possibles d'une réponse. Une seule en général ; deux quand un `ch`
 * traîne, parce qu'il se dit /ʃ/ dans « Michel » et /k/ dans « orchestre ». Les
 * deux lectures valent, il suffit qu'une coïncide.
 *
 * Appliqué à la réponse entière plutôt que mot à mot : deux lectures au total,
 * là où un choix par mot en produirait deux puissance le nombre de mots.
 */
export function phoneticKeys(normalized: string): string[] {
  const spellings = /ch/.test(normalized)
    ? [normalized, normalized.replace(/ch/g, 'k')]
    : [normalized]

  return [...new Set(spellings.map(spelling =>
    spelling.split(' ').filter(Boolean).map(phoneticCode).join(' '),
  ))]
}

/**
 * Les chiffres d'une réponse, dans l'ordre. Comparés à l'identique, jamais à
 * l'oreille : se tromper d'un chiffre dans une année, ce n'est pas mal l'écrire,
 * c'est répondre autre chose.
 */
function digitsOf(normalized: string): string {
  return (normalized.match(/[0-9]/g) ?? []).join('')
}

/** Edit distance, two rows at a time — the strings here are short. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }

    previous = current
  }

  return previous[b.length]!
}

/** Un mot qui porte une valeur — un chiffre, un chiffre romain — n'a droit à aucun jeu. */
function carriesValue(codes: string[]): boolean {
  return codes.some(code => code.startsWith('#') || /[0-9]/.test(code))
}

function soundsLike(a: string, b: string): boolean {
  const heard = new Set(phoneticKeys(a))
  return phoneticKeys(b).some(key => heard.has(key))
}

/**
 * Le cas du prénom : « Alexandre Fleming » pour « Alexander Fleming ».
 *
 * Un tiers du deck répond un nom de personne, et le nom de famille suffit déjà à
 * valider. Quand le joueur donne le prénom en plus, il en dit plus, pas moins —
 * mais il l'écrit à la française, ou en initiale, et la comparaison mot à mot le
 * refuse. Ce serait punir d'avoir voulu être précis.
 *
 * Donc : sur une réponse d'au moins deux mots, **un seul** mot peut être à un son
 * près, les autres devant s'entendre exactement. Le nom de famille ancre la
 * réponse, le prénom a le jeu. Une réponse d'un seul mot n'en a aucun — « Rose »
 * ne vaudra jamais « Rome » — et un mot qui porte une valeur non plus, sinon
 * « Charles II » vaudrait « Charles III ».
 *
 * Ce qui reste refusé, et doit l'être : un prénom simplement faux. « Ian Fleming »
 * n'est pas « Alexander Fleming », c'est quelqu'un d'autre.
 */
function withinOneWord(candidate: string, expected: string): boolean {
  const got = candidate.split(' ').filter(Boolean)
  const want = expected.split(' ').filter(Boolean)

  if (got.length < 2 || got.length !== want.length) {
    return false
  }

  let loose = 0

  for (const [index, word] of got.entries()) {
    const other = want[index]!
    if (soundsLike(word, other)) {
      continue
    }

    // Une initiale vaut le mot qu'elle ouvre : « A. Fleming », « I. Fleming ».
    // Testé avant la valeur, parce que sept initiales courantes — C, D, I, L, M,
    // V, X — sont aussi des chiffres romains valides. En face d'un vrai chiffre
    // romain, en revanche, une lettre seule n'est pas une initiale : « Louis I »
    // ne doit pas valoir « Louis II ».
    if ((word.length === 1 && !ROMAN.test(other) && other.startsWith(word))
      || (other.length === 1 && !ROMAN.test(word) && word.startsWith(other))) {
      continue
    }

    const codes = [...phoneticKeys(word), ...phoneticKeys(other)]
    if (carriesValue(codes)) {
      return false
    }

    if (editDistance(phoneticKeys(word)[0]!, phoneticKeys(other)[0]!) > 1) {
      return false
    }

    loose += 1
    if (loose > 1) {
      return false
    }
  }

  return true
}

/**
 * True when the answer matches one of the accepted answers. No accepted answer is
 * privileged: each is compared the same way.
 *
 * La comparaison se fait à l'oreille, pas à la lettre : ce que le joueur sait,
 * c'est une réponse, et l'orthographe d'un nom propre n'en fait pas partie. Les
 * chiffres échappent à cette indulgence — ils portent la réponse eux-mêmes.
 *
 * An empty answer is always wrong — otherwise a short accepted answer would sit
 * within earshot of saying nothing at all.
 */
export function isAnswerAccepted(answer: string, acceptedAnswers: string[]): boolean {
  const candidate = normalizeAnswer(answer)
  if (!candidate) {
    return false
  }

  const figures = digitsOf(candidate)

  return acceptedAnswers.some((accepted) => {
    const expected = normalizeAnswer(accepted)
    if (digitsOf(expected) !== figures) {
      return false
    }

    return soundsLike(candidate, expected) || withinOneWord(candidate, expected)
  })
}
