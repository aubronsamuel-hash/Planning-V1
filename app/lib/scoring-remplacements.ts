// ─────────────────────────────────────────────────────────
// lib/scoring-remplacements.ts
// Algorithme de scoring des candidats remplaçants
// doc/10-remplacements-urgents.md §10.2
//
// Points :
//   +4  A déjà travaillé sur CE projet
//   +3  A travaillé sur un projet du même type (si pas sur ce projet)
//   +2  A déjà tenu CE poste (même nom)
//   +1  Type de contrat compatible (INTERMITTENT préféré)
//   -10 Conflit horaire sur cette date (éliminatoire)
//   -5  N'a jamais répondu à des demandes (peu fiable)
// ─────────────────────────────────────────────────────────

export type AffectationHistorique = {
  confirmationStatus: string
  confirmedAt?: Date | null
  createdAt: Date
  representation: {
    date: Date
    projet: { id: string; type: string }
  }
  posteRequis: { name: string }
  startTime: string
  endTime: string
}

export type ContexteRemplacement = {
  projetId: string
  projetType: string
  projetTitle: string
  posteNom: string
  repDate: Date
  startTime: string
  endTime: string
  contractTypePreference: string
}

export type ResultatScore = {
  score: number
  raisons: string[]
  aConflit: boolean
  disponible: boolean
  tempsReponse: string | null
}

/**
 * Calcule le score de pertinence d'un candidat remplaçant.
 *
 * @param affectations - Historique des affectations du candidat
 * @param contexte     - Contexte de la représentation à remplacer
 * @returns score, raisons, disponibilité et temps de réponse moyen
 */
export function scorerCandidat(
  affectations: AffectationHistorique[],
  contexte: ContexteRemplacement
): ResultatScore {
  const { projetId, projetType, projetTitle, posteNom, repDate, startTime, endTime, contractTypePreference } = contexte

  let score = 0
  const raisons: string[] = []

  // Exclure les affectations annulées de l'analyse métier
  const affectationsActives = affectations.filter(
    (a) => a.confirmationStatus !== 'ANNULEE' && a.confirmationStatus !== 'ANNULEE_TARDIVE'
  )

  // +4 pts — A déjà travaillé sur CE projet
  const surCeProjet = affectationsActives.some(
    (a) => a.representation.projet.id === projetId
  )
  if (surCeProjet) {
    score += 4
    raisons.push(`A déjà travaillé sur ${projetTitle}`)
  }

  // +3 pts — A travaillé sur un projet du même type (seulement si pas sur CE projet)
  if (!surCeProjet) {
    const memeType = affectationsActives.some(
      (a) => a.representation.projet.type === projetType
    )
    if (memeType) {
      score += 3
      raisons.push(`Expérience en ${projetType.toLowerCase()}`)
    }
  }

  // +2 pts — A déjà tenu CE poste (même nom, insensible à la casse)
  const memePoste = affectationsActives.some(
    (a) => a.posteRequis.name.toLowerCase() === posteNom.toLowerCase()
  )
  if (memePoste) {
    score += 2
    raisons.push(`Poste ${posteNom} déjà tenu`)
  }

  // +1 pt — Type de contrat compatible (INTERMITTENT préféré ou poste indifférent)
  // NOTE : le contractType est passé via contractTypePreference du contexte et le type du collaborateur
  //        ce bonus est calculé côté appelant (dépend du collaborateur.contractType)

  // -10 pts — Conflit horaire sur cette date (éliminatoire)
  const conflit = affectationsActives.some((a) => {
    const sameDay =
      new Date(a.representation.date).toDateString() ===
      new Date(repDate).toDateString()
    if (!sameDay) return false
    // Chevauchement simplifié HH:MM (même logique que la route)
    return a.startTime < endTime && a.endTime > startTime
  })
  if (conflit) {
    score -= 10
    raisons.push('Conflit horaire sur cette date')
  }

  // -5 pts — N'a jamais répondu (aucune affectation confirmée ou refusée) mais en a eu
  const aRepondu = affectationsActives.some(
    (a) => a.confirmationStatus === 'CONFIRMEE' || a.confirmationStatus === 'REFUSEE'
  )
  if (!aRepondu && affectationsActives.length > 0) {
    score -= 5
    raisons.push('Peu fiable (jamais répondu)')
  }

  // Calcul du temps de réponse moyen (indicatif)
  const reponses = affectations.filter((a) => a.confirmedAt && a.createdAt)
  let tempsReponse: string | null = null
  if (reponses.length > 0) {
    const moyMs =
      reponses.reduce((acc, a) => {
        return acc + (a.confirmedAt!.getTime() - a.createdAt.getTime())
      }, 0) / reponses.length
    const moyH = Math.round(moyMs / (1000 * 60 * 60))
    tempsReponse = moyH < 2 ? '< 2h' : moyH < 24 ? `~${moyH}h` : '> 24h'
  }

  return {
    score,
    raisons,
    aConflit: conflit,
    disponible: !conflit,
    tempsReponse,
  }
}

/**
 * Bonus de contrat : +1 si INTERMITTENT ou poste indifférent.
 * Séparé car dépend du collaborateur.contractType, pas de l'historique.
 */
export function bonusContrat(
  contractType: string,
  contractTypePreference: string
): number {
  if (contractType === 'INTERMITTENT' || contractTypePreference === 'INDIFFERENT') {
    return 1
  }
  return 0
}
