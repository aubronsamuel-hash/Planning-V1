'use client'
// ─────────────────────────────────────────────────────────
// ProjetDetailClient — tabs + navigation
// doc/04 §6.3 — Onglets : Résumé | Représentations | Équipe & Postes | Planning
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { OngletResume } from './onglets/OngletResume'
import { OngletRepresentations } from './onglets/OngletRepresentations'
import { OngletEquipePostes } from './onglets/OngletEquipePostes'
import { OngletPlanning } from './onglets/OngletPlanning'
import { OngletTournee } from './onglets/OngletTournee'

// ── Types partagés ─────────────────────────────────────────
export type ProjetDetail = {
  id: string
  title: string
  subtitle: string | null
  type: string
  status: string
  colorCode: string
  startDate: string | null
  endDate: string | null
  posterUrl: string | null
  regisseurId: string | null
  regisseurNom: string | null
  organizationId: string
  representationsCount: number
  collaborateursCount: number
  createdAt: string
}

export type Representation = {
  id: string
  projetId: string
  date: string
  type: string
  status: string
  getInTime: string | null
  warmupTime: string | null
  showStartTime: string | null
  showEndTime: string | null
  getOutTime: string | null
  venueName: string | null
  venueCity: string | null
  venueAddress: string | null
  notes: string | null
  affectationsCount: number
  statutVisuel: 'VERT' | 'JAUNE' | 'ROUGE'
}

export type PosteRequis = {
  id: string
  name: string
  requiredCount: number
  isCritique: boolean
  contractTypePreference: string
  defaultStartTime: string | null
  defaultEndTime: string | null
  equipeId: string
  projetId: string
  affectationsCount: number
}

export type Equipe = {
  id: string
  name: string
  icon: string | null
  color: string | null
  projetId: string
  chef: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null
  membres: Array<{
    userId: string
    role: 'CHEF' | 'MEMBRE'
    user: { id: string; firstName: string; lastName: string; avatarUrl: string | null }
  }>
  postesRequis: PosteRequis[]
}

export type MembreOrg = {
  userId: string
  role: string
  nom: string
}

export type Collaborateur = {
  id: string
  userId: string
  accountStatus: string
  contractType: string
  nom: string
}

type Props = {
  projet: ProjetDetail
  representations: Representation[]
  equipes: Equipe[]
  membresOrg: MembreOrg[]
  collaborateurs: Collaborateur[]
  canEdit: boolean
  canSeeRH: boolean
  organisationPlan: string
}

type OngletId = 'resume' | 'representations' | 'equipe' | 'planning' | 'tournee'

const ONGLETS: Array<{ id: OngletId; label: string }> = [
  { id: 'resume', label: 'Résumé' },
  { id: 'representations', label: 'Représentations' },
  { id: 'equipe', label: 'Équipe & Postes' },
  { id: 'planning', label: 'Planning' },
  { id: 'tournee', label: 'Tournée' },
]

const TYPE_LABELS: Record<string, string> = {
  THEATRE: 'Théâtre',
  COMEDIE_MUSICALE: 'Comédie musicale',
  CONCERT: 'Concert',
  OPERA: 'Opéra',
  DANSE: 'Danse',
  CIRQUE: 'Cirque',
  MAINTENANCE: 'Maintenance',
  EVENEMENT: 'Événement',
  AUTRE: 'Autre',
}

const STATUT_COLORS: Record<string, string> = {
  EN_PREPARATION: 'text-blue-700',
  EN_COURS: 'text-green-700',
  TERMINE: 'text-gray-500',
  ARCHIVE: 'text-gray-400',
  ANNULE: 'text-red-600',
}

const STATUT_LABELS: Record<string, string> = {
  EN_PREPARATION: 'En préparation',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ARCHIVE: 'Archivé',
  ANNULE: 'Annulé',
}

