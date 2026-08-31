import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import url from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';

import { authenticateToken } from './server/middleware/auth.js';
import documentsRouter from './server/routes/documents.js';
import aiRouter from './server/routes/ai.js';
import researchRouter from './server/routes/research.js';
import projectsRouter from './server/routes/projects.js';
import profilesRouter from './server/routes/profiles.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_PROD = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    env: IS_PROD ? 'production' : 'development',
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    ts: new Date().toISOString()
  });
});

// Protected routes
app.use('/api/documents', authenticateToken, documentsRouter);
app.use('/api/ai', aiRouter);           // auth handled inside route
app.use('/api/research', authenticateToken, researchRouter);
app.use('/api/projects', authenticateToken, projectsRouter);
app.use('/api/profiles', authenticateToken, profilesRouter);

// Global error handler (must be last middleware)
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred.'
  });
});

async function startServer() {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // WebSocket — real-time collaboration
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Set<WebSocket>>();

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url || '').pathname;
    if (pathname === '/collab') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const parsed = url.parse(request.url || '', true);
    const projectId = (parsed.query.projectId as string) || 'default';

    if (!rooms.has(projectId)) rooms.set(projectId, new Set());
    rooms.get(projectId)!.add(ws);

    ws.on('message', (data) => {
      try {
        const msg = data.toString();
        const room = rooms.get(projectId);
        if (!room) return;
        for (const client of room) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msg);
          }
        }
      } catch {}
    });

    ws.on('close', () => {
      rooms.get(projectId)?.delete(ws);
      if (rooms.get(projectId)?.size === 0) rooms.delete(projectId);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅  Academia AI  |  http://localhost:${PORT}`);
    console.log(`   Gemini:  ${process.env.GEMINI_API_KEY ? '✓' : '✗ MISSING'}`);
    console.log(`   Groq:    ${process.env.GROQ_API_KEY ? '✓' : '✗ MISSING'}`);
    console.log(`   Env:     ${IS_PROD ? 'production' : 'development'}\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
