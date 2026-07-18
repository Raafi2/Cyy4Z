'use client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
      🚪 Logout
    </button>
  )
}
