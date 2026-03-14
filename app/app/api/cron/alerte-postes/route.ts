// ─────────────────────────────────────────────────────────
// GET /api/cron/alerte-postes
// (1) Alerte régisseur/chefs si postes non pourvus à J-7 ou J-2
// (2) Archive les feuilles de route dont la représentation est passée
// Fréquence : quotidien à 8h00 — idempotent
// doc §21.7
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCronSecret } from '@/lib/cron'
import { sendEmail } from '@/lib/email'

function emailLayout(content: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111;max-width:600px;margin:0 auto;padding:20px">${content}</body></html>`
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  try {
    const maintenant = new Date()
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

    // Calculer les dates J-7 et J-2
    const j7debut = new Date(maintenant); j7debut.setDate(j7debut.getDate() + 7); j7debut.setHours(0,0,0,0)
    const j7fin   = new Date(j7debut);    j7fin.setDate(j7fin.getDate() + 1)
    const j2debut = new Date(maintenant); j2debut.setDate(j2debut.getDate() + 2); j2debut.setHours(0,0,0,0)
    const j2fin   = new Date(j2debut);    j2fin.setDate(j2fin.getDate() + 1)

    let alertesJ7 = 0
    let alertesJ2 = 0
    let fdrArchivees = 0

    // ── Helper : calculer les postes non pourvus ──────────
    async function getPostesNonPourvus(representationId: string) {
      const postesRequis = await prisma.posteRequis.findMany({
        where: {
          equipe: { projet: { representations: { some: { id: representationId } } } },
        },
        include: {
          affectations: {
            where: {
              representationId,
              deletedAt: null,
              confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE'] },
            },
            select: { id: true },
          },
        },
      })

      return postesRequis
        .map((p) => ({
          nom: p.name,
          requis: p.requiredCount,
          pourvus: p.affectations.length,
          manquants: Math.max(0, p.requiredCount - p.affectations.length),
        }))
        .filter((p) => p.manquants > 0)
    }

    // ── ÉTAPE 1 — Alerte J-7 ─────────────────────────────
    const repsJ7 = await prisma.representation.findMany({
      where: {
        date: { gte: j7debut, lt: j7fin },
        status: 'PLANIFIEE',
        deletedAt: null,
      },
      include: {
        projet: { select: { id: true, organizationId: true, title: true, regisseurId: true } },
      },
    })

    for (const rep of repsJ7) {
      const postesManquants = await getPostesNonPourvus(rep.id)
      if (postesManquants.length === 0) continue

      const dateStr = new Date(rep.date).toLocaleDateString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'long',
      })
      const nbManquants = postesManquants.reduce((s, p) => s + p.manquants, 0)

      // Notifier le régisseur
      const regisseurs = await prisma.user.findMany({
        where: {
          memberships: {
            some: { organizationId: rep.projet.organizationId, role: 'REGISSEUR' },
          },
        },
        select: { id: true },
      })

      for (const reg of regisseurs) {
        await prisma.notification.create({
          data: {
            userId: reg.id,
            organizationId: rep.projet.organizationId,
            type: 'POSTE_NON_POURVU',
            priority: 'URGENT',
            title: `⚠️ ${rep.projet.title} · ${dateStr} — ${nbManquants} poste(s) non pourvu(s) (J-7)`,
            body: postesManquants.map((p) => `${p.nom}: ${p.manquants} manquant(s)`).join(' · '),
            link: `/projets/${rep.projet.id}`,
            relatedId: rep.id,
            relatedType: 'representation',
          },
        })
      }

      alertesJ7++
    }

    // ── ÉTAPE 2 — Alerte J-2 (CRITIQUE + email) ──────────
    const repsJ2 = await prisma.representation.findMany({
      where: {
        date: { gte: j2debut, lt: j2fin },
        status: 'PLANIFIEE',
        deletedAt: null,
      },
      include: {
        projet: { select: { id: true, organizationId: true, title: true } },
      },
    })

    for (const rep of repsJ2) {
      const postesManquants = await getPostesNonPourvus(rep.id)
      if (postesManquants.length === 0) continue

      const dateStr = new Date(rep.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      const nbManquants = postesManquants.reduce((s, p) => s + p.manquants, 0)

      const regisseurs = await prisma.user.findMany({
        where: {
          memberships: {
            some: { organizationId: rep.projet.organizationId, role: 'REGISSEUR' },
          },
        },
        select: { id: true, email: true, firstName: true },
      })

      const lignesHtml = postesManquants.map((p) => `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #eee">${p.nom}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${p.requis}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:center">${p.pourvus}</td>
          <td style="padding:6px;border-bottom:1px solid #eee;text-align:center;color:#dc2626;font-weight:700">-${p.manquants}</td>
        </tr>
      `).join('')

      const html = emailLayout(`
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin-bottom:20px;">
          <strong style="color:#dc2626;">🔴 ${nbManquants} poste(s) non pourvu(s) — 48h avant la représentation</strong>
        </div>
        <p><strong>${rep.projet.title} · ${dateStr}</strong></p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f9fafb">
            <th style="padding:6px;text-align:left">Poste</th>
            <th style="padding:6px;text-align:center">Requis</th>
            <th style="padding:6px;text-align:center">Pourvus</th>
            <th style="padding:6px;text-align:center">Manquants</th>
          </tr></thead>
          <tbody>${lignesHtml}</tbody>
        </table>
        <p style="margin-top:16px">
          <a href="${baseUrl}/projets/${rep.projet.id}" style="background:#1a1a2e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700">Voir le planning →</a>
        </p>
      `)

      for (const reg of regisseurs) {
        await prisma.notification.create({
          data: {
            userId: reg.id,
            organizationId: rep.projet.organizationId,
            type: 'POSTE_NON_POURVU',
            priority: 'CRITIQUE',
            title: `🔴 ${rep.projet.title} · ${dateStr} — ${nbManquants} poste(s) non pourvu(s) (J-2)`,
            body: postesManquants.map((p) => `${p.nom}: ${p.manquants} manquant(s)`).join(' · '),
            link: `/projets/${rep.projet.id}`,
            relatedId: rep.id,
            relatedType: 'representation',
          },
        })

        await sendEmail({
          to: reg.email,
          subject: `🔴 Urgence — ${nbManquants} poste(s) non pourvu(s) · ${rep.projet.title} · ${dateStr}`,
          html,
        })
      }

      alertesJ2++
    }

    // ── ÉTAPE 3 — Archivage FDR passées ──────────────────
    const hier = new Date(maintenant)
    hier.setDate(hier.getDate() - 1)
    hier.setHours(23, 59, 59, 999)

    const { count: fdrCount } = await prisma.feuilleDeRoute.updateMany({
      where: {
        statut: 'PUBLIEE',
        representation: { date: { lt: maintenant } },
      },
      data: { statut: 'ARCHIVEE' },
    })
    fdrArchivees = fdrCount

    console.log(
      `[cron/alerte-postes] J-7: ${alertesJ7} alertes · J-2: ${alertesJ2} alertes · FDR archivées: ${fdrArchivees}`
    )

    return NextResponse.json({ alertesJ7, alertesJ2, fdrArchivees })
  } catch (err) {
    console.error('[cron/alerte-postes]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
