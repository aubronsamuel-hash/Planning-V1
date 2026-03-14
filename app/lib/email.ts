// ─────────────────────────────────────────────────────────
// Wrapper Resend — emails transactionnels
// doc/24-emails-templates.md
// Décision #18 : Resend SDK TypeScript
// ─────────────────────────────────────────────────────────
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`

type SendEmailOptions = {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailOptions) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    })

    if (error) {
      console.error('[sendEmail] Resend error:', error)
      return { success: false, error }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[sendEmail] Unexpected error:', err)
    return { success: false, error: err }
  }
}

// ── Layout commun ─────────────────────────────────────────
function emailLayout(content: string, previewText = 'Spectacle SaaS'): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${previewText}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
      <div style="background:#6366F1;padding:24px 32px;">
        <span style="color:#fff;font-size:20px;font-weight:700;">🎭 Spectacle SaaS</span>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
      <div style="padding:16px 32px;border-top:1px solid #f0f0f0;text-align:center;color:#888;font-size:12px;">
        Spectacle SaaS &nbsp;·&nbsp;
        <a href="mailto:support@spectacle-saas.fr" style="color:#6366F1;text-decoration:none;">Support</a>
      </div>
    </div>
  </div>
</body>
</html>`
}

function primaryBtn(href: string, label: string): string {
  return `<p style="text-align:center;margin:28px 0;">
    <a href="${href}" style="background:#6366F1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">${label}</a>
  </p>`
}

// ── Templates ─────────────────────────────────────────────
// Chaque template est une fonction qui retourne du HTML.
// Les templates complets sont définis dans doc/24-emails-templates.md

export function magicLinkEmail({
  firstName,
  magicLink,
  purpose,
  expiresInMinutes,
}: {
  firstName: string
  magicLink: string
  purpose: string
  expiresInMinutes: number
}): string {
  const purposeLabel: Record<string, string> = {
    LOGIN: 'connexion',
    CONFIRMATION: 'confirmation de votre affectation',
    ACTIVATION: 'activation de votre compte',
    PLANNING_VIEW: 'consultation de votre planning',
    EMAIL_CHANGE: 'confirmation de votre nouvel email',
    DOCUMENT_ACCESS: 'accès au document',
  }

  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${firstName},</h2>
    <p>Cliquez sur le lien ci-dessous pour votre <strong>${purposeLabel[purpose] ?? purpose}</strong> :</p>
    ${primaryBtn(magicLink, 'Accéder →')}
    <p style="color:#888;font-size:13px;">Ce lien expire dans ${expiresInMinutes} minutes et ne peut être utilisé qu'une seule fois.</p>
    <p style="color:#888;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
  `, 'Votre lien de connexion')
}

// ── 24.2.2 — Activation compte (GHOST → MEMBER) ───────────
export function activationEmail({
  firstName,
  organizationName,
  invitedByName,
  activationUrl,
  expiresInDays = 7,
}: {
  firstName: string
  organizationName: string
  invitedByName: string
  activationUrl: string
  expiresInDays?: number
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${firstName},</h2>
    <p><strong>${invitedByName}</strong> vous invite à rejoindre <strong>${organizationName}</strong> sur Spectacle SaaS.</p>
    <p>Activez votre compte en cliquant ci-dessous. Ce lien est valable ${expiresInDays} jours.</p>
    ${primaryBtn(activationUrl, 'Activer mon compte →')}
    <p style="color:#888;font-size:13px;">Une fois activé, vous pourrez consulter votre planning, confirmer vos affectations et accéder à vos documents de travail.</p>
  `, `${organizationName} vous invite sur Spectacle SaaS`)
}

