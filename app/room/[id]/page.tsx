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

  // Colores de UI para mapear
  const colorMap: Record<string, string> = {
    red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-400'
  };

  useEffect(() => {
    const log = (m: string) => setMessages(prev => [m, ...prev].slice(0, 10)); // Solo últimos 10

    const handleRoomUpdated = (room: Room) => {
      // Filtrar duplicados visuales
      const unique = room.players.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      setCurrentRoom({ ...room, players: unique });
    };

    const handleGameInitialized = () => {
      setIsGameStarted(true);
      setTimeout(() => router.push(`/game/${roomId}?name=${playerName}`), 500);
    };

    socket.on('roomCreated', (r) => { setCurrentRoom(r); log('Sala creada'); });
    socket.on('roomJoined', (r) => { setCurrentRoom(r); log('Te uniste'); });
    socket.on('roomUpdated', handleRoomUpdated);
    socket.on('gameInitialized', handleGameInitialized);
    socket.on('message', (m) => log(m));
    socket.on('errorJoining', (m) => { log(m); alert(m); });

    if (!isCreator && playerName) socket.emit('joinRoom', { roomId, playerName });
    else if (isCreator && playerName) socket.emit('createRoom', { roomId, playerName });

    return () => {
        socket.off('roomCreated'); socket.off('roomJoined'); socket.off('roomUpdated');
        socket.off('gameInitialized'); socket.off('message'); socket.off('errorJoining');
    };
  }, [roomId, playerName, isCreator, router]);

  const startGame = () => currentRoom && socket.emit('startGame', { roomId: currentRoom.id });
  const addBot = () => currentRoom && socket.emit('addBot', { roomId: currentRoom.id });

  const copyCode = () => {
    navigator.clipboard.writeText(roomId);
    alert('Código copiado al portapapeles');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 font-sans">
      
      {/* Header Sala */}
      <div className="text-center mb-8">
        <h2 className="text-gray-400 font-bold tracking-widest uppercase text-xs mb-2">Sala de Espera</h2>
        <div 
            onClick={copyCode}
            className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors group"
        >
            <span className="text-4xl font-black text-gray-800 tracking-wider">{roomId}</span>
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        </div>
        <p className="text-gray-400 text-xs mt-2">Toca el código para copiar y compartir</p>
      </div>

      {/* Grid de Jugadores (Metáfora del Ludo) */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
        {Array.from({ length: 4 }).map((_, i) => {
            const player = currentRoom?.players[i];
            // Asignar colores fijos a las posiciones si quieres, o dinámicos según el jugador
            const slotColor = player ? colorMap[player.color] : 'bg-gray-100';
            const borderColor = player ? `border-${player.color}-500` : 'border-dashed border-gray-300';
            
            return (
                <div key={i} className={`relative h-32 rounded-2xl border-2 ${player ? 'border-transparent shadow-lg bg-white' : 'border-dashed border-gray-200 bg-gray-50'} flex flex-col items-center justify-center transition-all`}>
                    {player ? (
                        <>
                            <div className={`w-12 h-12 rounded-full mb-2 ${colorMap[player.color]} shadow-inner flex items-center justify-center text-white font-bold text-lg`}>
                                {player.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-800 truncate w-full text-center px-2">{player.name}</span>
                            {player.id.startsWith('BOT-') && <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500 mt-1">BOT</span>}
                        </>
                    ) : (
                        <span className="text-gray-300 font-medium text-sm">Vacío</span>
                    )}
                </div>
            );
        })}
      </div>

      {/* Controles */}
      <div className="w-full max-w-md space-y-3">
        {currentRoom ? (
            <>
                {isCreator ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                             <button 
                                onClick={addBot} 
                                disabled={currentRoom.players.length >= 4}
                                className="flex-1 py-3 bg-white border border-gray-300 text-gray-600 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                             >
                                + Bot
                             </button>
                             {/* Aquí podrías poner botón de expulsar o ajustes */}
                        </div>

                        <button 
                            onClick={startGame}
                            disabled={currentRoom.players.length < 2}
                            className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {currentRoom.players.length < 2 ? 'Esperando jugadores...' : 'Comenzar Partida'}
                        </button>
                    </div>
                ) : (
                    <div className="bg-white p-4 rounded-xl text-center border border-gray-100 shadow-sm">
                        <div className="animate-pulse flex justify-center mb-2">
                             <span className="w-2 h-2 bg-blue-500 rounded-full mx-1"></span>
                             <span className="w-2 h-2 bg-blue-500 rounded-full mx-1 animation-delay-200"></span>
                             <span className="w-2 h-2 bg-blue-500 rounded-full mx-1 animation-delay-400"></span>
                        </div>
                        <p className="text-gray-500 font-medium">Esperando al líder...</p>
                    </div>
                )}
            </>
        ) : (
             <p className="text-gray-400">Conectando...</p>
        )}
      </div>

      {/* Mini Log */}
      <div className="fixed bottom-4 left-0 w-full px-6 pointer-events-none">
         <div className="max-w-md mx-auto flex flex-col items-center gap-1">
             {messages.slice(0, 3).map((m, i) => (
                 <div key={i} className="bg-black/70 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full shadow-sm animate-fade-in">
                     {m}
                 </div>
             ))}
         </div>
      </div>

    </div>
  );
}