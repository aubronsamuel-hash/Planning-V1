// ─────────────────────────────────────────────────────────
// GET /api/planning/view?token=xxx — Planning collaborateur
// Route publique — magic link PLANNING_VIEW (7 jours)
// doc/06-regles-decisions.md Règle #16
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { internalError } from '@/lib/api-response'
import logger from '@/lib/logger'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
    }

    // Valider le magic link PLANNING_VIEW
    const magicToken = await prisma.magicLinkToken.findUnique({
      where: { token },
      select: {
        usedAt: true,
        expiresAt: true,
        purpose: true,
        userId: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            collaborateur: {
              select: { id: true },
            },
          },
        },
      },
    })

    if (!magicToken) {
      return NextResponse.json({ error: 'Lien invalide.' }, { status: 404 })
    }

    if (magicToken.purpose !== 'PLANNING_VIEW') {
      return NextResponse.json({ error: 'Lien invalide pour cette action.' }, { status: 400 })
    }

    // Le token PLANNING_VIEW n'est pas invalidé à l'usage (lecture seule, réutilisable)
    if (magicToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Ce lien a expiré. Contactez votre régisseur pour un nouveau lien.' },
        { status: 410 }
      )
    }

    // Récupérer les affectations à venir du collaborateur
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const affectations = await prisma.affectation.findMany({
      where: {
        collaborateurId: magicToken.user.collaborateur?.id,
        confirmationStatus: { not: 'ANNULEE' },
        representation: {
          date: { gte: today },
          status: { not: 'ANNULEE' },
        },
      },
      include: {
        representation: {
          select: {
            date: true,
            venueName: true,
            venueCity: true,
            showStartTime: true,
            showEndTime: true,
            projet: {
              select: { title: true, colorCode: true },  // schema : title
            },
          },
        },
        posteRequis: {
          select: { name: true },   // schema : name (pas intitule)
        },
      },
      orderBy: {
        representation: { date: 'asc' },
      },
    })

    const formatted = affectations.map((aff) => {
      const rep = aff.representation
      return {
        id: aff.id,
        projetTitre: rep.projet.title,    // schema : title
        projetColor: rep.projet.colorCode,
        representationDate: rep.date.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        representationLieu: [rep.venueName, rep.venueCity].filter(Boolean).join(' · '),
        poste: aff.posteRequis?.name ?? 'Poste non défini',   // schema : name
        heureDebut: aff.startTime ?? rep.showStartTime ?? '—',
        heureFin: aff.endTime ?? rep.showEndTime ?? '—',
        cachet: aff.remuneration,    // schema : remuneration (pas cachetCents)
        confirmationStatus: aff.confirmationStatus,
      }
    })

    return NextResponse.json({
      collaborateurPrenom: magicToken.user.firstName || '',
      collaborateurNom: magicToken.user.lastName || '',
      affectations: formatted,
    })
  } catch (err) {
    void logger.error('GET /api/planning/view', err, { route: 'GET /api/planning/view' })
    return internalError()
  }
}
