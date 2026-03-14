// ─────────────────────────────────────────────────────────
// GET /api/feuille-de-route/[id]/pdf
// Export HTML print-ready de la feuille de route
// Rendu imprimable en PDF via le navigateur (Ctrl+P / window.print)
// doc §11.8 — Feuille de route & Logistique
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrgSession } from '@/lib/auth'
import { internalError, notFound, forbidden } from '@/lib/api-response'

const PHASE_ICONS: Record<string, string> = {
  DECHARGEMENT: '📦',
  MONTAGE: '🔧',
  BALANCES: '🎛️',
  CATERING: '🍽️',
  ECHAUFFEMENT: '🎭',
  REPRESENTATION: '🎭',
  ENTRACTE: '⏸️',
  DEMONTAGE: '📦',
  PAUSE: '☕',
  AUTRE: '📋',
}

const PHASE_LABELS: Record<string, string> = {
  DECHARGEMENT: 'Déchargement',
  MONTAGE: 'Montage',
  BALANCES: 'Balances',
  CATERING: 'Catering',
  ECHAUFFEMENT: 'Échauffement',
  REPRESENTATION: 'Représentation',
  ENTRACTE: 'Entracte',
  DEMONTAGE: 'Démontage',
  PAUSE: 'Pause',
  AUTRE: 'Autre',
}

const CONTACT_LABELS: Record<string, string> = {
  VENUE: 'Salle',
  CATERING: 'Catering',
  SECURITE: 'Sécurité',
  HOTEL: 'Hôtel',
  URGENCE: 'Urgence',
  AUTRE: 'Contact',
}

