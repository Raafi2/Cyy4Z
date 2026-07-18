import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LogoutButton from '@/components/LogoutButton'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  const adminPw = process.env.ADMIN_PASSWORD || 'admin123'
  if (!session || session.value !== adminPw) {
    redirect('/login')
  }

  return (
    <div style={{minHeight:'100vh', background:'var(--bg)'}}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'16px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)',
        position:'sticky', top:0, zIndex:50
      }}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
          <div style={{
            width:'34px', height:'34px',
            background:'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'16px', boxShadow:'0 0 20px rgba(99,102,241,0.3)'
          }}>📱</div>
          <span style={{fontWeight:700, fontSize:'1rem', background:'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>CloudPhone Panel</span>
        </div>
        <LogoutButton />
      </div>
      <div style={{padding:'24px'}}>
        {children}
      </div>
    </div>
  )
}
