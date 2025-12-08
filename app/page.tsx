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

    socket.on('connect', () => log(`✅ Conectado (ID: ${socket.id})`));
    socket.on('disconnect', () => log('⚠️ Desconectado'));

    socket.on('roomCreated', (room: any) => {
      router.push(`/room/${room.id}?name=${encodeURIComponent(playerName)}&creator=true`);
    });

    socket.on('roomJoined', (room: any) => {
      router.push(`/room/${room.id}?name=${encodeURIComponent(playerName)}&creator=false`);
    });

    socket.on('errorJoining', (msg: string) => {
        log(`❌ ${msg}`);
        alert(msg); // Alerta visual rápida también
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomCreated');
      socket.off('roomJoined');
      socket.off('errorJoining');
    };
  }, [router, playerName]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) return alert('Por favor, escribe tu nombre.');
    const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    socket.emit('createRoom', { roomId, playerName });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) return alert('Por favor, escribe tu nombre.');
    const roomId = prompt('Ingresa el CÓDIGO de la sala:');
    if (!roomId) return;
    socket.emit('joinRoom', { roomId, playerName });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 text-gray-800 p-6 font-sans">
      
      {/* Tarjeta Principal */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Header Decorativo */}
        <div className="bg-white p-8 pb-4 text-center">
            <div className="flex justify-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <div className="w-4 h-4 rounded-full bg-yellow-400"></div>
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-1">LUDO</h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">Multiplayer Online</p>
        </div>

        <div className="p-8 pt-2 flex flex-col gap-6">
          
          {/* Input Nombre */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Tu Nombre</label>
            <input
              type="text"
              placeholder="Ej. Josue"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:font-normal"
            />
          </div>

          <div className="flex flex-col gap-3">
             {/* Botón Crear */}
            <button
              onClick={handleCreateRoom}
              className="group relative w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 overflow-hidden"
            >
              <span className="relative z-10">Crear Nueva Sala</span>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            </button>

            {/* Separador */}
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-300 text-xs uppercase font-bold">o entra a una</span>
                <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Botón Unirse */}
            <button
              onClick={handleJoinRoom}
              className="w-full py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-lg hover:border-gray-400 hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
            >
              <span>Unirse con Código</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
            </button>
          </div>

        </div>

        {/* Logs discretos */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase mb-2">Estado de conexión</div>
            <div className="h-16 overflow-y-auto space-y-1 pr-2">
                {messages.length === 0 && <p className="text-xs text-gray-400 italic">Esperando acciones...</p>}
                {messages.map((msg, i) => (
                    <div key={i} className="text-xs text-gray-600 truncate flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> {msg}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}