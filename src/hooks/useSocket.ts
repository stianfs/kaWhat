'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

export function useSocket(): Socket {
  const socketRef = useRef<Socket>(getSocket());

  useEffect(() => {
    const s = socketRef.current;
    if (!s.connected) {
      s.connect();
    }
    return () => {
      // Don't disconnect on unmount — we want persistent connection
    };
  }, []);

  return socketRef.current;
}
