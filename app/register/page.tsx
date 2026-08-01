import RegisterForm from '@/components/auth/RegisterForm'
import VisitTracker from '@/components/VisitTracker'

export default function RegisterPage() {
  return (
    <>
      <VisitTracker page="register" />
      <RegisterForm />
    </>
  )
}
