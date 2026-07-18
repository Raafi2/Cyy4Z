'use strict';
const http = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Map of deviceId -> { agentWs: WebSocket|null, browsers: Set<WebSocket>, deviceInfo: object }
const deviceSessions = new Map();

function getOrCreateSession(deviceId) {
  if (!deviceSessions.has(deviceId)) {
    deviceSessions.set(deviceId, { agentWs: null, browsers: new Set(), deviceInfo: {} });
  }
  return deviceSessions.get(deviceId);
}

async function validateAgentWs(token) {
  // token format: deviceId:token
  const parts = token.split(':');
  if (parts.length < 2) return null;
  const deviceId = parts[0];
  const tok = parts.slice(1).join(':');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    await prisma.$disconnect();
    if (!device || device.token !== tok || device.deleted) return null;
    return device;
  } catch (e) {
    return null;
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const type = url.searchParams.get('type'); // 'agent' or 'browser'
    const deviceId = url.searchParams.get('deviceId');
    const token = url.searchParams.get('token');

    if (!deviceId) { ws.close(4001, 'Missing deviceId'); return; }

    if (type === 'agent') {
      // Validate agent token
      if (!token) { ws.close(4001, 'Missing token'); return; }
      const device = await validateAgentWs(token);
      if (!device) { ws.close(4003, 'Unauthorized'); return; }

      const session = getOrCreateSession(deviceId);
      // Close old agent if any
      if (session.agentWs && session.agentWs.readyState === WebSocket.OPEN) {
        session.agentWs.close();
      }
      session.agentWs = ws;
      console.log(`[WS] Agent connected: ${device.name} (${deviceId})`);

      ws.on('message', (data, isBinary) => {
        // Relay to all watching browsers
        const sess = deviceSessions.get(deviceId);
        if (!sess) return;
        for (const browser of sess.browsers) {
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(data, { binary: isBinary });
          }
        }
      });

      ws.on('close', () => {
        console.log(`[WS] Agent disconnected: ${deviceId}`);
        const sess = deviceSessions.get(deviceId);
        if (sess) sess.agentWs = null;
      });

      ws.on('error', (e) => console.error(`[WS] Agent error ${deviceId}:`, e.message));

    } else if (type === 'browser') {
      // Browser viewers - auth via query param (session token passed from frontend)
      const session = getOrCreateSession(deviceId);
      session.browsers.add(ws);
      console.log(`[WS] Browser connected to device: ${deviceId} (total: ${session.browsers.size})`);

      ws.on('message', (data, isBinary) => {
        // Forward control events to agent
        const sess = deviceSessions.get(deviceId);
        if (!sess || !sess.agentWs || sess.agentWs.readyState !== WebSocket.OPEN) return;
        sess.agentWs.send(data, { binary: isBinary });
      });

      ws.on('close', () => {
        const sess = deviceSessions.get(deviceId);
        if (sess) sess.browsers.delete(ws);
        console.log(`[WS] Browser disconnected from: ${deviceId}`);
      });

      ws.on('error', (e) => console.error(`[WS] Browser error:`, e.message));
    } else {
      ws.close(4002, 'Invalid type');
    }
  });

  server.listen(PORT, () => {
    console.log(`> CloudPhone Panel ready on http://localhost:${PORT}`);
  });
});
