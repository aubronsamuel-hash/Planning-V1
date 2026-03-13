import { redirect } from 'next/navigation'

// /settings → redirige vers /settings/compte par défaut
export default function SettingsPage() {
  redirect('/settings/compte')
}
