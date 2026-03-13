// ─────────────────────────────────────────────────────────
// Event Bus — SSE temps réel (planning grille régisseur)
// doc/23-architecture-technique.md §23.6
// ⚠️ EventEmitter in-process : pas multi-instance.
//    Si plusieurs pods Vercel → migrer vers Redis Pub/Sub.
// ─────────────────────────────────────────────────────────
import { EventEmitter } from 'events'

type SseEvent = {
  type:
    | 'affectation_updated'
    | 'affectation_created'
    | 'poste_alert'
    | 'representation_updated'
    | 'fdr_published'
    | 'ping'
  payload?: Record<string, unknown>
}

class EventBus extends EventEmitter {
  subscribe(channel: string, handler: (event: SseEvent) => void): () => void {
    this.on(channel, handler)
    return () => this.off(channel, handler)
  }

  publish(channel: string, event: SseEvent): void {
    this.emit(channel, event)
  }
}

// Singleton global (hot reload Next.js safe)
const globalForBus = globalThis as unknown as { eventBus: EventBus | undefined }
export const eventBus = globalForBus.eventBus ?? new EventBus()
if (process.env.NODE_ENV !== 'production') globalForBus.eventBus = eventBus
eventBus.setMaxListeners(200) // une connexion SSE par tab ouverte
