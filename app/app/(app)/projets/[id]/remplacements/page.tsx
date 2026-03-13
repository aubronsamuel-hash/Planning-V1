'use client'
// ─────────────────────────────────────────────────────────
// Page /projets/[id]/remplacements
// Dashboard des remplacements urgents d'un projet
// doc/10-remplacements-urgents.md §10.4
// Accessible : Régisseur, Chef de poste
// ─────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────

type CollabInfo = {
  prenom: string
  nom: string
  avatarUrl: string | null
}

type PropositionActive = {
  id: string
  candidat: { id: string; prenom: string; nom: string; avatarUrl: string | null }
  expiresAt: string
  proposedAt: string
}

type Remplacement = {
  affectationId: string
  collaborateurAnnule: CollabInfo
  poste: string
  annulationDate: string | null
  annulationRaison: string | null
  representation: {
    date: string
    showStartTime: string | null
    lieu: string
  }
  statut: 'REMPLACE' | 'EN_ATTENTE_REPONSE' | 'NON_POURVU'
  propositionActive: PropositionActive | null
  remplacant: CollabInfo | null
  propositionsRefusees: number
}

type PageData = {
  projetId: string
  projetTitre: string
  remplacements: Remplacement[]
  stats: {
    total: number
    nonPourvus: number
    enAttente: number
    resolus: number
  }
}

type Candidat = {
  id: string
  prenom: string
  nom: string
  avatarUrl: string | null
  contractType: string
  score: number
  raisons: string[]
  tempsReponse: string | null
  aConflit: boolean
  disponible: boolean
}

// ── Helpers ───────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function tempsRestant(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expiré'
  const h = Math.floor(diff / (1000 * 60 * 60))
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return h > 0 ? `Expire dans ${h}h${m > 0 ? m + 'min' : ''}` : `Expire dans ${m}min`
}

function etoiles(score: number) {
  if (score >= 7) return '⭐⭐⭐'
  if (score >= 4) return '⭐⭐'
  return '⭐'
}

// ── Composant principal ───────────────────────────────────

