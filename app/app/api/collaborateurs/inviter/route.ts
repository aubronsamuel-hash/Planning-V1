// ─────────────────────────────────────────────────────────
// POST /api/collaborateurs/inviter — Inviter un collaborateur
// doc/03 §5.7 · doc/06 Règle #8 · Lazy Auth — compte GHOST
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { validationError, internalError } from '@/lib/api-response'
import { sendEmail, activationEmail, invitationMembreEmail } from '@/lib/email'
import { canAddCollaborateur, quotaMessage } from '@/lib/plans'

const InviterSchema = z.object({
  email:        z.string().email(),
  firstName:    z.string().min(1).max(50),
  lastName:     z.string().min(1).max(50),
  role:         z.enum(['REGISSEUR', 'RH', 'COLLABORATEUR']),
  contractType: z.enum(['CDI', 'CDD', 'INTERMITTENT']).optional(),
})

export async function POST(req: Request) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const organizationId = session.user.organizationId!

    const body = await req.json()
    const parsed = InviterSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { email, firstName, lastName, role, contractType } = parsed.data

    // Guard quota plan (Règle #28, doc/20)
    if (role === 'COLLABORATEUR') {
      const currentCount = await prisma.organizationMembership.count({
        where: { organizationId, role: 'COLLABORATEUR' },
      })
      const plan = session.user.organizationPlan ?? 'FREE'
      if (!canAddCollaborateur(plan, currentCount)) {
        return NextResponse.json(
          { error: 'QUOTA_REACHED', message: quotaMessage(plan, 'collaborateur') },
          { status: 403 }
        )
      }
    }

    // CAS A : User déjà sur la plateforme ?
    let user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      // Vérifier si déjà membre de l'org
      const existing = await prisma.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId } },
      })
      if (existing) {
        if (existing.joinedAt !== null) {
          // Membre actif → bloquer
          return NextResponse.json(
            { error: 'ALREADY_MEMBER', message: 'Cet utilisateur est déjà membre actif de l\'organisation.' },
            { status: 409 }
          )
        }
        // Invitation en attente → renvoyer le lien d'activation
        const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } })
        const inviterUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true } })
        const invitedByName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}`.trim() : 'L\'équipe'
        const orgName = org?.name ?? 'Spectacle SaaS'
        const roleLabels: Record<string, string> = { REGISSEUR: 'Régisseur', RH: 'RH', COLLABORATEUR: 'Collaborateur' }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        const token = await prisma.magicLinkToken.create({
          data: { userId: user.id, purpose: 'ACTIVATION', expiresAt, metadata: { organizationId, role } },
        })
        const activationUrl = `${process.env.NEXTAUTH_URL}/activate?token=${token.token}`
        const emailHtml = invitationMembreEmail({
          firstName: user.firstName ?? firstName,
          organizationName: orgName,
          invitedByName,
          roleLabel: roleLabels[existing.role] ?? existing.role,
          invitationUrl: activationUrl,
          isNewUser: false,
        })
        await sendEmail({
          to: email,
          subject: `Rappel : rejoignez ${orgName} sur Spectacle SaaS`,
          html: emailHtml,
        })
        return NextResponse.json({
          userId: user.id,
          message: 'Invitation renvoyée',
        }, { status: 200 })
      }
    } else {
      // CAS B : Créer compte GHOST
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          role: 'MEMBER',
        },
      })
    }

    // Créer le membership (joinedAt = null → invitation en attente)
    const membership = await prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId,
        role,
        joinedAt: null,
        invitedById: session.user.id,
      },
    })

    // Créer le record Collaborateur si COLLABORATEUR
    let collaborateur = await prisma.collaborateur.findFirst({
      where: { userId: user.id },
    })
    if (!collaborateur) {
      collaborateur = await prisma.collaborateur.create({
        data: {
          userId: user.id,
          accountStatus: 'GHOST',
          contractType: contractType ?? 'INTERMITTENT',
          ghostCreatedAt: new Date(),
        },
      })
    }

    // Générer MagicLinkToken ACTIVATION (7 jours)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const token = await prisma.magicLinkToken.create({
      data: {
        userId: user.id,
        purpose: 'ACTIVATION',
        expiresAt,
        metadata: { organizationId, role },
      },
    })

    // Tracer l'activité
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'MEMBER_INVITED',
        entityType: 'OrganizationMembership',
        entityId: membership.id,
        metadata: { email, role, organizationId },
      },
    })

    // Envoyer email d'invitation
    const activationUrl = `${process.env.NEXTAUTH_URL}/activate?token=${token.token}`
    const isNewUser = !await prisma.user.findFirst({
      where: { email, memberships: { some: { organizationId: { not: organizationId } } } },
    })
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } })
    const inviterUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { firstName: true, lastName: true } })
    const invitedByName = inviterUser ? `${inviterUser.firstName} ${inviterUser.lastName}`.trim() : 'L\'équipe'
    const orgName = org?.name ?? 'Spectacle SaaS'

    const roleLabels: Record<string, string> = {
      REGISSEUR: 'Régisseur',
      RH: 'RH',
      COLLABORATEUR: 'Collaborateur',
    }

    const emailHtml = isNewUser
      ? activationEmail({ firstName, organizationName: orgName, invitedByName, activationUrl })
      : invitationMembreEmail({ firstName, organizationName: orgName, invitedByName, roleLabel: roleLabels[role] ?? role, invitationUrl: activationUrl, isNewUser })

    await sendEmail({
      to: email,
      subject: isNewUser ? `${orgName} vous invite sur Spectacle SaaS` : `Vous rejoignez ${orgName} sur Spectacle SaaS`,
      html: emailHtml,
    })

    return NextResponse.json({
      userId: user.id,
      collaborateurId: collaborateur.id,
      activationToken: token.token,
      message: 'Invitation envoyée',
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/collaborateurs/inviter]', err)
    return internalError()
  }
}
