'use client'
// ─────────────────────────────────────────────────────────
// ProjetsClient — Vue interactive liste/grille + modal création
// doc/04-pages-interfaces-ux.md §6.2
// ─────────────────────────────────────────────────────────
import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'

// ── Types ──────────────────────────────────────────────────
type ProjetSummary = {
  id: string
  title: string
  subtitle: string | null
  type: string
  status: string
  colorCode: string
  startDate: string | null
  endDate: string | null
  posterUrl: string | null
  regisseurId: string | null
  regisseurNom: string | null
  representationsCount: number
  collaborateursCount: number
}

type Membre = { userId: string; nom: string }

type Props = {
  projets: ProjetSummary[]
  membres: Membre[]
  canCreate: boolean
  currentUserId: string
}

// ── Constantes ─────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  THEATRE: 'Théâtre',
  COMEDIE_MUSICALE: 'Comédie musicale',
  CONCERT: 'Concert',
  OPERA: 'Opéra',
  DANSE: 'Danse',
  CIRQUE: 'Cirque',
  MAINTENANCE: 'Maintenance',
  EVENEMENT: 'Événement',
  AUTRE: 'Autre',
}

const STATUT_LABELS: Record<string, string> = {
  EN_PREPARATION: 'En préparation',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ARCHIVE: 'Archivé',
  ANNULE: 'Annulé',
}

const STATUT_COLORS: Record<string, string> = {
  EN_PREPARATION: 'text-blue-700 bg-blue-50',
  EN_COURS: 'text-green-700 bg-green-50',
  TERMINE: 'text-gray-600 bg-gray-100',
  ARCHIVE: 'text-gray-400 bg-gray-50',
  ANNULE: 'text-red-600 bg-red-50',
}

const PALETTE_COLORS = [
  { hex: '#6366F1', nom: 'Indigo' },
  { hex: '#8B5CF6', nom: 'Violet' },
  { hex: '#EC4899', nom: 'Rose' },
  { hex: '#EF4444', nom: 'Rouge' },
  { hex: '#F97316', nom: 'Orange' },
  { hex: '#EAB308', nom: 'Jaune' },
  { hex: '#22C55E', nom: 'Vert' },
  { hex: '#14B8A6', nom: 'Teal' },
  { hex: '#06B6D4', nom: 'Cyan' },
  { hex: '#3B82F6', nom: 'Bleu' },
  { hex: '#64748B', nom: 'Ardoise' },
  { hex: '#A16207', nom: 'Ambre' },
]

function formatPeriode(start: string | null, end: string | null): string {
  if (!start && !end) return '—'
  const opts: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }
  const s = start ? new Date(start).toLocaleDateString('fr-FR', opts) : null
  const e = end ? new Date(end).toLocaleDateString('fr-FR', opts) : null
  if (s && e) return `${s} → ${e}`
  if (s) return `Dès ${s}`
  return `Jusqu'à ${e}`
}

