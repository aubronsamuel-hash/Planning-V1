// ─────────────────────────────────────────────────────────
// GET /api/cron/alerte-dpae
// Alerte le RH si une DPAE n'est pas validée à J-1 d'une représentation
// Fréquence : quotidien à 7h00 — idempotent
// doc §21.2
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import { sendEmail } from '@/lib/email'
import logger from '@/lib/logger'

function emailLayout(content: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">${content}</body></html>`
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const demain = new Date()
    demain.setDate(demain.getDate() + 1)
    demain.setHours(0, 0, 0, 0)
    const apresdemain = new Date(demain)
    apresdemain.setDate(apresdemain.getDate() + 1)

    // Affectations INTERMITTENT ou CDD avec DPAE A_FAIRE ou ENVOYEE demain
    const affectations = await prisma.affectation.findMany({
      where: {
        deletedAt: null,
        contractTypeUsed: { in: ['INTERMITTENT', 'CDD'] },
        dpaeStatus: { in: ['A_FAIRE', 'ENVOYEE'] },
        confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
        representation: {
          date: { gte: demain, lt: apresdemain },
          status: { notIn: ['ANNULEE', 'REPORTEE'] },
          deletedAt: null,
        },
      },
      include: {
        collaborateur: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        posteRequis: { select: { name: true } },
        representation: {
          include: {
            projet: { select: { id: true, organizationId: true, title: true } },
          },
        },
      },
    })

    if (affectations.length === 0) {
      return NextResponse.json({ processed: 0, message: 'Aucune alerte DPAE à envoyer' })
    }

    // Grouper par organisation
    const parOrg = new Map<string, typeof affectations>()
    for (const aff of affectations) {
      const orgId = aff.representation.projet.organizationId
      if (!parOrg.has(orgId)) parOrg.set(orgId, [])
      parOrg.get(orgId)!.push(aff)
    }

    let processed = 0

    for (const [orgId, affOrg] of parOrg) {
      // Trouver les RH de l'organisation
      const rhUsers = await prisma.user.findMany({
        where: {
          memberships: {
            some: {
              organizationId: orgId,
              role: { in: ['RH', 'DIRECTEUR'] },
            },
          },
        },
        select: { id: true, email: true, firstName: true },
      })

      if (rhUsers.length === 0) continue

      const dateStr = demain.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })

      const lignesHtml = affOrg.map((aff) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${aff.collaborateur.user.lastName} ${aff.collaborateur.user.firstName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${aff.representation.projet.title}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${aff.posteRequis.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:${aff.dpaeStatus === 'A_FAIRE' ? '#dc2626' : '#f59e0b'}">${aff.dpaeStatus === 'A_FAIRE' ? '🔴 À faire' : '🟡 Envoyée (non confirmée)'}</td>
        </tr>
      `).join('')

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

      const html = emailLayout(`
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin-bottom:20px;">
          <strong style="color:#dc2626;">🔴 Alerte DPAE — Représentation demain</strong>
        </div>
        <p>${affOrg.length} DPAE non confirmée(s) pour <strong>${dateStr}</strong> :</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Collaborateur</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Projet</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Poste</th>
              <th style="padding:8px;text-align:left;border-bottom:2px solid #e5e7eb">Statut DPAE</th>
            </tr>
          </thead>
          <tbody>${lignesHtml}</tbody>
        </table>
        <p style="margin-top:20px">
          <a href="${baseUrl}/rh" style="background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700">Gérer les DPAE →</a>
        </p>
      `)

      for (const rh of rhUsers) {
        await sendEmail({
          to: rh.email,
          subject: `🔴 DPAE J-1 — ${affOrg.length} DPAE non confirmée(s) pour demain`,
          html,
        })

        // Notification in-app critique
        await prisma.notification.create({
          data: {
            userId: rh.id,
            organizationId: orgId,
            type: 'DPAE_A_FAIRE',
            priority: 'CRITIQUE',
            title: `🔴 ${affOrg.length} DPAE non confirmée(s) — représentation demain`,
            body: `${affOrg.length} collaborateur(s) ont une DPAE en attente pour ${dateStr}.`,
            link: '/rh',
          },
        })
      }

      processed += affOrg.length
    }

    console.log(`[cron/alerte-dpae] ${processed} affectations alertées`)
    return NextResponse.json({ processed })
  } catch (err) {
    void logger.error('cron/alerte-dpae', err, { route: 'cron/alerte-dpae' })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
