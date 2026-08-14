import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import url from 'url';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Load config safely without ESM assert syntax
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8')
);

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      )
    });
  } else {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
}

// Get Firestore reference using getFirestore() with specific named database if it exists
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(admin.apps[0]!, firebaseConfig.firestoreDatabaseId)
  : getFirestore(admin.apps[0]!);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// CORS configuration
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: IS_PROD ? allowedOrigin : '*',
  credentials: true,
}));

app.use(express.json());

// Import Routers
import documentsRouter from './server/routes/documents.js';
import researchRouter from './server/routes/research.js';
import aiRouter from './server/routes/ai.js';

// Mount API Routes
app.use('/api/documents', documentsRouter);
app.use('/api/research', researchRouter);
app.use('/api/ai', aiRouter);

/**
 * GET /api/health
 * No authentication required health indicator
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    gemini: !!process.env.GEMINI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    ts: new Date().toISOString()
  });
});

// Co-host WebSocket Server on the same HTTP server
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Room management: Map<projectId, Set<WebSocket>>
const rooms = new Map<string, Set<WebSocket>>();

server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/collab') {
    const projectId = parsedUrl.query.projectId as string;
    if (!projectId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Allow Vite dev server upgrades through
    if (!IS_PROD) {
      // Let Vite dev server handle websocket upgrades if needed
    } else {
      socket.destroy();
    }
  }
});

wss.on('connection', (ws, request) => {
  const parsedUrl = url.parse(request.url || '', true);
  const projectId = parsedUrl.query.projectId as string;

  if (!projectId) {
    ws.close();
    return;
  }

  let room = rooms.get(projectId);
  if (!room) {
    room = new Set();
    rooms.set(projectId, room);
  }
  room.add(ws);

  console.log(`[WebSocket] Client connected to room: ${projectId}. Active clients in room: ${room.size}`);

  ws.on('message', (message) => {
    // Broadcast to all other sockets in the same room
    const currentRoom = rooms.get(projectId);
    if (currentRoom) {
      for (const client of currentRoom) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  });

  ws.on('close', () => {
    const currentRoom = rooms.get(projectId);
    if (currentRoom) {
      currentRoom.delete(ws);
      console.log(`[WebSocket] Client disconnected from room: ${projectId}. Remaining clients: ${currentRoom.size}`);
      if (currentRoom.size === 0) {
        rooms.delete(projectId);
        console.log(`[WebSocket] Room ${projectId} cleaned up.`);
      }
    }
  });
});

// Static File Serving & Vite integration based on environment
async function setupFrontend() {
  if (IS_PROD) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }
}

// Global unhandled error handler middleware as the LAST registered middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Error]', err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred.'
  });
});

// Initialize Frontend serving, and listen
setupFrontend().then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] Co-hosted unified service running in ${IS_PROD ? 'production' : 'development'} on port ${PORT}`);
  });
}).catch((err) => {
  console.error('[Server Start Failure]', err);
});
