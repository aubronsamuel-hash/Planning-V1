// ─────────────────────────────────────────────────────────
// Layout pages publiques — /login, /signup
// Pas de sidebar, centré, fond neutre
// ─────────────────────────────────────────────────────────
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header minimal — logo + nom app */}
      <header className="h-16 flex items-center px-6 border-b border-gray-100 bg-white">
        <span className="text-xl font-semibold text-indigo-600">🎭 Spectacle Vivant</span>
      </header>

      {/* Contenu centré */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  )
}
