// ─────────────────────────────────────────────────────────
// GET /api/planning/[projetId]/stream — SSE temps réel
// doc/23-architecture-technique.md §23.6
// Mises à jour push de la grille d'affectation
// ─────────────────────────────────────────────────────────
import { requireOrgSession, verifyOwnership } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/api-response'
import { eventBus } from '@/lib/event-bus'

export async function GET(req: Request, { params }: { params: { projetId: string } }) {
  const { session, error } = await requireOrgSession()
  if (error) return error

  // Vérifier que le projet appartient à l'org
  const projet = await prisma.projet.findFirst({ where: { id: params.projetId } })
  if (!projet) return notFound('Projet')

  const ownershipError = verifyOwnership(projet.organizationId, session.user.organizationId!)
  if (ownershipError) return ownershipError

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Connexion fermée — ignorer silencieusement
        }
      }

      // Ping toutes les 25s pour maintenir la connexion (Vercel / proxies)
      const ping = setInterval(() => send('ping', { type: 'ping' }), 25_000)

      // S'abonner au bus d'événements du projet
      const channel = `planning:${params.projetId}`
      const handler = (event: unknown) => {
        const e = event as { type: string }
        send(e.type, event)
      }
      eventBus.on(channel, handler)

      // Nettoyage quand le client se déconnecte
      req.signal.addEventListener('abort', () => {
        clearInterval(ping)
        eventBus.off(channel, handler)
        controller.close()
      })

      // Envoyer un premier ping pour signaler la connexion établie
      send('ping', { type: 'ping', message: 'Connexion établie' })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Désactive le buffering Nginx
    },
  })
}