export default function RemplacementsPage() {
  const { id: projetId } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Panneau candidats
  const [selectedAffectationId, setSelectedAffectationId] = useState<string | null>(null)
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [candidatsLoading, setCandidatsLoading] = useState(false)
  const [propositionEnCours, setPropositionEnCours] = useState<string | null>(null) // candidatId

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projets/${projetId}/remplacements`)
      if (!res.ok) { setError('Impossible de charger les remplacements.'); return }
      setData(await res.json())
    } catch {
      setError('Erreur réseau.')
    } finally {
      setLoading(false)
    }
  }, [projetId])

  useEffect(() => { fetchData() }, [fetchData])

  async function ouvrirCandidats(affectationId: string) {
    setSelectedAffectationId(affectationId)
    setCandidatsLoading(true)
    setCandidats([])
    try {
      const res = await fetch(`/api/remplacements/${affectationId}/candidats`)
      if (res.ok) setCandidats((await res.json()).candidats)
    } finally {
      setCandidatsLoading(false)
    }
  }

  async function proposer(affectationId: string, candidatId: string) {
    setPropositionEnCours(candidatId)
    try {
      const res = await fetch(`/api/remplacements/${affectationId}/proposer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatId }),
      })
      if (res.ok) {
        setSelectedAffectationId(null)
        await fetchData()
      }
    } finally {
      setPropositionEnCours(null)
    }
  }

  // ── Rendu ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
        <p>Chargement…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">{error || 'Erreur inconnue.'}</p>
      </div>
    )
  }

  const remplSelected = data.remplacements.find(
    (r) => r.affectationId === selectedAffectationId
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Retour
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            ⚡ Remplacements urgents
          </h1>
          <p className="text-sm text-gray-500">{data.projetTitre}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Non pourvus"
          value={data.stats.nonPourvus}
          color="red"
        />
        <StatCard
          label="En attente de réponse"
          value={data.stats.enAttente}
          color="yellow"
        />
        <StatCard
          label="Résolus"
          value={data.stats.resolus}
          color="green"
        />
      </div>

      {/* Liste vide */}
      {data.remplacements.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">✅</div>
          <p className="font-medium text-gray-600">Aucun remplacement en cours</p>
          <p className="text-sm mt-1">Toutes les affectations sont actives.</p>
        </div>
      )}

      {/* Liste des remplacements */}
      <div className="space-y-3">
        {data.remplacements.map((r) => (
          <RemplacementCard
            key={r.affectationId}
            remplacement={r}
            onOuvrirCandidats={() => ouvrirCandidats(r.affectationId)}
            isSelected={selectedAffectationId === r.affectationId}
          />
        ))}
      </div>

      {/* Panneau candidats */}
      {selectedAffectationId && remplSelected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">
                  🔴 Remplacement urgent
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {remplSelected.poste} · {formatDate(remplSelected.representation.date)}{' '}
                  {remplSelected.representation.showStartTime}
                </p>
              </div>
              <button
                onClick={() => setSelectedAffectationId(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              {candidatsLoading && (
                <p className="text-center text-gray-400 py-6">Analyse en cours…</p>
              )}

              {!candidatsLoading && candidats.length === 0 && (
                <p className="text-center text-gray-500 py-6">
                  Aucun candidat disponible dans l&apos;annuaire.
                </p>
              )}

              {candidats.map((c) => (
                <div
                  key={c.id}
                  className={`border rounded-xl p-4 space-y-2 ${
                    c.aConflit
                      ? 'border-red-100 bg-red-50 opacity-60'
                      : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {c.prenom} {c.nom}
                        </span>
                        <span className="text-xs">{etoiles(c.score)}</span>
                      </div>
                      {c.raisons.map((r, i) => (
                        <p key={i} className="text-xs text-gray-500 mt-0.5">
                          {r}
                        </p>
                      ))}
                      {c.tempsReponse && (
                        <p className="text-xs text-gray-400 mt-1">
                          Réponse habituelle : {c.tempsReponse}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.aConflit
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {c.aConflit ? 'Conflit' : 'Disponible'}
                    </span>
                  </div>

                  {!c.aConflit && (
                    <button
                      onClick={() => proposer(selectedAffectationId, c.id)}
                      disabled={propositionEnCours === c.id}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      {propositionEnCours === c.id
                        ? 'Envoi en cours…'
                        : 'Proposer le remplacement'}
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={() => router.push(`/equipe`)}
                className="w-full border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                🔍 Chercher dans tout l&apos;annuaire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sous-composants ───────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'red' | 'yellow' | 'green'
}) {
  const colors = {
    red: 'bg-red-50 border-red-100 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  }
  return (
    <div className={`border rounded-xl p-4 text-center ${colors[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs mt-1 font-medium">{label}</div>
    </div>
  )
}

function RemplacementCard({
  remplacement: r,
  onOuvrirCandidats,
  isSelected,
}: {
  remplacement: Remplacement
  onOuvrirCandidats: () => void
  isSelected: boolean
}) {
  const statusConfig = {
    REMPLACE: { icon: '✅', label: 'Remplacé', cls: 'bg-green-50 border-green-200' },
    EN_ATTENTE_REPONSE: {
      icon: '🟡',
      label: 'En attente de réponse',
      cls: 'bg-yellow-50 border-yellow-200',
    },
    NON_POURVU: { icon: '🔴', label: 'Non pourvu', cls: 'bg-red-50 border-red-200' },
  }
  const s = statusConfig[r.statut]

  return (
    <div className={`border rounded-xl p-5 space-y-3 ${s.cls} ${isSelected ? 'ring-2 ring-indigo-400' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{s.icon}</span>
            <span className="font-semibold text-gray-900">
              {r.collaborateurAnnule.prenom} {r.collaborateurAnnule.nom}
            </span>
            <span className="text-xs text-gray-400">s&apos;est désisté(e)</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">{r.poste}</span> ·{' '}
            {formatDate(r.representation.date)}{' '}
            {r.representation.showStartTime && `· ${r.representation.showStartTime}`}
          </p>
          {r.representation.lieu && (
            <p className="text-xs text-gray-400 mt-0.5">📍 {r.representation.lieu}</p>
          )}
          {r.annulationRaison && (
            <p className="text-xs text-gray-400 mt-0.5">Raison : {r.annulationRaison}</p>
          )}
        </div>
        <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
          {s.label}
        </span>
      </div>

      {/* Proposition active */}
      {r.propositionActive && (
        <div className="text-sm text-yellow-800 bg-yellow-100 rounded-lg px-3 py-2">
          Proposition envoyée à{' '}
          <span className="font-medium">
            {r.propositionActive.candidat.prenom} {r.propositionActive.candidat.nom}
          </span>{' '}
          · {tempsRestant(r.propositionActive.expiresAt)}
        </div>
      )}

      {/* Remplacant trouvé */}
      {r.remplacant && (
        <div className="text-sm text-green-800 bg-green-100 rounded-lg px-3 py-2">
          Remplacé par{' '}
          <span className="font-medium">
            {r.remplacant.prenom} {r.remplacant.nom}
          </span>
        </div>
      )}

      {/* Propositions refusées */}
      {r.propositionsRefusees > 0 && r.statut !== 'REMPLACE' && (
        <p className="text-xs text-gray-400">
          {r.propositionsRefusees} candidat{r.propositionsRefusees > 1 ? 's' : ''} refusé{r.propositionsRefusees > 1 ? 's' : ''} ou expiré{r.propositionsRefusees > 1 ? 's' : ''}
        </p>
      )}

      {/* Actions */}
      {r.statut !== 'REMPLACE' && (
        <button
          onClick={onOuvrirCandidats}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {r.statut === 'EN_ATTENTE_REPONSE'
            ? 'Contacter un autre candidat'
            : 'Voir les candidats suggérés'}
        </button>
      )}
    </div>
  )
}
