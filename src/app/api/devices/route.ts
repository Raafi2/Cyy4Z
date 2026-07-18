import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthed } from '@/lib/auth'

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Auto-mark offline if no ping in 30s
  await db.device.updateMany({
    where: {
      deleted: false,
      status: { not: 'offline' },
      lastSeen: { lt: new Date(Date.now() - 30_000) }
    },
    data: { status: 'offline' }
  })
  const devices = await db.device.findMany({
    where: { deleted: false },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 100 } },
    orderBy: { lastSeen: 'desc' }
  })
  return NextResponse.json({ devices })
}