// ── 24.2.3 — Changement d'email ───────────────────────────
export function emailChangeEmail({
  firstName,
  newEmail,
  confirmUrl,
  expiresInHours = 24,
}: {
  firstName: string
  newEmail: string
  confirmUrl: string
  expiresInHours?: number
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${firstName},</h2>
    <p>Vous avez demandé à changer votre adresse email pour : <strong>${newEmail}</strong></p>
    <p>Confirmez ce changement en cliquant ci-dessous. Ce lien expire dans ${expiresInHours} heures.</p>
    ${primaryBtn(confirmUrl, 'Confirmer mon adresse →')}
    <p style="color:#888;font-size:13px;">Si vous n'avez pas fait cette demande, votre ancienne adresse restera active.</p>
  `, 'Confirmez votre nouvelle adresse email')
}

// ── 24.2.4 — Invitation membre organisation ───────────────
export function invitationMembreEmail({
  firstName,
  organizationName,
  invitedByName,
  roleLabel,
  invitationUrl,
  isNewUser,
}: {
  firstName: string
  organizationName: string
  invitedByName: string
  roleLabel: string
  invitationUrl: string
  isNewUser: boolean
}): string {
  const action = isNewUser ? 'Activez votre compte' : 'Connectez-vous'
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${firstName},</h2>
    <p><strong>${invitedByName}</strong> vous ajoute à l'organisation <strong>${organizationName}</strong> en tant que <strong>${roleLabel}</strong>.</p>
    ${primaryBtn(invitationUrl, `${action} →`)}
  `, `Vous rejoignez ${organizationName} sur Spectacle SaaS`)
}

// ── 24.3.1 — Confirmation d'affectation demandée ──────────
export function affectationConfirmationEmail({
  collaborateurPrenom,
  projetTitre,
  representationTitre,
  representationDate,
  representationLieu,
  posteLabel,
  confirmUrl,
  refuserUrl,
  expiresInDays = 7,
}: {
  collaborateurPrenom: string
  projetTitre: string
  representationTitre: string
  representationDate: string
  representationLieu: string
  posteLabel: string
  confirmUrl: string
  refuserUrl: string
  expiresInDays?: number
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>Vous êtes sollicité(e) pour la représentation suivante :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Projet</td><td style="padding:6px 0;font-weight:600;">${projetTitre}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Représentation</td><td style="padding:6px 0;font-weight:600;">${representationTitre}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${representationDate}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Lieu</td><td style="padding:6px 0;font-weight:600;">${representationLieu}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Poste</td><td style="padding:6px 0;font-weight:600;">${posteLabel}</td></tr>
    </table>
    <p style="text-align:center;margin:28px 0;">
      <a href="${confirmUrl}" style="background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-right:12px;">✅ Confirmer ma présence</a>
      <a href="${refuserUrl}" style="background:#f4f4f5;color:#374151;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;border:1px solid #e5e7eb;">Je suis indisponible</a>
    </p>
    <p style="color:#888;font-size:13px;">Ce lien est valable ${expiresInDays} jours.</p>
  `, `Confirmation demandée — ${representationTitre} · ${representationDate}`)
}

// ── 24.3.2 — Refus d'affectation (notification régisseur) ─
export function affectationRefusEmail({
  regisseurPrenom,
  collaborateurNomComplet,
  posteLabel,
  representationTitre,
  representationDate,
  planningUrl,
}: {
  regisseurPrenom: string
  collaborateurNomComplet: string
  posteLabel: string
  representationTitre: string
  representationDate: string
  planningUrl: string
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${regisseurPrenom},</h2>
    <p><strong>${collaborateurNomComplet}</strong> a refusé le poste de <strong>${posteLabel}</strong> pour la représentation <strong>${representationTitre}</strong> du <strong>${representationDate}</strong>.</p>
    <p>Vous devez trouver un remplaçant pour ce poste.</p>
    ${primaryBtn(planningUrl, 'Voir le planning →')}
  `, `${collaborateurNomComplet} a refusé — ${posteLabel} · ${representationDate}`)
}

