'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import socket from './lib/socket';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const log = (msg: string) => setMessages((prev) => [...prev, msg]);

    socket.on('connect', () => log(`✅ Conectado al servidor (id: ${socket.id})`));
    socket.on('disconnect', () => log('⚠️ Desconectado del servidor'));

    socket.on('roomCreated', (room: any) => {
      log(`🟢 Sala creada: ${room.id}`);
      router.push(`/room/${room.id}?name=${encodeURIComponent(playerName)}&creator=true`);
    });

    socket.on('roomJoined', (room: any) => {
      log(`🟡 Te uniste a la sala: ${room.id}`);
      router.push(`/room/${room.id}?name=${encodeURIComponent(playerName)}&creator=false`);
    });

    socket.on('errorJoining', (msg: string) => log(`❌ ${msg}`));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('errorJoining');
    };
  }, [router, playerName]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setMessages((prev) => [...prev, '⚠️ Ingresa tu nombre']);
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    socket.emit('createRoom', { roomId, playerName });
    setMessages((prev) => [...prev, `🎮 Creando sala ${roomId}...`]);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setMessages((prev) => [...prev, '⚠️ Ingresa tu nombre']);
      return;
    }
    const roomId = prompt('🔑 Ingresa el ID de la sala a la que deseas unirte:');
    if (!roomId) return;
    socket.emit('joinRoom', { roomId, playerName });
    setMessages((prev) => [...prev, `🚪 Intentando unirse a la sala ${roomId}...`]);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-green-200 to-yellow-100 p-8">
      <h1 className="text-5xl font-extrabold mb-8 text-green-800 text-center drop-shadow">
        🎲 Ludo Clásico
      </h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 w-full max-w-md">
        <input
          type="text"
          placeholder="Ingresa tu nombre"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          className="p-3 rounded-xl border border-green-500 w-full text-gray-900 placeholder-green-700 focus:outline-none focus:ring-4 focus:ring-green-400 bg-white/90"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <button
          onClick={handleCreateRoom}
          className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold w-full shadow-md transition-all duration-200"
        >
          🎮 Crear sala
        </button>
        <button
          onClick={handleJoinRoom}
          className="px-6 py-3 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 font-semibold w-full shadow-md transition-all duration-200"
        >
          🚪 Unirse a sala
        </button>
      </div>

      {messages.length > 0 && (
        <div className="w-full max-w-md mt-8">
          <h3 className="font-semibold mb-2 text-green-900">Mensajes:</h3>
          <ul className="border border-green-400 rounded-xl p-3 h-40 overflow-y-auto bg-white/80 backdrop-blur">
            {messages.map((msg, i) => (
              <li key={i} className="mb-1 text-green-800">{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
