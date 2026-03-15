'use client'
// ─────────────────────────────────────────────────────────
// /projets/[id]/annulations — Page RH suivi cachets & annulations
// doc/12-annulations-reports.md §12.6
// Accès : RH / Directeur
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type Affectation = {
  id: string
  confirmationStatus: string
  remuneration: number | null
  contractTypeUsed: string | null
  dpaeStatus: string | null
  cachetAnnulation: 'A_DECIDER' | 'DU' | 'ANNULE' | null
  annulationRaison: string | null
  collaborateur: {
    user: { firstName: string; lastName: string; email: string }
  }
  posteRequis: { name: string }
  representation: {
    id: string
    date: string
    annulationReason: string | null
    annulationAt: string | null
  }
}

type RepGroup = {
  representationId: string
  date: string
  annulationReason: string | null
  annulationAt: string | null
  affectations: Affectation[]
}

type PageData = {
  projetId: string
  projetTitle: string
  representations: RepGroup[]
  totaux: {
    nbAffectations: number
    nbDpaeSoumises: number
    totalADecider: number
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMoney(centimes: number | null) {
  if (centimes == null) return '—'
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function DpaeStatus({ status }: { status: string | null }) {
  if (!status || status === 'A_FAIRE') return <span className="text-xs text-gray-400">❌ Non soumise</span>
  if (status === 'ENVOYEE' || status === 'CONFIRMEE') return <span className="text-xs text-green-700">✅ Soumise</span>
  return <span className="text-xs text-gray-400">{status}</span>
}

function CachetDecision({
  aff,
  onDecision,
}: {
  aff: Affectation
  onDecision: (id: string, decision: 'DU' | 'ANNULE') => void
}) {
  // Les CDI n'ont pas de cachet intermittent — on affiche "—"
  if (aff.contractTypeUsed === 'CDI') return <span className="text-xs text-gray-400">— (CDI)</span>

  if (aff.cachetAnnulation === 'DU') {
    return <span className="text-xs text-green-700 font-medium">✔ Cachet dû</span>
  }
  if (aff.cachetAnnulation === 'ANNULE') {
    return <span className="text-xs text-red-600 font-medium">✖ Cachet annulé</span>
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => onDecision(aff.id, 'DU')}
        className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 font-medium"
      >
        ✔ Dû
      </button>
      <button
        onClick={() => onDecision(aff.id, 'ANNULE')}
        className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-medium"
      >
        ✖ Annulé
      </button>
    </div>
  )
}

export default function AnnulationsPage() {
  const params  = useParams()
  const projetId = params.id as string

  const [data, setData]       = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projets/${projetId}/annulations`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [projetId])

  useEffect(() => { load() }, [load])

  async function handleDecision(affId: string, decision: 'DU' | 'ANNULE') {
    const res = await fetch(`/api/affectations/${affId}/cachet`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ decision }),
    })
    if (res.ok) {
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          representations: prev.representations.map((rep) => ({
            ...rep,
            affectations: rep.affectations.map((a) =>
              a.id === affId ? { ...a, cachetAnnulation: decision } : a
            ),
          })),
        }
      })
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/projets/${projetId}/annulations?export=csv`)
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `annulations-${data?.projetTitle ?? projetId}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mt-20" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Erreur de chargement.</p>
        <Link href={`/projets/${projetId}`} className="text-sm text-indigo-600 hover:text-indigo-800 mt-2 block">
          ← Retour au projet
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href={`/projets/${projetId}`} className="hover:text-indigo-600">
              ← {data.projetTitle}
            </Link>
            <span>/</span>
            <span>Annulations</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Annulations &amp; Cachets</h1>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {exporting ? 'Export…' : 'Exporter CSV'}
        </button>
      </div>

      {/* Bandeau récap */}
      {data.totaux.nbAffectations > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Affectations annulées</p>
            <p className="text-2xl font-bold text-gray-900">{data.totaux.nbAffectations}</p>
          </div>
          <div className={`rounded-xl border px-5 py-4 ${data.totaux.nbDpaeSoumises > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">DPAE soumises</p>
            <p className={`text-2xl font-bold ${data.totaux.nbDpaeSoumises > 0 ? 'text-red-700' : 'text-gray-900'}`}>
              {data.totaux.nbDpaeSoumises}
            </p>
            {data.totaux.nbDpaeSoumises > 0 && (
              <p className="text-xs text-red-600 mt-0.5">Régularisation URSSAF requise</p>
            )}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cachets à valider</p>
            <p className="text-2xl font-bold text-amber-800">{formatMoney(data.totaux.totalADecider)}</p>
          </div>
        </div>
      )}

      {/* Contenu */}
      {data.representations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">✅</p>
          <p className="text-gray-500 text-sm">Aucune annulation sur ce projet pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.representations.map((rep) => {
            const nbDpae = rep.affectations.filter(
              (a) => a.dpaeStatus === 'ENVOYEE' || a.dpaeStatus === 'CONFIRMEE'
            ).length
            const totalADecider = rep.affectations
              .filter((a) => a.cachetAnnulation === 'A_DECIDER' && a.remuneration != null)
              .reduce((s, a) => s + (a.remuneration ?? 0), 0)
            const estTardive = rep.affectations.some((a) => a.confirmationStatus === 'ANNULEE_TARDIVE')

            return (
              <div key={rep.representationId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Entête représentation */}
                <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        ❌ {formatDate(rep.date)}
                      </span>
                      {estTardive && (
                        <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          Annulation tardive
                        </span>
                      )}
                    </div>
                    {totalADecider > 0 && (
                      <span className="text-xs text-amber-700 font-medium">
                        💰 {formatMoney(totalADecider)} à valider
                      </span>
                    )}
                  </div>
                  {rep.annulationReason && (
                    <p className="mt-1 text-xs text-gray-500">Raison : &laquo;{rep.annulationReason}&raquo;</p>
                  )}
                  {nbDpae > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <span>⚠️</span>
                      <span>{nbDpae} DPAE soumise{nbDpae > 1 ? 's' : ''} — régularisation URSSAF à faire manuellement</span>
                    </div>
                  )}
                </div>

                {/* Tableau affectations */}
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Collaborateur</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Contrat</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cachet prévu</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">DPAE</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Décision cachet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rep.affectations.map((aff) => (
                      <tr key={aff.id} className={aff.confirmationStatus === 'ANNULEE_TARDIVE' ? 'bg-red-50/30' : ''}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {aff.collaborateur.user.firstName} {aff.collaborateur.user.lastName}
                          </p>
                          <p className="text-xs text-gray-400">{aff.posteRequis.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-600">{aff.contractTypeUsed ?? '—'}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatMoney(aff.remuneration)}
                        </td>
                        <td className="px-4 py-3">
                          <DpaeStatus status={aff.dpaeStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <CachetDecision aff={aff} onDecision={handleDecision} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
