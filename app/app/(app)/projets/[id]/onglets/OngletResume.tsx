'use client'
// ─────────────────────────────────────────────────────────
// Onglet Résumé — vue synthèse d'un projet
// doc/04 §6.3 — Onglet Résumé
// ─────────────────────────────────────────────────────────
import type { ProjetDetail, Representation, Equipe } from '../ProjetDetailClient'

type Props = {
  projet: ProjetDetail
  representations: Representation[]
  equipes: Equipe[]
  onGoToOnglet: (id: 'resume' | 'representations' | 'equipe' | 'planning') => void
}

const TYPE_LABELS: Record<string, string> = {
  THEATRE: 'Théâtre', COMEDIE_MUSICALE: 'Comédie musicale', CONCERT: 'Concert',
  OPERA: 'Opéra', DANSE: 'Danse', CIRQUE: 'Cirque', MAINTENANCE: 'Maintenance',
  EVENEMENT: 'Événement', AUTRE: 'Autre',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTime(t: string | null): string {
  return t ? t.replace(':', 'h') : '—'
}

export function OngletResume({ projet, representations, equipes, onGoToOnglet }: Props) {
  const now = new Date()

  const reprsPassees = representations.filter((r) => new Date(r.date) < now)
  const reprsAVenir = representations.filter((r) => new Date(r.date) >= now)
  const prochaineRep = reprsAVenir[0] ?? null

  const postesNonPourvus = representations.reduce((acc, rep) => {
    if (rep.statutVisuel === 'ROUGE') acc++
    return acc
  }, 0)

  // Stats contrats
  const contractStats = { CDI: 0, CDD: 0, INTERMITTENT: 0 }
  const collabIds = new Set<string>()
  equipes.forEach((e) => {
    e.membres.forEach((m) => {
      if (!collabIds.has(m.userId)) {
        collabIds.add(m.userId)
        // On ne peut pas savoir le type de contrat ici sans données supplémentaires
      }
    })
  })

  return (
    <div className="p-6 max-w-4xl">
      {/* ── Cartes stats ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{representations.length}</p>
          <p className="text-xs text-gray-500 mt-1">Représentations totales</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-500">{reprsPassees.length}</p>
          <p className="text-xs text-gray-500 mt-1">Terminées</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-indigo-700">{reprsAVenir.length}</p>
          <p className="text-xs text-gray-500 mt-1">À venir</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className={`text-3xl font-bold ${projet.collaborateursCount > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
            {projet.collaborateursCount}
          </p>
          <p className="text-xs text-gray-500 mt-1">Collaborateurs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Prochaine représentation ─────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Prochaine représentation
          </h3>
          {prochaineRep ? (
            <div>
              <p className="text-base font-semibold text-gray-900 mb-1">
                {formatDate(prochaineRep.date)}
              </p>
              {prochaineRep.showStartTime && (
                <p className="text-sm text-gray-600">
                  {formatTime(prochaineRep.showStartTime)}{prochaineRep.showEndTime ? ` → ${formatTime(prochaineRep.showEndTime)}` : ''}
                </p>
              )}
              {prochaineRep.venueName && (
                <p className="text-sm text-gray-500 mt-1">
                  📍 {prochaineRep.venueName}{prochaineRep.venueCity ? `, ${prochaineRep.venueCity}` : ''}
                </p>
              )}
              {postesNonPourvus > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  🔴 {postesNonPourvus} représentation{postesNonPourvus > 1 ? 's' : ''} avec postes manquants
                </p>
              )}
              <button
                onClick={() => onGoToOnglet('planning')}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Voir la grille →
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400">Aucune représentation planifiée</p>
              <button
                onClick={() => onGoToOnglet('representations')}
                className="mt-2 text-sm text-indigo-600 hover:underline"
              >
                Ajouter des représentations →
              </button>
            </div>
          )}
        </div>

        {/* ── Équipes ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Équipes ({equipes.length})
          </h3>
          {equipes.length === 0 ? (
            <div>
              <p className="text-sm text-gray-400">Aucune équipe configurée</p>
              <button
                onClick={() => onGoToOnglet('equipe')}
                className="mt-2 text-sm text-indigo-600 hover:underline"
              >
                Constituer l'équipe →
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {equipes.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {e.icon && <span>{e.icon}</span>}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.name}</p>
                      {e.chef && (
                        <p className="text-xs text-gray-400">
                          Chef : {e.chef.firstName} {e.chef.lastName.charAt(0)}.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{e.postesRequis.length} postes</p>
                    <p className="text-xs text-gray-400">{e.membres.length} membres</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {equipes.length > 0 && (
            <button
              onClick={() => onGoToOnglet('equipe')}
              className="mt-4 text-sm text-indigo-600 hover:underline"
            >
              Gérer l'équipe →
            </button>
          )}
        </div>
      </div>

      {/* ── Infos projet ──────────────────────────────────── */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Informations
        </h3>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 mb-0.5">Type</dt>
            <dd className="font-medium text-gray-900">{TYPE_LABELS[projet.type] ?? projet.type}</dd>
          </div>
          {projet.startDate && (
            <div>
              <dt className="text-gray-400 mb-0.5">Début</dt>
              <dd className="font-medium text-gray-900">
                {new Date(projet.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </dd>
            </div>
          )}
          {projet.endDate && (
            <div>
              <dt className="text-gray-400 mb-0.5">Fin</dt>
              <dd className="font-medium text-gray-900">
                {new Date(projet.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-400 mb-0.5">Créé le</dt>
            <dd className="font-medium text-gray-900">
              {new Date(projet.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
