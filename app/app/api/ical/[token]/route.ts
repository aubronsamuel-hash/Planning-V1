// ─────────────────────────────────────────────────────────
// GET /api/ical/[token] — Feed iCal public (protégé par token uniquement)
// Pas de session requise — authentification par User.icalToken
// Exporte uniquement les affectations CONFIRMEE ou NON_REQUISE
// Format : iCalendar RFC 5545 — Timezone Europe/Paris
// CLAUDE.md : iCal → exporter uniquement statut CONFIRMEE
// ─────────────────────────────────────────────────────────
import { prisma } from '@/lib/prisma'
import logger from '@/lib/logger'

type RouteParams = { params: { token: string } }

// ── Helpers de formatage iCalendar ────────────────────────

/**
 * Formate une date + heure "HH:MM" en ISO 8601 basic local (Europe/Paris)
 * ex: date=2026-03-15, time="20:00" → "20260315T200000"
 */
function formatIcalDateTime(date: Date, timeStr: string): string {
  // Extraire année, mois, jour de la date (stockée en UTC minuit)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')

  // Extraire HH:MM de la chaîne horaire
  const [hh, min] = timeStr.split(':')

  return `${yyyy}${mm}${dd}T${hh.padStart(2, '0')}${min.padStart(2, '0')}00`
}

/**
 * Formate la date/heure courante en UTC pour DTSTAMP
 * ex: "20260309T143000Z"
 */
function formatDtstamp(d: Date): string {
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`
}

/**
 * Échappe les caractères spéciaux iCalendar (RFC 5545 §3.3.11)
 */
function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

/**
 * Plie les lignes iCalendar à 75 octets (RFC 5545 §3.1)
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  chunks.push(line.slice(0, 75))
  let i = 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

// ── GET — Feed iCal ───────────────────────────────────────
export async function GET(_req: Request, { params }: RouteParams) {
  const { token } = params

  // Trouver l'utilisateur par icalToken
  const user = await prisma.user.findFirst({
    where: { icalToken: token },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!user) {
    return new Response('Not Found', { status: 404 })
  }

  // Trouver le record collaborateur associé (peut exister dans plusieurs orgs)
  // On charge toutes les affectations confirmées ou non_requises
  const collaborateurs = await prisma.collaborateur.findMany({
    where: { userId: user.id },
    select: { id: true },
  })

  const collaborateurIds = collaborateurs.map((c) => c.id)

  // Charger les affectations CONFIRMEE ou NON_REQUISE
  const affectations = await prisma.affectation.findMany({
    where: {
      collaborateurId: { in: collaborateurIds },
      confirmationStatus: { in: ['CONFIRMEE', 'NON_REQUISE'] },
      deletedAt: null,
    },
    include: {
      representation: {
        select: {
          date: true,
          venueName: true,
          venueCity: true,
          getInTime: true,
          showStartTime: true,
          showEndTime: true,
          projet: {
            select: { title: true },
          },
        },
      },
    },
    orderBy: { representation: { date: 'asc' } },
  })

  const dtstamp = formatDtstamp(new Date())

  // Construire les VEVENTs
  const vevents = affectations.map((a) => {
    const rep = a.representation
    const projetTitle = escapeIcal(rep.projet.title)
    const posteLabel = escapeIcal(a.posteLabel ?? '')
    const venueName = escapeIcal(rep.venueName ?? '')
    const venueCity = escapeIcal(rep.venueCity ?? '')
    const location = [venueName, venueCity].filter(Boolean).join(', ')

    // Horaires : utiliser startTime/endTime de l'affectation
    // Fallback sur showStartTime/showEndTime de la représentation
    const startTimeStr = a.startTime ?? rep.showStartTime ?? '00:00'
    const endTimeStr = a.endTime ?? rep.showEndTime ?? '23:59'

    const dtstart = formatIcalDateTime(rep.date, startTimeStr)
    const dtend = formatIcalDateTime(rep.date, endTimeStr)

    // Rémunération en euros (stockée en centimes)
    const cachetEuros = a.remuneration != null ? (a.remuneration / 100).toFixed(2) : null
    const description = cachetEuros
      ? `Rémunération prévue: ${cachetEuros}€ HT`
      : ''

    const lines = [
      'BEGIN:VEVENT',
      foldLine(`UID:${a.id}@spectacle-saas.fr`),
      foldLine(`DTSTAMP:${dtstamp}`),
      foldLine(`DTSTART;TZID=Europe/Paris:${dtstart}`),
      foldLine(`DTEND;TZID=Europe/Paris:${dtend}`),
      foldLine(`SUMMARY:${projetTitle} — ${posteLabel}`),
      ...(location ? [foldLine(`LOCATION:${location}`)] : []),
      ...(description ? [foldLine(`DESCRIPTION:${escapeIcal(description)}`)] : []),
      'END:VEVENT',
    ]

    return lines.join('\r\n')
  })

  // Construire le calendrier complet
  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Spectacle SaaS//Planning//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:Mon planning Spectacle SaaS`),
    'X-WR-TIMEZONE:Europe/Paris',
    // Définition VTIMEZONE minimale pour Europe/Paris
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Paris',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(calendar, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="planning.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
