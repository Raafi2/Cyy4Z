import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthed } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const device = await db.device.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: 'desc' }, take: 200 } }
  })
  if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(device)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  // Mark as deleted so agent knows to stop on next ping
  await db.device.update({ where: { id }, data: { deleted: true, status: 'offline' } })
  return NextResponse.json({ ok: true })
}
