// ─────────────────────────────────────────────────────────
// POST /api/affectations/[id]/relancer — Renvoyer un magic link de confirmation
// doc/06 Règle #31 — relanceSentAt remis à null pour permettre une nouvelle relance
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { internalError, notFound } from '@/lib/api-response'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const affectation = await prisma.affectation.findFirst({
      where: { id: params.id },
      include: {
        collaborateur: {
          include: { user: { select: { id: true, email: true, firstName: true } } },
        },
        representation: {
          include: { projet: { select: { id: true, organizationId: true, title: true } } },
        },
      },
    })
    if (!affectation) return notFound('Affectation')

    const ownershipError = verifyOwnership(affectation.representation.projet.organizationId, session.user.organizationId!)
    if (ownershipError) return ownershipError

    if (affectation.contractTypeUsed !== 'INTERMITTENT') {
      return NextResponse.json({ error: 'La relance ne s\'applique qu\'aux intermittents', code: 'VALIDATION_ERROR' }, { status: 422 })
    }

    if (affectation.confirmationStatus !== 'EN_ATTENTE') {
      return NextResponse.json({ error: 'L\'affectation n\'est plus en attente', code: 'VALIDATION_ERROR' }, { status: 422 })
    }

    // Invalider les tokens CONFIRMATION existants (Règle CJ-3 §21.1)
    await prisma.magicLinkToken.updateMany({
      where: {
        userId: affectation.collaborateur.userId,
        purpose: 'CONFIRMATION',
        usedAt: null,
        expiresAt: { gt: new Date() },
        metadata: { path: ['affectationId'], equals: affectation.id },
      },
      data: { usedAt: new Date() },
    })

    // Créer un nouveau token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const token = await prisma.magicLinkToken.create({
      data: {
        userId: affectation.collaborateur.userId,
        purpose: 'CONFIRMATION',
        expiresAt,
        metadata: { affectationId: affectation.id },
      },
    })

    // Remettre relanceSentAt à null pour permettre une nouvelle relance cron (Règle #31)
    await prisma.affectation.update({
      where: { id: params.id },
      data: { relanceSentAt: null },
    })

    // TODO: envoyer l'email avec le lien de confirmation
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const confirmationLink = `${baseUrl}/affectation/${token.token}/confirmer`

    return NextResponse.json({ success: true, confirmationLink })
  } catch (err) {
    console.error('[POST /api/affectations/[id]/relancer]', err)
    return internalError()
  }
}
