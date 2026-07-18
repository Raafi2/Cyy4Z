import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthed } from '@/lib/auth'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Logic removed per user request
  const devices = await db.device.findMany({
    where: { deleted: false },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 100 } },
    orderBy: { lastSeen: 'desc' }
  })
  return NextResponse.json({ devices })
}
