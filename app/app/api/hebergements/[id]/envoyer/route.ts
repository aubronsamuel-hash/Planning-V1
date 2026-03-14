// ─────────────────────────────────────────────────────────
// POST /api/hebergements/[id]/envoyer — Envoyer la rooming list à l'hôtel
// doc/19-module-tournee.md §19.1.5
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { forbidden, internalError, notFound } from '@/lib/api-response'
import { sendEmail } from '@/lib/email'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR', write: true })
    if (error) return error

    const hebergement = await prisma.hebergement.findFirst({
      where: { id: params.id },
      include: {
        projet: {
          include: {
            organization: { select: { name: true, plan: true } },
          },
        },
        chambres: {
          include: {
            occupants: {
              include: {
                collaborateur: {
                  select: {
                    regimeAlimentaire: true,
                    allergies: true,
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
              },
              orderBy: { nuitDu: 'asc' },
            },
          },
          orderBy: { numero: 'asc' },
        },
      },
    })

    if (!hebergement) return notFound('Hébergement')
    if (hebergement.projet.organizationId !== session.user.organizationId!) return notFound('Hébergement')

    if (!hebergement.email) {
      return forbidden('Aucune adresse email configurée pour cet hébergement')
    }

    const orgName = hebergement.projet.organization.name
    const projetTitre = hebergement.projet.title
    const checkInFr = hebergement.checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const checkOutFr = hebergement.checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    // Construire le contenu HTML de l'email rooming list
    const regimesSpeciaux: string[] = []
    let chambresHtml = ''

    for (const chambre of hebergement.chambres) {
      if (chambre.occupants.length === 0) continue

      // Grouper occupants par nuit
      const nuitsMap = new Map<string, typeof chambre.occupants>()
      for (const occ of chambre.occupants) {
        const nuitStr = occ.nuitDu.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        if (!nuitsMap.has(nuitStr)) nuitsMap.set(nuitStr, [])
        nuitsMap.get(nuitStr)!.push(occ)
      }

      const typeLabel: Record<string, string> = {
        INDIVIDUELLE: 'Individuelle',
        DOUBLE: 'Double',
        DOUBLE_USAGE_SIMPLE: 'Double usage simple',
        SUITE: 'Suite',
      }

      chambresHtml += `<tr style="border-top:1px solid #e5e7eb;">
        <td style="padding:10px 8px;font-weight:600;">${chambre.numero ?? '—'}</td>
        <td style="padding:10px 8px;">${typeLabel[chambre.type] ?? chambre.type}</td>
        <td style="padding:10px 8px;">`

      Array.from(nuitsMap.entries()).forEach(([nuit, occs]) => {
        const noms = occs.map((o: { collaborateur: { user: { firstName: string; lastName: string } } }) =>
          `${o.collaborateur.user.firstName} ${o.collaborateur.user.lastName}`).join(', ')
        chambresHtml += `<div><strong>${nuit}</strong> : ${noms}</div>`
      })

      chambresHtml += `</td></tr>`

      // Collecter régimes spéciaux
      const uniqueCollab = new Map<string, (typeof chambre.occupants)[0]['collaborateur']>()
      for (const occ of chambre.occupants) {
        uniqueCollab.set(occ.collaborateurId, occ.collaborateur)
      }
      Array.from(uniqueCollab.values()).forEach((collab) => {
        const nom = `${collab.user.firstName} ${collab.user.lastName}`
        if (collab.regimeAlimentaire !== 'STANDARD') {
          const regimeLabel: Record<string, string> = {
            VEGETARIEN: 'végétarien',
            VEGAN: 'végétalien',
            SANS_PORC: 'sans porc',
            HALAL: 'halal',
            KASHER: 'kasher',
            AUTRE: 'régime spécial',
          }
          regimesSpeciaux.push(`${nom} (${regimeLabel[collab.regimeAlimentaire] ?? collab.regimeAlimentaire})`)
        }
        if (collab.allergies) {
          regimesSpeciaux.push(`${nom} — allergies : ${collab.allergies}`)
        }
      })
    }

    const regimesHtml = regimesSpeciaux.length > 0
      ? `<p style="margin-top:16px;"><strong>Régimes spéciaux :</strong> ${regimesSpeciaux.join(' · ')}</p>`
      : ''

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Rooming List</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <h1 style="margin:0 0 4px;font-size:20px;color:#1f2937;">Rooming List — ${projetTitre}</h1>
      <p style="margin:0 0 24px;color:#6b7280;">${checkInFr} → ${checkOutFr} · ${orgName}</p>

      <h2 style="font-size:16px;color:#374151;margin:0 0 12px;">${hebergement.nom}</h2>
      ${hebergement.adresse ? `<p style="margin:0 0 4px;color:#6b7280;">${hebergement.adresse}</p>` : ''}
      ${hebergement.telephone ? `<p style="margin:0 0 16px;color:#6b7280;">Tél. ${hebergement.telephone}</p>` : ''}

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;">Chambre</th>
            <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;">Type</th>
            <th style="padding:10px 8px;text-align:left;color:#6b7280;font-weight:600;">Occupants par nuit</th>
          </tr>
        </thead>
        <tbody>
          ${chambresHtml || '<tr><td colspan="3" style="padding:16px;color:#9ca3af;text-align:center;">Aucune chambre avec occupants assignés</td></tr>'}
        </tbody>
      </table>

      ${regimesHtml}

      <p style="margin-top:24px;color:#6b7280;font-size:13px;">
        Contact : ${session.user.name ?? session.user.email} — ${session.user.email}
      </p>
    </div>
  </div>
</body>
</html>`

    const emailResult = await sendEmail({
      to: hebergement.email,
      subject: `Rooming List — ${projetTitre} · ${checkInFr.split(' ').slice(0, 2).join(' ')} - ${checkOutFr}`,
      html,
      replyTo: session.user.email ?? undefined,
    })

    if (!emailResult.success) {
      console.error('[POST /api/hebergements/[id]/envoyer] Email failed:', emailResult.error)
      return internalError()
    }

    // Mettre à jour roomingListEnvoyeeAt + log
    await prisma.$transaction([
      prisma.hebergement.update({
        where: { id: params.id },
        data: { roomingListEnvoyeeAt: new Date() },
      }),
      prisma.activityLog.create({
        data: {
          action: 'ROOMING_LIST_ENVOYEE',
          entityType: 'Hebergement',
          entityId: params.id,
          userId: session.user.id,
          metadata: { projetId: hebergement.projetId, emailDest: hebergement.email },
        },
      }),
    ])

    return NextResponse.json({ success: true, envoyeeAt: new Date().toISOString() })
  } catch (err) {
    console.error('[POST /api/hebergements/[id]/envoyer]', err)
    return internalError()
  }
}
