// ─────────────────────────────────────────────────────────
// POST /api/hebergements/[id]/envoyer — Envoyer la rooming list à l'hôtel
// doc/19-module-tournee.md §19.1.5 — ENTERPRISE uniquement
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound, forbidden } from '@/lib/api-response'
import { hasFeature } from '@/lib/plans'
import { sendEmail } from '@/lib/email'
import { roomingListEmail } from '@/lib/email'
import logger from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await prisma.hebergement.findUnique({
      where: { id: params.id },
      include: {
        projet: {
          include: {
            organization: { select: { id: true, name: true, plan: true } },
            regisseur: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        chambres: {
          include: {
            occupants: {
              orderBy: { nuitDu: 'asc' },
              include: {
                collaborateur: {
                  select: {
                    id: true,
                    regimeAlimentaire: true,
                    allergies: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!hebergement) return notFound('Hébergement')

    const ownershipError = verifyOwnership(hebergement.projet.organization.id, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (!hasFeature(hebergement.projet.organization.plan, 'moduleTournee')) {
      return forbidden('Le module Tournée est réservé au plan ENTERPRISE. Passez sur /settings/organisation#facturation')
    }

    if (!hebergement.email) {
      return NextResponse.json(
        { error: "L'hébergement n'a pas d'adresse email configurée", code: 'VALIDATION_ERROR' },
        { status: 422 }
      )
    }

    // Générer et envoyer l'email
    const html = roomingListEmail({
      organisationNom: hebergement.projet.organization.name,
      projetTitre: hebergement.projet.title,
      hebergementNom: hebergement.nom,
      hebergementAdresse: hebergement.adresse,
      checkIn: hebergement.checkIn,
      checkOut: hebergement.checkOut,
      chambres: hebergement.chambres,
      regisseurNom: `${hebergement.projet.regisseur.firstName} ${hebergement.projet.regisseur.lastName}`,
      regisseurEmail: hebergement.projet.regisseur.email,
    })

    const sent = await sendEmail({
      to: hebergement.email,
      subject: `Rooming List — ${hebergement.projet.title} · ${formatDateRange(hebergement.checkIn, hebergement.checkOut)}`,
      html,
      replyTo: hebergement.projet.regisseur.email,
    })

    if (!sent.success) {
      void logger.warn('POST /api/hebergements/[id]/envoyer Email send failed', { route: 'POST /api/hebergements/[id]/envoyer', error: sent.error })
      return internalError()
    }

    // Mettre à jour la date d'envoi
    const now = new Date()
    await prisma.hebergement.update({
      where: { id: params.id },
      data: { roomingListEnvoyeeAt: now },
    })

    // Tracer l'action
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'ROOMING_LIST_ENVOYEE',
        entityType: 'Hebergement',
        entityId: params.id,
        metadata: {
          hebergementNom: hebergement.nom,
          projetId: hebergement.projetId,
          destinataire: hebergement.email,
        },
      },
    })

    return NextResponse.json({ success: true, sentAt: now })
  } catch (err) {
    void logger.error('POST /api/hebergements/[id]/envoyer', err, { route: 'POST /api/hebergements/[id]/envoyer' })
    return internalError()
  }
}

function formatDateRange(checkIn: Date, checkOut: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const locale = 'fr-FR'
  return `${checkIn.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} – ${checkOut.toLocaleDateString(locale, opts)}`
}
