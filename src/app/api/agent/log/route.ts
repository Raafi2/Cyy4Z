import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateAgent } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const device = await validateAgent(req)
    if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { logs } = body
    if (!Array.isArray(logs) || logs.length === 0) return NextResponse.json({ ok: true })

    await db.log.createMany({
      data: logs.map((l: any) => ({
        deviceId: device.id,
        level: l.level || 'info',
        message: String(l.message || '')
      }))
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
