import { redirect } from 'next/navigation'

// Alias en inglés → página canónica en español.
export default function PrivacyRedirect() {
  redirect('/privacidad')
}