// ── Composant principal ────────────────────────────────────
export function ProjetsClient({ projets, membres, canCreate, currentUserId }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const { success, error: toastError } = useToast()

  // Filtres
  const [search, setSearch] = useState('')
  const [statutFiltre, setStatutFiltre] = useState('')
  const [anneeFiltre, setAnneeFiltre] = useState('')
  const [vue, setVue] = useState<'grille' | 'liste'>('grille')

  // Modal création
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    type: 'THEATRE',
    colorCode: '#6366F1',
    regisseurId: currentUserId,
    startDate: '',
    endDate: '',
  })

  // Années disponibles pour le filtre
  const annees = useMemo(() => {
    const ys = new Set<string>()
    projets.forEach((p) => {
      if (p.startDate) ys.add(new Date(p.startDate).getFullYear().toString())
      if (p.endDate) ys.add(new Date(p.endDate).getFullYear().toString())
    })
    return Array.from(ys).sort().reverse()
  }, [projets])

  // Filtrage
  const filtered = useMemo(() => {
    return projets.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
          !(p.subtitle?.toLowerCase().includes(search.toLowerCase()))) return false
      if (statutFiltre && p.status !== statutFiltre) return false
      if (anneeFiltre) {
        const y = parseInt(anneeFiltre)
        const startY = p.startDate ? new Date(p.startDate).getFullYear() : null
        const endY = p.endDate ? new Date(p.endDate).getFullYear() : null
        if (startY !== y && endY !== y) return false
      }
      return true
    })
  }, [projets, search, statutFiltre, anneeFiltre])

  // Création projet
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/projets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || undefined,
          type: form.type,
          colorCode: form.colorCode,
          regisseurId: form.regisseurId,
          startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
          endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        const msg = data.error ?? 'Une erreur est survenue'
        setCreateError(msg)
        toastError('Impossible de créer le projet', msg)
        return
      }
      const projet = await res.json()
      setModalOpen(false)
      setForm({ title: '', subtitle: '', type: 'THEATRE', colorCode: '#6366F1', regisseurId: currentUserId, startDate: '', endDate: '' })
      success('Projet créé !', form.title.trim())
      startTransition(() => router.push(`/projets/${projet.id}`))
    } catch {
      setCreateError('Impossible de contacter le serveur')
      toastError('Erreur réseau', 'Impossible de contacter le serveur')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6">
      {/* ── En-tête ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Projets</h1>
        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-primary"
          >
            + Nouveau projet
          </button>
        )}
      </div>

      {/* ── Filtres ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-52"
          />
        </div>

        <select
          value={statutFiltre}
          onChange={(e) => setStatutFiltre(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {annees.length > 0 && (
          <select
            value={anneeFiltre}
            onChange={(e) => setAnneeFiltre(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            <option value="">Toutes les années</option>
            {annees.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        {/* Toggle vue */}
        <div className="ml-auto flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setVue('liste')}
            className={`px-3 py-2 text-sm transition-colors ${vue === 'liste' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            title="Vue liste"
          >≡ Liste</button>
          <button
            onClick={() => setVue('grille')}
            className={`px-3 py-2 text-sm transition-colors ${vue === 'grille' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
            title="Vue grille"
          >⊞ Grille</button>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          {projets.length === 0 ? (
            <>
              <p className="text-4xl mb-4">🎭</p>
              <h2 className="text-lg font-medium text-gray-700 mb-2">Aucun projet pour l'instant</h2>
              <p className="text-sm text-gray-400 mb-6">Créez votre premier spectacle ou production.</p>
              {canCreate && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="btn btn-primary"
                >
                  + Créer un projet
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-400 text-sm">Aucun projet ne correspond aux filtres.</p>
              <button onClick={() => { setSearch(''); setStatutFiltre(''); setAnneeFiltre('') }} className="mt-2 text-sm text-indigo-600 hover:underline">
                Effacer les filtres
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Vue Grille ────────────────────────────────────── */}
      {vue === 'grille' && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/projets/${p.id}`}
              className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all overflow-hidden group"
            >
              {/* Bande colorCode */}
              <div className="flex">
                <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: p.colorCode }} />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700">
                        {p.title}
                      </h3>
                      {p.subtitle && (
                        <p className="text-xs text-gray-400 truncate">{p.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mb-3">
                    {TYPE_LABELS[p.type] ?? p.type}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>{p.representationsCount} représentations</span>
                    <span>·</span>
                    <span>{p.collaborateursCount} collaborateurs</span>
                  </div>

                  {(p.startDate || p.endDate) && (
                    <p className="text-xs text-gray-400 mb-3">
                      {formatPeriode(p.startDate, p.endDate)}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUT_COLORS[p.status] ?? 'text-gray-600 bg-gray-100'}`}>
                      ● {STATUT_LABELS[p.status] ?? p.status}
                    </span>
                    {p.regisseurNom && (
                      <span className="text-xs text-gray-400 truncate max-w-20">Rég. {p.regisseurNom}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Vue Liste ─────────────────────────────────────── */}
      {vue === 'liste' && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Période</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Régisseur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/projets/${p.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="w-1 h-5 rounded-full" style={{ backgroundColor: p.colorCode }} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.title}</p>
                    {p.subtitle && <p className="text-xs text-gray-400">{p.subtitle}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {TYPE_LABELS[p.type] ?? p.type}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {formatPeriode(p.startDate, p.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUT_COLORS[p.status] ?? ''}`}>
                      ● {STATUT_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {p.regisseurNom ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal Création projet ─────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { if (!creating) setModalOpen(false) }}
          />

          {/* Panneau */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Nouveau projet</h2>
              <button
                onClick={() => setModalOpen(false)}
                disabled={creating}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
              {/* Titre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre du projet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Peter Pan — Saison 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Sous-titre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sous-titre <span className="text-gray-400 font-normal">(facultatif)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Tournée nationale"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de projet <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Couleur — palette 12 couleurs (Règle #34) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Couleur du projet <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.nom}
                      onClick={() => setForm({ ...form, colorCode: c.hex })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        form.colorCode === c.hex
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Régisseur */}
              {membres.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Régisseur responsable <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.regisseurId}
                    onChange={(e) => setForm({ ...form, regisseurId: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    {membres.map((m) => (
                      <option key={m.userId} value={m.userId}>{m.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              {/* Erreur */}
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={creating}
                  className="btn btn-ghost"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.title.trim()}
                  className="btn btn-primary btn-lg"
                >
                  {creating ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Création…
                    </>
                  ) : 'Créer le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
