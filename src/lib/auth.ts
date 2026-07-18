import { db } from './db'
import { cookies } from 'next/headers'

export async function validateAgent(req: Request) {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const [deviceId, token] = auth.slice(7).split(':')
  if (!deviceId || !token) return null
  try {
    const device = await db.device.findUnique({ where: { id: deviceId } })
    if (!device || device.token !== token) return null
    return device
  } catch {
    return null
  }
}

export async function isAdminAuthed(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin_session')
    const pw = process.env.ADMIN_PASSWORD || 'admin123'
    return session?.value === pw
  } catch {
    return false
  }
}