export function ProjetDetailClient({
  projet,
  representations,
  equipes,
  membresOrg,
  collaborateurs,
  canEdit,
  canSeeRH,
  organisationPlan,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const ongletParam = searchParams.get('onglet') as OngletId | null
  const [ongletActif, setOngletActif] = useState<OngletId>(ongletParam ?? 'resume')
  const [localEquipes, setLocalEquipes] = useState<Equipe[]>(equipes)
  const [localRepresentations, setLocalRepresentations] = useState<Representation[]>(representations)

  // Sync URL → onglet actif
  useEffect(() => {
    if (ongletParam && ONGLETS.find((o) => o.id === ongletParam)) {
      setOngletActif(ongletParam)
    }
  }, [ongletParam])

  function naviguerOnglet(id: OngletId) {
    setOngletActif(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set('onglet', id)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function formatPeriode(): string {
    if (!projet.startDate && !projet.endDate) return ''
    const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }
    const s = projet.startDate ? new Date(projet.startDate).toLocaleDateString('fr-FR', opts) : null
    const e = projet.endDate ? new Date(projet.endDate).toLocaleDateString('fr-FR', opts) : null
    if (s && e) return `${s} → ${e}`
    if (s) return `Dès ${s}`
    return `Jusqu'à ${e}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── En-tête projet ──────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        {/* Breadcrumb */}
        <nav className="text-xs text-gray-400 mb-3">
          <Link href="/projets" className="hover:text-gray-600">Projets</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-700">{projet.title}</span>
        </nav>

        <div className="flex items-start gap-4">
          {/* Bande colorCode */}
          <div
            className="w-1.5 rounded-full self-stretch flex-shrink-0 min-h-12"
            style={{ backgroundColor: projet.colorCode }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{projet.title}</h1>
                {projet.subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{projet.subtitle}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 flex-wrap">
                  <span>{TYPE_LABELS[projet.type] ?? projet.type}</span>
                  {formatPeriode() && <><span>·</span><span>{formatPeriode()}</span></>}
                  {projet.regisseurNom && (
                    <><span>·</span><span>Rég: {projet.regisseurNom}</span></>
                  )}
                  <span>·</span>
                  <span className={`font-medium ${STATUT_COLORS[projet.status] ?? 'text-gray-600'}`}>
                    ● {STATUT_LABELS[projet.status] ?? projet.status}
                  </span>
                </div>
              </div>

              {canEdit && (
                <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                  ✏️ Modifier
                </button>
              )}
            </div>

            {/* Compteurs */}
            <div className="flex gap-6 mt-3 text-sm text-gray-500">
              <span>
                <span className="font-semibold text-gray-900">{projet.representationsCount}</span>
                {' '}représentations
              </span>
              <span>
                <span className="font-semibold text-gray-900">{projet.collaborateursCount}</span>
                {' '}collaborateurs
              </span>
            </div>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="flex gap-1 mt-5 -mb-5 overflow-x-auto">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => naviguerOnglet(o.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                ongletActif === o.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu onglet ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {ongletActif === 'resume' && (
          <OngletResume
            projet={projet}
            representations={localRepresentations}
            equipes={localEquipes}
            onGoToOnglet={naviguerOnglet}
          />
        )}
        {ongletActif === 'representations' && (
          <OngletRepresentations
            projetId={projet.id}
            representations={localRepresentations}
            canEdit={canEdit}
            onRepresentationsChange={setLocalRepresentations}
            onGoToPlanning={(repId) => {
              naviguerOnglet('planning')
            }}
          />
        )}
        {ongletActif === 'equipe' && (
          <OngletEquipePostes
            projetId={projet.id}
            equipes={localEquipes}
            membresOrg={membresOrg}
            collaborateurs={collaborateurs}
            canEdit={canEdit}
            onEquipesChange={setLocalEquipes}
          />
        )}
        {ongletActif === 'planning' && (
          <OngletPlanning
            projetId={projet.id}
            projetColorCode={projet.colorCode}
            equipes={localEquipes}
            collaborateurs={collaborateurs}
            canEdit={canEdit}
          />
        )}
        {ongletActif === 'tournee' && (
          <OngletTournee
            projetId={projet.id}
            organisationId={projet.organizationId}
            organisationPlan={organisationPlan}
            canEdit={canEdit}
            canSeeRH={canSeeRH}
          />
        )}
      </div>
    </div>
  )
}