// ── 24.3.3 — Annulation d'affectation ─────────────────────
export function affectationAnnulationEmail({
  collaborateurPrenom,
  representationTitre,
  representationDate,
  posteLabel,
  motifAnnulation,
  estTardive,
}: {
  collaborateurPrenom: string
  representationTitre: string
  representationDate: string
  posteLabel: string
  motifAnnulation?: string | null
  estTardive: boolean
}): string {
  const tardiveMsg = estTardive
    ? `<p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:16px 0;">⚠️ Cette annulation intervient dans un délai court avant la représentation.</p>`
    : ''
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>Votre affectation a été annulée :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Représentation</td><td style="padding:6px 0;font-weight:600;">${representationTitre}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${representationDate}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Poste</td><td style="padding:6px 0;font-weight:600;">${posteLabel}</td></tr>
      ${motifAnnulation ? `<tr><td style="padding:6px 0;color:#666;">Motif</td><td style="padding:6px 0;">${motifAnnulation}</td></tr>` : ''}
    </table>
    ${tardiveMsg}
  `, `Affectation annulée — ${representationTitre} · ${representationDate}`)
}

// ── 24.3.4 — Remplacement urgent proposé ─────────────────
export function remplacementUrgentEmail({
  collaborateurPrenom,
  posteLabel,
  representationTitre,
  representationDate,
  representationLieu,
  urgenceMessage,
  confirmUrl,
  refuserUrl,
}: {
  collaborateurPrenom: string
  posteLabel: string
  representationTitre: string
  representationDate: string
  representationLieu: string
  urgenceMessage: string
  confirmUrl: string
  refuserUrl: string
}): string {
  return emailLayout(`
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
      <strong style="color:#dc2626;">⚡ REMPLACEMENT URGENT</strong>
    </div>
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>${urgenceMessage}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Poste</td><td style="padding:6px 0;font-weight:600;">${posteLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Représentation</td><td style="padding:6px 0;font-weight:600;">${representationTitre}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;color:#dc2626;">${representationDate}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Lieu</td><td style="padding:6px 0;font-weight:600;">${representationLieu}</td></tr>
    </table>
    <p style="text-align:center;margin:28px 0;">
      <a href="${confirmUrl}" style="background:#22c55e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-right:12px;">✅ J'accepte</a>
      <a href="${refuserUrl}" style="background:#f4f4f5;color:#374151;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;border:1px solid #e5e7eb;">Je décline</a>
    </p>
  `, `Remplacement urgent — ${posteLabel} · ${representationDate}`)
}

// ── 24.4.1 — Feuille de route publiée ────────────────────
export function feuilleDeRouteEmail({
  collaborateurPrenom,
  representationTitre,
  representationDate,
  representationLieu,
  posteLabel,
  heureConvocation,
  planningUrl,
}: {
  collaborateurPrenom: string
  representationTitre: string
  representationDate: string
  representationLieu: string
  posteLabel: string
  heureConvocation?: string | null
  planningUrl: string
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>La feuille de route pour votre prochaine représentation est disponible :</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Représentation</td><td style="padding:6px 0;font-weight:600;">${representationTitre}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;font-weight:600;">${representationDate}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Lieu</td><td style="padding:6px 0;font-weight:600;">${representationLieu}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Votre poste</td><td style="padding:6px 0;font-weight:600;">${posteLabel}</td></tr>
      ${heureConvocation ? `<tr><td style="padding:6px 0;color:#666;">Convocation</td><td style="padding:6px 0;font-weight:600;color:#6366F1;">${heureConvocation}</td></tr>` : ''}
    </table>
    ${primaryBtn(planningUrl, 'Voir la feuille de route →')}
  `, `Feuille de route — ${representationTitre} · ${representationDate}`)
}

