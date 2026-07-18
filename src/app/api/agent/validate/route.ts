import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const deviceId = url.searchParams.get('deviceId')
    const token = url.searchParams.get('token')

    if (!deviceId || !token) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const actualToken = token.includes(':') ? token.split(':').slice(1).join(':') : token

    const device = await db.device.findUnique({ where: { id: deviceId } })
    
    if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (device.token !== actualToken) return NextResponse.json({ error: 'Token mismatch' }, { status: 401 })
    if (device.deleted) return NextResponse.json({ error: 'Deleted' }, { status: 403 })

    return NextResponse.json({ ok: true, name: device.name })
  } catch (e) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
