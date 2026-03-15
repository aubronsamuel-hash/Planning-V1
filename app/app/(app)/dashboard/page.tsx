// ─────────────────────────────────────────────────────────
// Dashboard — /dashboard
// doc/04-pages-interfaces-ux.md §6.1
// Vue différenciée par rôle org : admin vs collaborateur
// ─────────────────────────────────────────────────────────
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

// ── Helpers formatage ──────────────────────────────────────
function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(time: string | null): string {
  if (!time) return '—'
  return time.replace(':', 'h')
}

function diffDays(target: Date): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const t = new Date(target)
  t.setHours(0, 0, 0, 0)
  return Math.ceil((t.getTime() - now.getTime()) / 86_400_000)
}

const STATUT_LABELS: Record<string, string> = {
  EN_PREPARATION: 'En préparation',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ARCHIVE: 'Archivé',
  ANNULE: 'Annulé',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user.organizationId) redirect('/login')

  const orgId = session.user.organizationId
  const orgRole = session.user.organizationRole
  const isCollaborateur = orgRole === 'COLLABORATEUR'
  const canSeeRH = orgRole === 'DIRECTEUR' || orgRole === 'RH'

  // ── Organisation — état (bannières) ───────────────────────
  const org = await prisma.organization.findFirst({
    where: { id: orgId },
    select: {
      name: true,
      trialEndsAt: true,
      isReadOnly: true,
      suspendedAt: true,
    },
  })
  if (!org) redirect('/login')

  const now = new Date()
  const trialDaysLeft = org.trialEndsAt ? diffDays(org.trialEndsAt) : null
  const trialExpiringSoon = trialDaysLeft !== null && trialDaysLeft >= 0 && trialDaysLeft <= 3

  // ── Vue COLLABORATEUR ──────────────────────────────────────
  if (isCollaborateur) {
    // Trouver le Collaborateur associé à cet User
    const collaborateur = await prisma.collaborateur.findUnique({
      where: { userId: session.user.id },
    })

    if (!collaborateur) {
      return <DashboardEmpty prenom={session.user.name?.split(' ')[0] ?? 'vous'} />
    }

    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
    const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [prochaines, enAttente, remuMois] = await Promise.all([
      // 5 prochaines affectations
      prisma.affectation.findMany({
        where: {
          collaborateurId: collaborateur.id,
          representation: { date: { gte: now }, status: { notIn: ['ANNULEE', 'REPORTEE'] } },
          confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
        },
        include: {
          representation: { include: { projet: { select: { title: true, colorCode: true } } } },
          posteRequis: { select: { name: true } },
        },
        orderBy: { representation: { date: 'asc' } },
        take: 5,
      }),
      // Affectations EN_ATTENTE
      prisma.affectation.count({
        where: {
          collaborateurId: collaborateur.id,
          confirmationStatus: 'EN_ATTENTE',
          representation: { date: { gte: now } },
        },
      }),
      // Rémunération prévisionnelle du mois (affectations confirmées)
      prisma.affectation.aggregate({
        where: {
          collaborateurId: collaborateur.id,
          confirmationStatus: { in: ['CONFIRMEE', 'NON_REQUISE'] },
          representation: { date: { gte: debutMois, lte: finMois }, status: { notIn: ['ANNULEE', 'REPORTEE'] } },
        },
        _sum: { remuneration: true },
        _count: { id: true },
      }),
    ])

    const prenom = session.user.name?.split(' ')[0] ?? 'vous'
    const remuTotal = remuMois._sum.remuneration ?? 0
    const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">
          Bonjour {prenom} 👋
        </h1>

        {/* Bannière EN_ATTENTE */}
        {enAttente > 0 && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-orange-800">
              🟠 {enAttente} date{enAttente > 1 ? 's' : ''} attend{enAttente > 1 ? 'ent' : ''} votre confirmation
            </span>
            <Link href="/mon-planning?filtre=en_attente" className="text-sm font-medium text-orange-700 hover:text-orange-900 underline">
              Répondre →
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Prochaines dates */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Mes prochaines dates
            </h2>
            {prochaines.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune date planifiée</p>
            ) : (
              <ul className="space-y-3">
                {prochaines.map((aff) => {
                  const badge =
                    aff.confirmationStatus === 'CONFIRMEE' ? '✅' :
                    aff.confirmationStatus === 'EN_ATTENTE' ? '🟠' :
                    aff.confirmationStatus === 'REFUSEE' ? '❌' : ''
                  return (
                    <li key={aff.id} className="flex items-start gap-3">
                      <div
                        className="w-1 rounded-full self-stretch flex-shrink-0"
                        style={{ backgroundColor: aff.representation.projet.colorCode }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(aff.representation.date)}
                          </span>
                          {badge && <span>{badge}</span>}
                          {aff.confirmationStatus === 'EN_ATTENTE' && (
                            <span className="text-xs text-orange-600">À confirmer</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{aff.representation.projet.title}</p>
                        <p className="text-xs text-gray-400">{aff.posteRequis.name} · {formatTime(aff.startTime)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <Link href="/mon-planning" className="mt-4 block text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              Voir tout mon planning →
            </Link>
          </div>

          {/* Rémunération mois */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Ma rémunération ({moisLabel})
            </h2>
            <div className="mt-2">
              <p className="text-3xl font-bold text-gray-900">
                {(remuTotal / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Prévisionnel · {remuMois._count.id} représentation{remuMois._count.id > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Vue Admin (DIRECTEUR / REGISSEUR / RH) ────────────────
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
  const finMois = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const [projetsEnCours, representationsMois, collaborateursActifs, dpaeAFaire, prochaines, postesNonPourvus] =
    await Promise.all([
      // Projets actifs
      prisma.projet.count({
        where: { organizationId: orgId, status: { in: ['EN_PREPARATION', 'EN_COURS'] } },
      }),
      // Représentations ce mois
      prisma.representation.count({
        where: {
          projet: { organizationId: orgId },
          date: { gte: debutMois, lte: finMois },
          status: { notIn: ['ANNULEE', 'REPORTEE'] },
        },
      }),
      // Collaborateurs actifs (membership accepté)
      prisma.organizationMembership.count({
        where: { organizationId: orgId, joinedAt: { not: null } },
      }),
      // DPAE à faire
      canSeeRH
        ? prisma.affectation.count({
            where: {
              dpaeStatus: 'A_FAIRE',
              representation: {
                projet: { organizationId: orgId },
                date: { gte: now },
                status: { notIn: ['ANNULEE', 'REPORTEE'] },
              },
            },
          })
        : Promise.resolve(0),
      // 5 prochaines représentations
      prisma.representation.findMany({
        where: {
          projet: { organizationId: orgId },
          date: { gte: now },
          status: { notIn: ['ANNULEE', 'REPORTEE'] },
        },
        include: {
          projet: { select: { id: true, title: true, colorCode: true } },
        },
        orderBy: { date: 'asc' },
        take: 5,
      }),
      // Postes non pourvus — représentations à venir
      prisma.posteRequis.findMany({
        where: {
          projet: {
            organizationId: orgId,
            status: { in: ['EN_PREPARATION', 'EN_COURS'] },
          },
          isCritique: true,
        },
        include: {
          projet: { select: { id: true, title: true } },
          affectations: {
            where: {
              confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
              representation: { date: { gte: now }, status: { notIn: ['ANNULEE', 'REPORTEE'] } },
            },
          },
        },
        take: 20,
      }),
    ])

  // Filtrer les postes réellement manquants
  const postesCritiquesManquants = postesNonPourvus
    .filter((p) => p.affectations.length < p.requiredCount)
    .slice(0, 5)

  const prenom = session.user.name?.split(' ')[0] ?? session.user.email?.split('@')[0] ?? 'vous'
  const jourSemaine = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Bannières organisation ─────────────────────────── */}
      {org.suspendedAt && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-red-700 text-sm font-medium">
            ⛔ Votre compte est suspendu. Contactez le support.
          </span>
        </div>
      )}
      {!org.suspendedAt && org.isReadOnly && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-red-700 text-sm font-medium">
            🔒 Votre organisation est en lecture seule.
          </span>
          <Link href="/settings/organisation#facturation" className="text-sm font-semibold text-red-700 underline">
            Mettre à niveau →
          </Link>
        </div>
      )}
      {!org.suspendedAt && !org.isReadOnly && trialExpiringSoon && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-orange-800 text-sm">
            ⚠️ Votre période d'essai se termine dans {trialDaysLeft} jour{trialDaysLeft! > 1 ? 's' : ''}.
          </span>
          <Link href="/settings/organisation#facturation" className="text-sm font-semibold text-orange-700 underline">
            Voir les offres →
          </Link>
        </div>
      )}

      {/* ── Greeting ──────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Bonjour {prenom} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{jourSemaine}</p>
      </div>

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/projets" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
          <p className="text-sm text-gray-500 mb-1">Projets en cours</p>
          <p className="text-3xl font-bold text-gray-900 group-hover:text-indigo-700">{projetsEnCours}</p>
        </Link>

        <Link href="/planning" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
          <p className="text-sm text-gray-500 mb-1">Représentations {moisLabel}</p>
          <p className="text-3xl font-bold text-gray-900 group-hover:text-indigo-700">{representationsMois}</p>
        </Link>

        {(orgRole === 'DIRECTEUR' || orgRole === 'RH') && (
          <Link href="/equipe" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
            <p className="text-sm text-gray-500 mb-1">Collaborateurs actifs</p>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-indigo-700">{collaborateursActifs}</p>
          </Link>
        )}

        {canSeeRH && (
          <Link href="/rh/dpae" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
            <p className="text-sm text-gray-500 mb-1">DPAE à faire</p>
            <p className={`text-3xl font-bold ${dpaeAFaire > 0 ? 'text-red-600' : 'text-gray-900'} group-hover:text-indigo-700`}>
              {dpaeAFaire} {dpaeAFaire > 0 && '🔴'}
            </p>
          </Link>
        )}

        {orgRole === 'REGISSEUR' && (
          <Link href="/equipe" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
            <p className="text-sm text-gray-500 mb-1">Collaborateurs actifs</p>
            <p className="text-3xl font-bold text-gray-900 group-hover:text-indigo-700">{collaborateursActifs}</p>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Prochaines représentations ──────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Prochaines représentations
            </h2>
            <Link href="/planning" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Voir tout →
            </Link>
          </div>

          {prochaines.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">Aucune représentation planifiée</p>
              <Link href="/projets" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">
                Créer un projet →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {prochaines.map((rep) => (
                <li key={rep.id} className="py-2.5 flex items-center gap-3">
                  <div
                    className="w-1 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rep.projet.colorCode }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(rep.date)}
                      </span>
                      {rep.showStartTime && (
                        <span className="text-sm text-gray-500">{formatTime(rep.showStartTime)}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{rep.projet.title}</p>
                    {rep.venueName && (
                      <p className="text-xs text-gray-400 truncate">{rep.venueName}{rep.venueCity ? ` · ${rep.venueCity}` : ''}</p>
                    )}
                  </div>
                  <Link
                    href={`/projets/${rep.projetId}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
                  >
                    →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Postes non pourvus ───────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Postes critiques non pourvus 🔴
            </h2>
          </div>

          {postesCritiquesManquants.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-500">Tous les postes critiques sont couverts</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {postesCritiquesManquants.map((poste) => {
                const manquants = poste.requiredCount - poste.affectations.length
                return (
                  <li key={poste.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{poste.name}</p>
                      <p className="text-xs text-gray-500 truncate">{poste.projet.title}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm text-red-600 font-medium">
                        {manquants} manquant{manquants > 1 ? 's' : ''}
                      </span>
                      <Link
                        href={`/projets/${poste.projetId}?onglet=equipe`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        →
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function DashboardEmpty({ prenom }: { prenom: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Bonjour {prenom} 👋</h1>
      <p className="text-sm text-gray-500">Votre planning apparaîtra ici dès que vous serez assigné(e) à une représentation.</p>
    </div>
  )
}