// ── 24.4.2 — Annulation / report de représentation ───────
export function representationAnnulationEmail({
  collaborateurPrenom,
  representationTitre,
  representationDate,
  isReporte,
  nouvelleDateStr,
}: {
  collaborateurPrenom: string
  representationTitre: string
  representationDate: string
  isReporte: boolean
  nouvelleDateStr?: string | null
}): string {
  const msg = isReporte
    ? `La représentation <strong>${representationTitre}</strong> du <strong>${representationDate}</strong> a été <strong>reportée</strong>${nouvelleDateStr ? ` au <strong>${nouvelleDateStr}</strong>` : ''}. Votre affectation sera mise à jour.`
    : `La représentation <strong>${representationTitre}</strong> du <strong>${representationDate}</strong> a été <strong>annulée</strong>. Toutes les affectations sont annulées.`
  const subj = isReporte
    ? `Représentation reportée — ${representationTitre} · ${representationDate}`
    : `Représentation annulée — ${representationTitre} · ${representationDate}`
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>${msg}</p>
  `, subj)
}

// ── 24.5.1 — Accès document (magic link) ─────────────────
export function documentAccessEmail({
  collaborateurPrenom,
  documentNom,
  documentType,
  accessUrl,
  expiresInHours = 1,
}: {
  collaborateurPrenom: string
  documentNom: string
  documentType: string
  accessUrl: string
  expiresInHours?: number
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>Un document vous a été partagé :</p>
    <p style="background:#f4f4f5;padding:12px 16px;border-radius:8px;font-weight:600;">📄 ${documentNom} <span style="font-weight:400;color:#666;">(${documentType})</span></p>
    ${primaryBtn(accessUrl, 'Accéder au document →')}
    <p style="color:#888;font-size:13px;">Ce lien est valable ${expiresInHours} heure${expiresInHours > 1 ? 's' : ''} et ne peut être utilisé qu'une seule fois.</p>
  `, `Document disponible — ${documentNom}`)
}

// ── 24.5.2 — Accès planning (magic link) ─────────────────
export function planningAccessEmail({
  collaborateurPrenom,
  projetTitre,
  nbRepresentations,
  planningUrl,
}: {
  collaborateurPrenom: string
  projetTitre: string
  nbRepresentations: number
  planningUrl: string
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${collaborateurPrenom},</h2>
    <p>Votre planning pour le projet <strong>${projetTitre}</strong> est disponible : <strong>${nbRepresentations} représentation${nbRepresentations > 1 ? 's' : ''}</strong>.</p>
    ${primaryBtn(planningUrl, 'Voir mon planning →')}
    <p style="color:#888;font-size:13px;">Ce lien est valable 7 jours.</p>
  `, `Votre planning — ${projetTitre}`)
}

// ── 24.6.1 — Trial se termine bientôt ────────────────────
export function trialEndingEmail({
  directeurPrenom,
  organizationName,
  daysLeft,
  trialEndDate,
  upgradeUrl,
}: {
  directeurPrenom: string
  organizationName: string
  daysLeft: number
  trialEndDate: string
  upgradeUrl: string
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${directeurPrenom},</h2>
    <p>La période d'essai de <strong>${organizationName}</strong> se termine dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong> (le ${trialEndDate}).</p>
    <p>Choisissez un plan pour continuer à accéder à toutes les fonctionnalités sans interruption.</p>
    ${primaryBtn(upgradeUrl, 'Choisir un plan →')}
  `, `Votre période d'essai se termine dans ${daysLeft} jours`)
}

// ── 24.6.2 — Trial expiré ────────────────────────────────
export function trialExpiredEmail({
  directeurPrenom,
  organizationName,
  upgradeUrl,
  featuresLost,
}: {
  directeurPrenom: string
  organizationName: string
  upgradeUrl: string
  featuresLost: string[]
}): string {
  const featuresList = featuresLost.map(f => `<li>${f}</li>`).join('')
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${directeurPrenom},</h2>
    <p>La période d'essai de <strong>${organizationName}</strong> a expiré. Votre compte est maintenant en lecture seule.</p>
    <p>Fonctionnalités désactivées :</p>
    <ul style="color:#666;line-height:1.8;">${featuresList}</ul>
    ${primaryBtn(upgradeUrl, 'Réactiver mon compte →')}
  `, `Votre période d'essai a expiré — ${organizationName}`)
}

