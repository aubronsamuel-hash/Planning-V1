'use client'
// ─────────────────────────────────────────────────────────
// Page /documents/view/[token] — Accès document sécurisé
// Accessible sans connexion via magic link DOCUMENT_ACCESS
// doc/06-regles-decisions.md Règle #10, #17
// Génère une signed URL S3 temporaire (1h max)
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type DocumentInfo = {
  filename: string
  mimeType: string
  downloadUrl: string // signed URL S3 — expiration 1h
}

export default function DocumentViewPage() {
  const { token } = useParams<{ token: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [doc, setDoc] = useState<DocumentInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Lien invalide.')
      setIsLoading(false)
      return
    }

    async function fetchDocument() {
      try {
        const res = await fetch(`/api/documents/view?token=${token}`)
        const json = await res.json()

        if (!res.ok) {
          setError(json.error ?? 'Lien invalide ou expiré.')
          return
        }

        setDoc(json)

        // Ouvrir automatiquement le document dans un nouvel onglet
        if (json.downloadUrl) {
          window.open(json.downloadUrl, '_blank', 'noopener,noreferrer')
        }
      } catch {
        setError('Erreur réseau. Vérifiez votre connexion.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocument()
  }, [token])

  const isPdf = doc?.mimeType === 'application/pdf'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6">
        <span className="text-xl font-semibold text-indigo-600">🎭 Spectacle Vivant</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {isLoading && (
            <>
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-gray-500">Préparation du document…</p>
            </>
          )}

          {error && (
            <>
              <div className="text-4xl mb-4">❌</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide ou expiré</h2>
              <p className="text-gray-600 text-sm">{error}</p>
              <p className="text-gray-400 text-sm mt-4">
                Contactez votre régisseur pour obtenir un nouveau lien.
              </p>
            </>
          )}

          {doc && !error && (
            <>
              <div className="text-4xl mb-4">{isPdf ? '📄' : '📎'}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{doc.filename}</h2>
              <p className="text-gray-500 text-sm mb-6">
                Votre document s'est ouvert dans un nouvel onglet.
                <br />
                S'il ne s'est pas ouvert automatiquement :
              </p>
              <a
                href={doc.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
              >
                Ouvrir le document →
              </a>
              <p className="text-xs text-gray-400 mt-6">
                Ce lien de téléchargement est valable 1 heure.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