function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { session, error } = await requireOrgSession({ minRole: 'REGISSEUR' })
    if (error) return error

    const fdr = await prisma.feuilleDeRoute.findFirst({
      where: { id: params.id },
      include: {
        representation: {
          include: {
            projet: {
              select: { organizationId: true, title: true },
            },
            affectations: {
              where: {
                deletedAt: null,
                confirmationStatus: { notIn: ['ANNULEE', 'ANNULEE_TARDIVE', 'REFUSEE'] },
              },
              include: {
                collaborateur: {
                  include: {
                    user: { select: { firstName: true, lastName: true } },
                  },
                },
                posteRequis: {
                  include: {
                    equipe: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        phases: { orderBy: { ordre: 'asc' } },
        contacts: { orderBy: [{ type: 'asc' }, { nom: 'asc' }] },
      },
    })

    if (!fdr) return notFound('Feuille de route')

    if (fdr.representation.projet.organizationId !== session.user.organizationId!) {
      return forbidden()
    }

    const rep = fdr.representation
    const projet = rep.projet
    const dateStr = new Date(rep.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Grouper les affectations par équipe
    const parEquipe = new Map<string, { equipeNom: string; membres: typeof rep.affectations }>()
    for (const aff of rep.affectations) {
      const equipeNom = aff.posteRequis.equipe?.name ?? 'Équipe'
      if (!parEquipe.has(equipeNom)) {
        parEquipe.set(equipeNom, { equipeNom, membres: [] })
      }
      parEquipe.get(equipeNom)!.membres.push(aff)
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feuille de route — ${esc(projet.title)} · ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #111;
      background: white;
      padding: 24px;
    }
    .header {
      border-bottom: 2px solid #1a1a2e;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header h1 { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .header .meta { font-size: 13px; color: #555; margin-top: 4px; }
    .header .venue { font-size: 14px; color: #333; margin-top: 6px; }
    .statut-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      background: ${fdr.statut === 'PUBLIEE' ? '#d1fae5' : '#fef3c7'};
      color: ${fdr.statut === 'PUBLIEE' ? '#065f46' : '#92400e'};
      margin-left: 8px;
    }
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1a1a2e;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }
    .phase-row {
      display: flex;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .phase-time {
      width: 48px;
      font-weight: 700;
      color: #1a1a2e;
      flex-shrink: 0;
    }
    .phase-icon { width: 20px; flex-shrink: 0; }
    .phase-content { flex: 1; }
    .phase-label { font-weight: 600; }
    .phase-detail { color: #555; font-size: 11px; margin-top: 2px; }
    .contact-row {
      padding: 5px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .contact-name { font-weight: 600; }
    .contact-detail { color: #555; font-size: 11px; }
    .equipe-block { margin-bottom: 10px; }
    .equipe-name { font-weight: 700; font-size: 12px; color: #374151; margin-bottom: 4px; }
    .membre-row {
      display: flex;
      gap: 8px;
      padding: 3px 0;
      font-size: 11px;
    }
    .membre-nom { font-weight: 500; min-width: 140px; }
    .membre-poste { color: #6b7280; }
    .membre-horaires { color: #374151; margin-left: auto; }
    .notes-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      color: #374151;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      text-align: right;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>
      🗺️ Feuille de route
      <span class="statut-badge">${esc(fdr.statut)}</span>
    </h1>
    <div class="meta">${esc(projet.title)} · ${dateStr}</div>
    ${rep.venueName || rep.venueCity ? `<div class="venue">📍 ${[rep.venueName, rep.venueCity, rep.venueAddress].filter(Boolean).map(esc).join(' — ')}</div>` : ''}
  </div>

  <div class="two-col">
    <!-- Colonne gauche : déroulé -->
    <div>
      ${fdr.phases.length > 0 ? `
      <div class="section">
        <div class="section-title">Déroulé de la journée</div>
        ${fdr.phases.map((phase) => `
          <div class="phase-row">
            <div class="phase-time">${esc(phase.startTime)}</div>
            <div class="phase-icon">${PHASE_ICONS[phase.type] ?? '📋'}</div>
            <div class="phase-content">
              <div class="phase-label">
                ${esc(phase.labelCustom ?? PHASE_LABELS[phase.type] ?? phase.type)}
                ${phase.endTime ? `<span style="font-weight:400;color:#6b7280"> → ${esc(phase.endTime)}</span>` : ''}
              </div>
              ${phase.lieu ? `<div class="phase-detail">📍 ${esc(phase.lieu)}</div>` : ''}
              ${phase.notes ? `<div class="phase-detail">${esc(phase.notes)}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${fdr.transportInfo ? `
      <div class="section">
        <div class="section-title">Transport</div>
        <div class="notes-box">${esc(fdr.transportInfo)}</div>
      </div>
      ` : ''}

      ${fdr.notesGenerales ? `
      <div class="section">
        <div class="section-title">Notes générales</div>
        <div class="notes-box">${esc(fdr.notesGenerales)}</div>
      </div>
      ` : ''}
    </div>

    <!-- Colonne droite : équipe + contacts -->
    <div>
      ${rep.affectations.length > 0 ? `
      <div class="section">
        <div class="section-title">Équipe (${rep.affectations.length})</div>
        ${Array.from(parEquipe.values()).map(({ equipeNom, membres }) => `
          <div class="equipe-block">
            <div class="equipe-name">${esc(equipeNom)}</div>
            ${membres.map((aff) => `
              <div class="membre-row">
                <span class="membre-nom">
                  ${esc(aff.collaborateur.user.firstName)} ${esc(aff.collaborateur.user.lastName)}
                </span>
                <span class="membre-poste">${esc(aff.posteRequis.name)}</span>
                ${aff.startTime && aff.endTime ? `<span class="membre-horaires">${esc(aff.startTime)} → ${esc(aff.endTime)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${fdr.contacts.length > 0 ? `
      <div class="section">
        <div class="section-title">Contacts locaux</div>
        ${fdr.contacts.map((contact) => `
          <div class="contact-row">
            <div class="contact-name">${esc(contact.nom)} · <span style="font-weight:400;color:#6b7280">${CONTACT_LABELS[contact.type] ?? contact.type}</span></div>
            ${contact.role ? `<div class="contact-detail">${esc(contact.role)}</div>` : ''}
            ${contact.telephone ? `<div class="contact-detail">📞 ${esc(contact.telephone)}</div>` : ''}
            ${contact.email ? `<div class="contact-detail">✉️ ${esc(contact.email)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  </div>

  <div class="footer">
    Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · Planning Spectacle
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[GET /api/feuille-de-route/[id]/pdf]', err)
    return internalError()
  }
}
