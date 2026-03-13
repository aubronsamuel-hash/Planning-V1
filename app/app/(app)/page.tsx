import { redirect } from 'next/navigation'

// Redirige la racine vers le dashboard
export default function RootPage() {
  redirect('/dashboard')
}
