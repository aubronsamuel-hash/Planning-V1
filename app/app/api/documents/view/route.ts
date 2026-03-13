// ─────────────────────────────────────────────────────────
// GET /api/documents/view?token=xxx — Accès document sécurisé
// Route publique — magic link DOCUMENT_ACCESS (1h)
// doc/06-regles-decisions.md Règles #10, #17
// Génère une signed URL S3 temporaire (1h max)
// ─────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDownloadPresignedUrl } from '@/lib/upload'
import { internalError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant.' }, { status: 400 })
    }

    // Valider le magic link DOCUMENT_ACCESS
    const magicToken = await prisma.magicLinkToken.findUnique({
      where: { token },
      select: {
        usedAt: true,
        expiresAt: true,
        purpose: true,
        metadata: true,
      },
    })

    if (!magicToken) {
      return NextResponse.json({ error: 'Lien invalide.' }, { status: 404 })
    }

    if (magicToken.purpose !== 'DOCUMENT_ACCESS') {
      return NextResponse.json({ error: 'Lien invalide pour cette action.' }, { status: 400 })
    }

    if (magicToken.usedAt) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé.' },
        { status: 410 }
      )
    }

    if (magicToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Ce lien a expiré. Demandez un nouveau lien d\'accès.' },
        { status: 410 }
      )
    }

    const metadata = magicToken.metadata as { documentId?: string } | null
    if (!metadata?.documentId) {
      return NextResponse.json({ error: 'Lien invalide (métadonnées manquantes).' }, { status: 400 })
    }

    // Récupérer le document
    const document = await prisma.document.findFirst({
      where: { id: metadata.documentId },
      select: { filename: true, mimeType: true, s3Key: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
    }

    // Invalider le token après usage (DOCUMENT_ACCESS = usage unique — Règle #17)
    await prisma.magicLinkToken.update({
      where: { token },
      data: { usedAt: new Date() },
    })

    // Générer une signed URL S3 temporaire (1h max — Règle #10)
    const downloadUrl = await getDownloadPresignedUrl(document.s3Key)

    return NextResponse.json({
      filename: document.filename,
      mimeType: document.mimeType,
      downloadUrl,
    })
  } catch (err) {
    console.error('[GET /api/documents/view]', err)
    return internalError()
  }
}
