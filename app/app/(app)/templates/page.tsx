'use client'
// ─────────────────────────────────────────────────────────
// Page /templates — Bibliothèque de templates de projets
// doc/08 §8.3 — Régisseur / Directeur
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'

type Template = {
  id: string
  name: string
  description: string | null
  projetType: string
  nbEquipes: number
  nbPostes: number
  createdAt: string
}

type ProjetLight = { id: string; title: string }

const TYPE_LABEL: Record<string, string> = {
  THEATRE:         '🎭 Théâtre',
  COMEDIE_MUSICALE:'🎭 Comédie musicale',
  CONCERT:         '🎤 Concert',
  OPERA:           '🎶 Opéra',
  DANSE:           '💃 Danse',
  CIRQUE:          '🎪 Cirque',
  MAINTENANCE:     '🔧 Maintenance',
  EVENEMENT:       '🎉 Événement',
  AUTRE:           '📌 Autre',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [projets, setProjets]     = useState<ProjetLight[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [applyModal, setApplyModal] = useState<Template | null>(null)

  useEffect(() => {
    async function load() {
      const [tr, pr] = await Promise.all([
        fetch('/api/templates').then((r) => r.json()),
        fetch('/api/projets').then((r) => r.json()),
      ])
      setTemplates(tr)
      setProjets(pr)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Templates de projets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Réutilisez une structure d'équipe existante</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Créer un template
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement…</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">📁</p>
          <p className="text-gray-500 text-sm mb-2">Aucun template pour le moment.</p>
          <p className="text-xs text-gray-400">Sauvegardez la structure d'un projet existant pour la réutiliser.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Créer mon premier template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{TYPE_LABEL[t.projetType] ?? t.projetType}</p>
                </div>
                <span className="text-xl">📁</span>
              </div>
              {t.description && <p className="text-sm text-gray-500 mb-3">{t.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
                <span>{t.nbEquipes} équipe{t.nbEquipes > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{t.nbPostes} poste{t.nbPostes > 1 ? 's' : ''}</span>
              </div>
              <button
                onClick={() => setApplyModal(t)}
                className="w-full px-3 py-2 border border-indigo-200 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Utiliser ce template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal : créer template depuis projet ────────── */}
      {showCreate && (
        <ModalCreerTemplate
          projets={projets}
          onClose={() => setShowCreate(false)}
          onSuccess={(t) => { setTemplates((prev) => [t, ...prev]); setShowCreate(false) }}
        />
      )}

      {/* ── Modal : appliquer template ───────────────────── */}
      {applyModal && (
        <ModalAppliquer
          template={applyModal}
          projets={projets}
          onClose={() => setApplyModal(null)}
        />
      )}
    </div>
  )
}

// ── Modal créer template ───────────────────────────────
function ModalCreerTemplate({
  projets,
  onClose,
  onSuccess,
}: {
  projets: ProjetLight[]
  onClose: () => void
  onSuccess: (t: Template) => void
}) {
  const [form, setForm] = useState({ projetId: '', name: '', description: '', inclureHoraires: true })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, inclureCollabs: false }),
      })
      if (!res.ok) throw new Error()
      const t = await res.json()
      onSuccess(t)
    } catch {
      setError('Erreur lors de la création du template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Créer un template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label-field">Projet source *</label>
            <select required className="input-field" value={form.projetId} onChange={(e) => setForm({ ...form, projetId: e.target.value })}>
              <option value="">Choisir un projet…</option>
              {projets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Nom du template *</label>
            <input required className="input-field" placeholder="ex: Structure comédie musicale" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label-field">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.inclureHoraires} onChange={(e) => setForm({ ...form, inclureHoraires: e.target.checked })} className="rounded" />
            Inclure les horaires par défaut des postes
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Création…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal appliquer template ───────────────────────────
function ModalAppliquer({
  template,
  projets,
  onClose,
}: {
  template: Template
  projets: ProjetLight[]
  onClose: () => void
}) {
  const [projetId, setProjetId] = useState('')
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleApply() {
    if (!projetId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/templates/${template.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId }),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
    } catch {
      setError('Erreur lors de l\'application du template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">Appliquer — {template.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <p className="text-4xl mb-3">✅</p>
              <p className="font-semibold text-gray-900">Template appliqué !</p>
              <p className="text-sm text-gray-500 mt-1">{template.nbEquipes} équipes et {template.nbPostes} postes créés.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg">Fermer</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Ce template créera <strong>{template.nbEquipes} équipe{template.nbEquipes > 1 ? 's' : ''}</strong> et <strong>{template.nbPostes} poste{template.nbPostes > 1 ? 's' : ''}</strong> dans le projet sélectionné.
              </p>
              <div>
                <label className="label-field">Projet cible *</label>
                <select className="input-field" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
                  <option value="">Choisir un projet…</option>
                  {projets.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Annuler</button>
                <button
                  onClick={handleApply}
                  disabled={!projetId || loading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Application…' : 'Appliquer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
