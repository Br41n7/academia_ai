import { useEffect, useRef, useState } from 'react';

interface CollaborationMessage {
  type: 'cursor' | 'edit' | 'presence';
  userId: string;
  userName: string;
  data: any;
}

export function useCollaboration(projectId: string, userId: string, userName: string) {
  const [activeUsers, setActiveUsers] = useState<Record<string, { name: string, lastSeen: number }>>({});
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number, y: number, name: string }>>({});
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}?projectId=${projectId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to collaboration server');
      // Send initial presence
      sendPresence();
    };

    socket.onmessage = (event) => {
      try {
        const message: CollaborationMessage = JSON.parse(event.data);
        
        if (message.type === 'presence') {
          setActiveUsers(prev => ({
            ...prev,
            [message.userId]: { name: message.userName, lastSeen: Date.now() }
          }));
        } else if (message.type === 'cursor') {
          setRemoteCursors(prev => ({
            ...prev,
            [message.userId]: { ...message.data, name: message.userName }
          }));
        }
      } catch (err) {
        console.error('Failed to parse collaboration message', err);
      }
    };

    const sendPresence = () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'presence',
          userId,
          userName,
          data: {}
        }));
      }
    };

    const presenceInterval = setInterval(sendPresence, 5000);

    return () => {
      clearInterval(presenceInterval);
      socket.close();
    };
  }, [projectId, userId, userName]);

  const sendCursor = (x: number, y: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'cursor',
        userId,
        userName,
        data: { x, y }
      }));
    }
  };

  return { activeUsers, remoteCursors, sendCursor };
}
