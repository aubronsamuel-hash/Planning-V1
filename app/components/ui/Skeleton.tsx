// ─────────────────────────────────────────────────────────
// Skeleton — Composants de chargement squelette
// ─────────────────────────────────────────────────────────

// ── Bloc générique ─────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 animate-pulse rounded ${className}`} />
  )
}

// ── Lignes de texte ────────────────────────────────────────
export function SkeletonText({
  lines = 1,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 animate-pulse rounded ${
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  )
}

// ── Lignes de tableau ──────────────────────────────────────
export function SkeletonTableRows({
  rows = 5,
  cols = 5,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-gray-50">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className={`h-4 bg-gray-100 animate-pulse rounded ${
                  j === 0 ? 'w-32' : j === cols - 1 ? 'w-20 ml-auto' : 'w-full'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Grille calendrier ──────────────────────────────────────
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
// Cellules avec événements (déterministe, pas de Math.random)
const CELLS_WITH_ONE  = new Set([2, 5, 8, 10, 12, 15, 17, 20, 22, 24, 27, 29])
const CELLS_WITH_TWO  = new Set([5, 12, 22])

export function SkeletonCalendar() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* En-têtes jours */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {JOURS.map((j) => (
          <div
            key={j}
            className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide"
          >
            {j}
          </div>
        ))}
      </div>

      {/* Cases */}
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-28 border-r border-b border-gray-100 p-2">
            <div className="w-6 h-6 bg-gray-100 animate-pulse rounded-full mb-2" />
            {CELLS_WITH_ONE.has(i) && (
              <div className="space-y-1">
                <div className="h-5 bg-gray-100 animate-pulse rounded-md" />
                {CELLS_WITH_TWO.has(i) && (
                  <div className="h-5 bg-gray-100 animate-pulse rounded-md opacity-60" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Carte (dashboard) ──────────────────────────────────────
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 space-y-3 ${className}`}>
      <div className="h-4 w-1/3 bg-gray-100 animate-pulse rounded" />
      <div className="h-8 w-1/2 bg-gray-200 animate-pulse rounded" />
      <div className="h-3 w-2/3 bg-gray-100 animate-pulse rounded" />
    </div>
  )
}
