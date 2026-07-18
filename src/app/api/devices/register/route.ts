import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, androidVersion } = body
    const token = crypto.randomUUID() + '-' + Date.now().toString(36)
    const device = await db.device.create({
      data: {
        name: name || 'Unknown Device',
        token,
        androidVersion: androidVersion || null,
        status: 'online',
        onlineSince: new Date(),
        lastSeen: new Date()
      }
    })
    return NextResponse.json({ deviceId: device.id, token: device.token })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 })
  }
}
