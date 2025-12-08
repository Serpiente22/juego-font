'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import socket from '../../lib/socket';

interface Player {
  id: string;
  name: string;
  color: 'red' | 'blue' | 'green' | 'yellow';
}

interface Room {
  id: string;
  players: Player[];
  status: 'waiting' | 'ready' | 'playing' | 'finished';
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params.id as string;
  const playerName = searchParams.get('name') || '';
  const isCreator = searchParams.get('creator') === 'true';

  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    const log = (m: string) => setMessages(prev => [...prev, m]);

    const handleRoomCreated = (room: Room) => {
      setCurrentRoom(room);
      log(`🟢 Sala creada: ${room.id}`);
    };

    const handleRoomJoined = (room: Room) => {
      setCurrentRoom(room);
      log(`🟡 Te uniste a la sala: ${room.id}`);
    };

    const handleRoomUpdated = (room: Room) => {
      // eliminar duplicados visuales si los hubiera
      const unique = room.players.filter(
        (p, i, arr) => arr.findIndex(x => x.id === p.id) === i
      );
      setCurrentRoom({ ...room, players: unique });
    };

    const handleErrorJoining = (msg: string) => log(`❌ ${msg}`);
    const handleGameInitialized = () => {
      setIsGameStarted(true);
      log('🎮 ¡Iniciando partida!');
      setTimeout(() => {
        router.push(`/game/${roomId}?name=${playerName}`);
      }, 400);
    };

    const handleMessage = (msg: string) => log(`📢 ${msg}`);

    socket.on('roomCreated', handleRoomCreated);
    socket.on('roomJoined', handleRoomJoined);
    socket.on('roomUpdated', handleRoomUpdated);
    socket.on('errorJoining', handleErrorJoining);
    socket.on('gameInitialized', handleGameInitialized);
    socket.on('message', handleMessage);

    // Si no es creador, unirse automáticamente
    if (!isCreator && playerName) {
      socket.emit('joinRoom', { roomId, playerName });
    } else if (isCreator && playerName) {
      socket.emit('createRoom', { roomId, playerName });
    }

    return () => {
      socket.off('roomCreated', handleRoomCreated);
      socket.off('roomJoined', handleRoomJoined);
      socket.off('roomUpdated', handleRoomUpdated);
      socket.off('errorJoining', handleErrorJoining);
      socket.off('gameInitialized', handleGameInitialized);
      socket.off('message', handleMessage);
    };
  }, [roomId, playerName, isCreator, router]);

  const startGame = () => {
    if (!currentRoom) return;
    socket.emit('startGame', { roomId: currentRoom.id });
  };

  const addBot = () => {
    if (!currentRoom) return;
    socket.emit('addBot', { roomId: currentRoom.id });
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-blue-100 to-green-100 p-8">
      <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center mb-4">
          🎲 Sala <span className="text-blue-600">{roomId}</span>
        </h1>

        {currentRoom ? (
          <div className="border border-blue-400 rounded-xl p-4 bg-white mb-4">
            <h2 className="font-semibold text-lg mb-2 text-blue-800">Jugadores ({currentRoom.players.length}/4):</h2>
            <ul className="space-y-1">
              {currentRoom.players.map(p => (
                <li key={p.id} className="font-semibold flex items-center gap-2">
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      background: p.color,
                      border: '2px solid black',
                    }}
                  />
                  <span style={{ color: p.color }}>{p.name}</span>
                  {p.id.startsWith('BOT-') && <span className="text-xs bg-gray-200 px-2 rounded-full text-gray-600">BOT</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-gray-500">
              Estado: <b>{currentRoom.status}</b>
            </p>

            {/* CONTROLES DEL CREADOR */}
            {isCreator && !isGameStarted && (
                <div className="flex flex-col gap-2 mt-4">
                    {currentRoom.players.length < 4 && (
                        <button
                            onClick={addBot}
                            className="w-full py-2 border-2 border-dashed border-gray-400 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                        >
                            🤖 Añadir Bot
                        </button>
                    )}
                    
                    {currentRoom.players.length >= 2 && (
                        <button
                            onClick={startGame}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold shadow-md transition-transform active:scale-95"
                        >
                            🎮 Iniciar Juego
                        </button>
                    )}
                </div>
            )}
            
            {!isCreator && (
                <p className="text-center text-gray-500 mt-4 italic">Esperando al anfitrión...</p>
            )}

          </div>
        ) : (
          <p className="text-center p-4">Cargando sala...</p>
        )}
      </div>

      <div className="w-full max-w-lg mt-6">
        <h3 className="font-bold text-blue-800">Mensajes</h3>
        <ul className="border border-blue-400 bg-white p-3 rounded-xl h-40 overflow-y-auto custom-scrollbar-elegant">
          {messages.map((m, i) => (
            <li key={i} className="text-sm border-b border-gray-100 last:border-0 py-1">{m}</li>
          ))}
        </ul>
      </div>

      <style jsx global>{`
        .custom-scrollbar-elegant::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-elegant::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}