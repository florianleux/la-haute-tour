/** Articles dropped before matching: they carry no answer. */
const ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'l', 'd'])

const MAX_EDITS = 2

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

/** Edit distance, two rows at a time — the strings here are short. */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)

  for (let i = 1; i <= a.length; i++) {
    const current = [i]

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }

    previous = current
  }

  return previous[b.length]
}

/**
 * True when the answer matches one of the accepted answers, typos allowed. No
 * accepted answer is privileged: the tolerance applies to each.
 *
 * An empty answer is always wrong — otherwise a short accepted answer would sit
 * within two edits of saying nothing at all.
 */
export function isAnswerAccepted(answer: string, acceptedAnswers: string[]): boolean {
  const candidate = normalizeAnswer(answer)
  if (!candidate) {
    return false
  }

  return acceptedAnswers.some(
    accepted => editDistance(candidate, normalizeAnswer(accepted)) <= MAX_EDITS,
  )
}