// ── 24.6.3 — Paiement échoué ─────────────────────────────
export function paymentFailedEmail({
  directeurPrenom,
  organizationName,
  montant,
  portalUrl,
  retryDate,
}: {
  directeurPrenom: string
  organizationName: string
  montant: string
  portalUrl: string
  retryDate?: string | null
}): string {
  return emailLayout(`
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin-bottom:20px;">
      <strong style="color:#dc2626;">🔴 Action requise — Problème de paiement</strong>
    </div>
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${directeurPrenom},</h2>
    <p>Le prélèvement de <strong>${montant}</strong> pour <strong>${organizationName}</strong> a échoué.</p>
    ${retryDate ? `<p style="color:#666;font-size:14px;">Prochaine tentative prévue le ${retryDate}.</p>` : ''}
    <p>Mettez à jour votre moyen de paiement pour éviter la suspension de votre compte.</p>
    ${primaryBtn(portalUrl, 'Mettre à jour mon paiement →')}
  `, 'Problème de paiement — action requise')
}

// ── 24.7.1 — RGPD avertissement anonymisation ─────────────
export function rgpdWarningEmail({
  userPrenom,
  anonymizeDate,
  reactivationUrl,
}: {
  userPrenom: string
  anonymizeDate: string
  reactivationUrl: string
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${userPrenom},</h2>
    <p>Votre compte Spectacle SaaS est inactif depuis plus de 2 ans. Conformément à notre politique RGPD, il sera <strong>anonymisé le ${anonymizeDate}</strong>.</p>
    <p>Si vous souhaitez conserver votre compte, cliquez ci-dessous pour le réactiver.</p>
    ${primaryBtn(reactivationUrl, 'Conserver mon compte →')}
    <p style="color:#888;font-size:13px;">Si vous ne souhaitez pas conserver votre compte, vous n'avez rien à faire.</p>
  `, 'Votre compte sera supprimé dans 30 jours')
}

// ── 19.1.5 — Rooming List hôtel (Module Tournée) ─────────
type ChambreEmail = {
  numero?: string | null
  type: string
  occupants: {
    nuitDu: Date
    notes?: string | null
    collaborateur: {
      user: { firstName: string; lastName: string }
      regimeAlimentaire: string
      allergies?: string | null
    }
  }[]
}

export function roomingListEmail({
  organisationNom,
  projetTitre,
  hebergementNom,
  hebergementAdresse,
  checkIn,
  checkOut,
  chambres,
  regisseurNom,
  regisseurEmail,
}: {
  organisationNom: string
  projetTitre: string
  hebergementNom: string
  hebergementAdresse?: string | null
  checkIn: Date
  checkOut: Date
  chambres: ChambreEmail[]
  regisseurNom: string
  regisseurEmail: string
}): string {
  const dateRangeStr = `${checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`

  const typeChambreLabel: Record<string, string> = {
    INDIVIDUELLE: 'Individuelle',
    DOUBLE: 'Double',
    DOUBLE_USAGE_SIMPLE: 'Double usage simple',
    SUITE: 'Suite',
  }
  const regimeLabel: Record<string, string> = {
    STANDARD: 'Standard',
    VEGETARIEN: 'Végétarien',
    VEGAN: 'Végétalien',
    SANS_PORC: 'Sans porc',
    HALAL: 'Halal',
    KASHER: 'Kasher',
    AUTRE: 'Régime spécial',
  }

  // Grouper occupants par chambre × nuit
  const chambresRows = chambres.map(c => {
    const nuitsMap = new Map<string, string[]>()
    c.occupants.forEach(o => {
      const key = o.nuitDu.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      if (!nuitsMap.has(key)) nuitsMap.set(key, [])
      nuitsMap.get(key)!.push(`${o.collaborateur.user.firstName} ${o.collaborateur.user.lastName}`)
    })
    const nuitsStr = Array.from(nuitsMap.entries())
      .map(([date, noms]) => `${date} : ${noms.join(', ')}`)
      .join(' · ')

    const totalOccupants = new Set(c.occupants.map(o => `${o.collaborateur.user.firstName} ${o.collaborateur.user.lastName}`))
    const nbAdultes = totalOccupants.size
    const occupantsStr = Array.from(totalOccupants).join(' + ')

    return `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:10px 8px;font-weight:600;">${c.numero ?? '—'}</td>
      <td style="padding:10px 8px;">${typeChambreLabel[c.type] ?? c.type}</td>
      <td style="padding:10px 8px;">${occupantsStr} (${nbAdultes} adulte${nbAdultes > 1 ? 's' : ''})</td>
      <td style="padding:10px 8px;color:#666;font-size:13px;">${nuitsStr}</td>
    </tr>`
  }).join('')

  // Régimes spéciaux
  const regimesSpeciaux: string[] = []
  chambres.forEach(c => {
    const seen = new Set<string>()
    c.occupants.forEach(o => {
      const nom = `${o.collaborateur.user.firstName} ${o.collaborateur.user.lastName}`
      if (!seen.has(nom)) {
        seen.add(nom)
        const regime = o.collaborateur.regimeAlimentaire
        const allergies = o.collaborateur.allergies
        if (regime && regime !== 'STANDARD') {
          regimesSpeciaux.push(`${nom} (${regimeLabel[regime] ?? regime}${allergies ? ` · ${allergies}` : ''})`)
        } else if (allergies) {
          regimesSpeciaux.push(`${nom} (allergies : ${allergies})`)
        }
      }
    })
  })

  const regimesBlock = regimesSpeciaux.length > 0
    ? `<p style="margin-top:20px;padding:12px 16px;background:#fefce8;border-left:4px solid #eab308;border-radius:4px;font-size:14px;">
        <strong>Régimes alimentaires spéciaux :</strong><br>
        ${regimesSpeciaux.join('<br>')}
       </p>`
    : ''

  const totalChambres = chambres.length
  const checkInFr = checkIn.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const checkOutFr = checkOut.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Rooming List — ${projetTitre}</h2>
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-dessous la liste des chambres pour le groupe <strong>${organisationNom}</strong>, du ${dateRangeStr}.</p>
    ${hebergementAdresse ? `<p style="color:#666;font-size:13px;">📍 ${hebergementAdresse}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <thead>
        <tr style="background:#f4f4f5;">
          <th style="padding:10px 8px;text-align:left;">Chambre</th>
          <th style="padding:10px 8px;text-align:left;">Type</th>
          <th style="padding:10px 8px;text-align:left;">Occupant(s)</th>
          <th style="padding:10px 8px;text-align:left;">Nuits</th>
        </tr>
      </thead>
      <tbody>
        ${chambresRows}
      </tbody>
    </table>
    <p style="font-size:14px;color:#374151;">
      <strong>Total :</strong> ${totalChambres} chambre${totalChambres > 1 ? 's' : ''}<br>
      <strong>Arrivée :</strong> ${checkInFr}<br>
      <strong>Départ :</strong> ${checkOutFr}
    </p>
    ${regimesBlock}
    <p style="margin-top:24px;font-size:14px;">Contact régisseur : <strong>${regisseurNom}</strong> — <a href="mailto:${regisseurEmail}" style="color:#6366F1;">${regisseurEmail}</a></p>
    <p style="font-size:13px;color:#888;">Cordialement,<br>${organisationNom}</p>
  `, `Rooming List — ${projetTitre} · ${dateRangeStr}`)
}

// ── 24.7.2 — DPAE envoyée ────────────────────────────────
export function dpaeEnvoyeeEmail({
  rhPrenom,
  collaborateurNomComplet,
  dateDebut,
  numeroDpae,
}: {
  rhPrenom: string
  collaborateurNomComplet: string
  dateDebut: string
  numeroDpae?: string | null
}): string {
  return emailLayout(`
    <h2 style="margin-top:0;color:#1a1a2e;">Bonjour ${rhPrenom},</h2>
    <p>La DPAE pour <strong>${collaborateurNomComplet}</strong> a bien été envoyée.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Collaborateur</td><td style="padding:6px 0;font-weight:600;">${collaborateurNomComplet}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Date de début</td><td style="padding:6px 0;font-weight:600;">${dateDebut}</td></tr>
      ${numeroDpae ? `<tr><td style="padding:6px 0;color:#666;">N° DPAE (URSSAF)</td><td style="padding:6px 0;font-weight:600;">${numeroDpae}</td></tr>` : ''}
    </table>
    <p style="color:#22c55e;font-weight:600;">✅ DPAE enregistrée</p>
  `, `DPAE envoyée — ${collaborateurNomComplet}`)
}
