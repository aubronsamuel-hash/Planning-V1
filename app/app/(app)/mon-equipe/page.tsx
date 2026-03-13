'use client'
// ─────────────────────────────────────────────────────────
// Page /mon-equipe — Dashboard Chef de poste
// doc/09 §9.1-§9.5
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Projet = { id: string; title: string; colorCode: string }

type Alerte = {
  type: 'POSTE_MANQUANT' | 'EN_ATTENTE'
  urgence: 'CRITIQUE' | 'URGENT' | 'PLANIFIER'
  representationDate: string
  showStartTime: string | null
  venueName: string | null
  posteNom: string
  representationId: string
  collaborateurNom?: string
  affectationId?: string
}

type Equipe = {
  equipeId: string
  equipeNom: string
  equipeIcon: string | null
  projet: Projet
  membres: { userId: string; firstName: string; lastName: string; role: string }[]
  alertes: Alerte[]
  planning14j: {
    representationId: string
    date: string
    showStartTime: string | null
    venueName: string | null
    postes: { nom: string; requis: number; affectations: { id: string; collaborateurNom: string; confirmationStatus: string; contractType: string }[] }[]
  }[]
}

const URGENCE_STYLE: Record<string, string> = {
  CRITIQUE:  'bg-red-50 border border-red-200 text-red-800',
  URGENT:    'bg-orange-50 border border-orange-200 text-orange-800',
  PLANIFIER: 'bg-blue-50 border border-blue-200 text-blue-800',
}
const URGENCE_ICON: Record<string, string> = {
  CRITIQUE:  '🔴',
  URGENT:    '🟡',
  PLANIFIER: '📋',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MonEquipePage() {
  const [data, setData]         = useState<{ equipes: Equipe[]; projets: Projet[] } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [projetId, setProjetId] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params = projetId ? `?projetId=${projetId}` : ''
        const res    = await fetch(`/api/mon-equipe${params}`)
        setData(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projetId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || data.equipes.length === 0) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-4xl mb-4">🎯</p>
        <p className="text-gray-500 text-sm">Vous n'êtes chef d'aucune équipe actuellement.</p>
      </div>
    )
  }

  const { equipes, projets } = data

  return (
    <div className="p-6">
      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Mon équipe</h1>
        {projets.length > 1 && (
          <select
            value={projetId}
            onChange={(e) => setProjetId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Tous les projets</option>
            {projets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        )}
      </div>

      {equipes.map((equipe) => (
        <div key={equipe.equipeId} className="mb-10">
          {/* Header équipe */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-8 rounded-full" style={{ backgroundColor: equipe.projet.colorCode }} />
            <div>
              <p className="font-semibold text-gray-900">
                {equipe.equipeIcon && <span className="mr-2">{equipe.equipeIcon}</span>}
                {equipe.equipeNom}
              </p>
              <p className="text-xs text-gray-500">{equipe.projet.title} · {equipe.membres.length} membre{equipe.membres.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* ── Panneau gauche : À faire ─────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">⚡ À faire</h3>
                {equipe.alertes.length === 0 ? (
                  <p className="text-sm text-green-600 font-medium">✅ Tout est en ordre pour les 14 prochains jours !</p>
                ) : (
                  <div className="space-y-3">
                    {equipe.alertes.map((a, i) => (
                      <div key={i} className={`rounded-lg p-3 text-sm ${URGENCE_STYLE[a.urgence]}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span>{URGENCE_ICON[a.urgence]}</span>
                          <span className="font-semibold">
                            {a.type === 'EN_ATTENTE' ? 'Confirmation en attente' : 'Poste non pourvu'}
                          </span>
                        </div>
                        <p className="text-xs opacity-80">
                          {a.posteNom} — {formatDate(a.representationDate)}
                          {a.showStartTime && ` · ${a.showStartTime.replace(':', 'h')}`}
                        </p>
                        {a.collaborateurNom && (
                          <p className="text-xs mt-1 opacity-70">{a.collaborateurNom}</p>
                        )}
                        <Link
                          href={`/projets/${equipe.projet.id}?onglet=planning`}
                          className="inline-block mt-2 text-xs font-semibold underline opacity-80 hover:opacity-100"
                        >
                          {a.type === 'EN_ATTENTE' ? 'Renvoyer le lien →' : 'Affecter →'}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Panneau central : Planning 14j ───────── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">📅 14 prochains jours</h3>
                {equipe.planning14j.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune représentation à venir.</p>
                ) : (
                  <div className="space-y-3">
                    {equipe.planning14j.map((repr) => (
                      <div key={repr.representationId} className="border border-gray-100 rounded-lg p-3">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatDate(repr.date)}
                          {repr.showStartTime && <span className="text-gray-400 font-normal"> · {repr.showStartTime.replace(':', 'h')}</span>}
                        </p>
                        {repr.venueName && <p className="text-xs text-gray-500">{repr.venueName}</p>}
                        {repr.postes.map((p, i) => (
                          <div key={i} className="mt-2 text-xs">
                            <span className="text-gray-500">{p.nom} ({p.requis}) — </span>
                            {p.affectations.map((a) => {
                              const badge = a.confirmationStatus === 'CONFIRMEE' ? '✅'
                                : a.confirmationStatus === 'EN_ATTENTE' ? '⏳'
                                : a.confirmationStatus === 'REFUSEE'    ? '❌' : '○'
                              return <span key={a.id} className="mr-1">{badge} {a.collaborateurNom}</span>
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Link
                    href={`/projets/${equipe.projet.id}?onglet=planning`}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    Voir toutes les dates →
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Panneau droit : Membres ───────────────── */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">👥 Mon équipe ({equipe.membres.length})</h3>
                <div className="space-y-3">
                  {equipe.membres.map((m) => (
                    <div key={m.userId} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-semibold text-indigo-700 flex-shrink-0">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{m.firstName} {m.lastName}</p>
                        {m.role === 'CHEF' && <p className="text-xs text-indigo-500">Chef de poste</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    href={`/equipe`}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Inviter un membre →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
