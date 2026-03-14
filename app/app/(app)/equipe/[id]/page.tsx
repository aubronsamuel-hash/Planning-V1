// ─────────────────────────────────────────────────────────
// Page /equipe/[id] — Fiche détaillée d'un collaborateur
// doc/07 §7.2 — Server Component
// [id] = collaborateurId
// ─────────────────────────────────────────────────────────
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { hasFeature } from '@/lib/plans'
import Link from 'next/link'
import PreferencesTourneeForm from './PreferencesTourneeForm'

export default async function FicheCollaborateurPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgRole        = session.user.organizationRole
  const organizationId = session.user.organizationId!
  const canSeeRH       = orgRole === 'RH' || orgRole === 'DIRECTEUR'

  if (orgRole === 'COLLABORATEUR') redirect('/dashboard')

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })
  const hasTourneeModule = org ? hasFeature(org.plan, 'moduleTournee') : false

  const collab = await prisma.collaborateur.findFirst({
    where: {
      id: params.id,
      // Collaborateur n'a pas organizationId — on vérifie que le user appartient à l'org
      user: { memberships: { some: { organizationId } } },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          phone: true,
        },
      },
      affectations: {
        where: { deletedAt: null },
        include: {
          representation: {
            include: {
              projet: { select: { id: true, title: true, colorCode: true, status: true } },
            },
          },
          posteRequis: { select: { name: true } },
        },
        orderBy: [{ representation: { date: 'asc' } }],
      },
    },
  })

  if (!collab) notFound()

  // Grouper par projet pour l'historique
  const parProjet = new Map<string, {
    projet: { id: string; title: string; colorCode: string; status: string }
    poste: string
    nbAffectations: number
    remunerationCents: number
  }>()

  for (const a of collab.affectations) {
    const pid = a.representation.projet.id
    const ex  = parProjet.get(pid)
    if (ex) {
      ex.nbAffectations++
      ex.remunerationCents += a.remuneration ?? 0
    } else {
      parProjet.set(pid, {
        projet: a.representation.projet,
        poste: a.posteRequis.name,
        nbAffectations: 1,
        remunerationCents: a.remuneration ?? 0,
      })
    }
  }

  const historique = Array.from(parProjet.values()).sort((a) =>
    ['EN_PREPARATION', 'EN_COURS'].includes(a.projet.status) ? -1 : 1
  )

  const totalReprs = collab.affectations.length
  const totalRemuCents = collab.affectations.reduce((s, a) => s + (a.remuneration ?? 0), 0)

  const CONTRACT_COLOR: Record<string, string> = {
    INTERMITTENT: 'bg-orange-100 text-orange-700',
    CDD:          'bg-yellow-100 text-yellow-700',
    CDI:          'bg-blue-100 text-blue-700',
  }
  const CONTRACT_LABEL: Record<string, string> = {
    INTERMITTENT: 'Intermittent',
    CDD:          'CDD',
    CDI:          'CDI',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ── Breadcrumb ──────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/equipe" className="hover:text-gray-600">Équipe</Link>
        <span>›</span>
        <span className="text-gray-700">{collab.user.firstName} {collab.user.lastName}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Colonne gauche : identité ─────────────────── */}
        <div className="md:col-span-1 space-y-4">
          {/* Identité */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-semibold text-indigo-700 mb-3">
                {collab.user.firstName[0]}{collab.user.lastName[0]}
              </div>
              <h1 className="text-lg font-semibold text-gray-900">
                {collab.user.firstName} {collab.user.lastName}
              </h1>
              <p className="text-sm text-gray-500">{collab.user.email}</p>
              {collab.user.phone && <p className="text-sm text-gray-500">{collab.user.phone}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Compte</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  collab.accountStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {collab.accountStatus === 'ACTIVE' ? '✅ Actif' : '⏳ En attente'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Contrat</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTRACT_COLOR[collab.contractType] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CONTRACT_LABEL[collab.contractType] ?? collab.contractType}
                </span>
              </div>
              {collab.cachetHabituel && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Cachet habituel</span>
                  <span className="text-gray-900 font-medium">{(collab.cachetHabituel / 100).toFixed(2)} €</span>
                </div>
              )}
            </div>
          </div>

          {/* Spécialités */}
          {(collab.specialites.length > 0 || collab.yearsExperience) && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Spécialités</h3>
              {collab.specialites.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {collab.specialites.map((s) => (
                    <span key={s} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {collab.yearsExperience && (
                <p className="text-sm text-gray-600">{collab.yearsExperience} ans d'expérience</p>
              )}
              {collab.availableForTour && (
                <p className="text-sm text-gray-600 mt-1">✈️ Disponible en tournée</p>
              )}
            </div>
          )}

          {/* Données RH (RH / Directeur seulement) */}
          {canSeeRH && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                🔒 Données RH
              </h3>
              <div className="space-y-2 text-sm">
                {collab.congesSpectaclesNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">N° Congés Spectacles</span>
                    <span className="font-mono text-gray-900">{collab.congesSpectaclesNumber}</span>
                  </div>
                )}
                {collab.socialSecurityNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">N° SS</span>
                    <span className="font-mono text-gray-400">•••••••••••••••</span>
                  </div>
                )}
                {collab.iban && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">IBAN</span>
                    <span className="font-mono text-gray-400">FR76 •••• ···{collab.iban.slice(-4)}</span>
                  </div>
                )}
                {!collab.socialSecurityNumber && !collab.iban && !collab.congesSpectaclesNumber && (
                  <p className="text-gray-400 text-xs italic">Aucune donnée RH saisie</p>
                )}
              </div>
            </div>
          )}

          {/* Préférences tournée (ENTERPRISE + RH/Directeur seulement) */}
          {canSeeRH && hasTourneeModule && (
            <PreferencesTourneeForm
              collaborateurId={collab.id}
              initial={{
                preferenceChambre: collab.preferenceChambre as 'SANS_PREFERENCE' | 'INDIVIDUELLE' | 'PARTAGEE_ACCEPTEE',
                regimeAlimentaire: collab.regimeAlimentaire as 'STANDARD' | 'VEGETARIEN' | 'VEGAN' | 'SANS_PORC' | 'HALAL' | 'KASHER' | 'AUTRE',
                allergies: collab.allergies,
                permisConduire: collab.permisConduire,
                permisCategorie: collab.permisCategorie,
                notesTournee: collab.notesTournee,
              }}
            />
          )}
        </div>

        {/* ── Colonne droite : historique ───────────────── */}
        <div className="md:col-span-2 space-y-4">
          {/* Stats globales */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{totalReprs}</p>
              <p className="text-xs text-gray-500 mt-1">Représentations</p>
            </div>
            {canSeeRH && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {(totalRemuCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
                <p className="text-xs text-gray-500 mt-1">Rémunération totale</p>
              </div>
            )}
          </div>

          {/* Historique par projet */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Historique dans l'organisation</h2>
              {canSeeRH && (
                <Link
                  href={`/equipe/${params.id}/historique`}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Voir tout →
                </Link>
              )}
            </div>
            {historique.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Aucune affectation pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {historique.map((h) => (
                  <div key={h.projet.id} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                    <div
                      className="w-3 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: h.projet.colorCode }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{h.projet.title}</p>
                        {['EN_PREPARATION', 'EN_COURS'].includes(h.projet.status) && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">En cours</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{h.poste} · {h.nbAffectations} représentation{h.nbAffectations > 1 ? 's' : ''}</p>
                    </div>
                    {canSeeRH && (
                      <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                        {(h.remunerationCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </p>
                    )}
                    <Link
                      href={`/projets/${h.projet.id}?onglet=planning`}
                      className="text-indigo-600 hover:text-indigo-800 text-sm flex-shrink-0"
                    >
                      →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
