import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { validateAgent } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const device = await validateAgent(req)
    if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // If device was deleted, tell agent to stop
    if (device.deleted) {
      return NextResponse.json({ deleted: true })
    }

    const body = await req.json()
    const { cpu, ram_used, ram_total, storage_free, storage_total, ip, screen_width, screen_height, clipboard } = body

    const now = new Date()
    const isComingOnline = device.status === 'offline'

    await db.device.update({
      where: { id: device.id },
      data: {
        lastSeen: now,
        status: 'online',
        ipAddress: ip || device.ipAddress,
        cpuUsage: cpu ?? device.cpuUsage,
        ramUsed: ram_used ?? device.ramUsed,
        ramTotal: ram_total ?? device.ramTotal,
        storageFree: storage_free ?? device.storageFree,
        storageTotal: storage_total ?? device.storageTotal,
        screenWidth: screen_width ?? device.screenWidth,
        screenHeight: screen_height ?? device.screenHeight,
        clipboard: clipboard || device.clipboard,
        onlineSince: isComingOnline ? now : device.onlineSince
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
