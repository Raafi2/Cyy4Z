import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { password } = await req.json()
  const adminPw = process.env.ADMIN_PASSWORD || 'admin123'
  if (password !== adminPw) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', adminPw, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30
  })
  return res
}
