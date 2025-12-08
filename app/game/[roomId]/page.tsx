'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import socket from '../../lib/socket';

interface Player {
  id: string;
  name: string;
  color: 'red' | 'blue' | 'green' | 'yellow';
  pieces: number[];
}

// ... (CONFIGURACIÓN VISUAL homePositions y getBoardCoords IGUAL QUE ANTES)
// MANTÉN TUS VARIABLES homePositions y getBoardCoords AQUÍ SIN CAMBIOS
// (No las repito para ahorrar espacio, pero no las borres)
const homePositions: Record<string, { left: string; top: string }[]> = {
  green: [{ left: '16%', top: '16%' }, { left: '27%', top: '16%' }, { left: '16%', top: '27%' }, { left: '27%', top: '27%' }],
  yellow: [{ left: '73%', top: '16%' }, { left: '84%', top: '16%' }, { left: '73%', top: '27%' }, { left: '84%', top: '27%' }],
  red:    [{ left: '16%', top: '73%' }, { left: '27%', top: '73%' }, { left: '16%', top: '84%' }, { left: '27%', top: '84%' }],
  blue:   [{ left: '73%', top: '73%' }, { left: '84%', top: '73%' }, { left: '73%', top: '84%' }, { left: '84%', top: '84%' }],
};

const getBoardCoords = (pos: number): { left: string, top: string } | null => {
    // ... PEGA AQUÍ LA FUNCIÓN getBoardCoords QUE TE DI EN LA RESPUESTA ANTERIOR (LA CORREGIDA)
    // Es muy larga para repetirla, pero usa exactamente la misma.
    const unit = 100 / 15;
    const half = unit / 2;
    const cell = (col: number, row: number) => ({ left: `${col * unit + half}%`, top: `${row * unit + half}%` });

    const mainTrackMap: Record<number, {col:number, row:number}> = {
        0: {col:1, row:6}, 1: {col:2, row:6}, 2: {col:3, row:6}, 3: {col:4, row:6}, 4: {col:5, row:6},
        5: {col:6, row:5}, 6: {col:6, row:4}, 7: {col:6, row:3}, 8: {col:6, row:2}, 9: {col:6, row:1}, 10: {col:6, row:0},
        11: {col:7, row:0}, 12: {col:8, row:0},
        13: {col:8, row:1}, 14: {col:8, row:2}, 15: {col:8, row:3}, 16: {col:8, row:4}, 17: {col:8, row:5},
        18: {col:9, row:6}, 19: {col:10, row:6}, 20: {col:11, row:6}, 21: {col:12, row:6}, 22: {col:13, row:6}, 23: {col:14, row:6},
        24: {col:14, row:7}, 25: {col:14, row:8},
        26: {col:13, row:8}, 27: {col:12, row:8}, 28: {col:11, row:8}, 29: {col:10, row:8}, 30: {col:9, row:8},
        31: {col:8, row:9}, 32: {col:8, row:10}, 33: {col:8, row:11}, 34: {col:8, row:12}, 35: {col:8, row:13}, 36: {col:8, row:14},
        37: {col:7, row:14}, 38: {col:6, row:14},
        39: {col:6, row:13}, 40: {col:6, row:12}, 41: {col:6, row:11}, 42: {col:6, row:10}, 43: {col:6, row:9},
        44: {col:5, row:8}, 45: {col:4, row:8}, 46: {col:3, row:8}, 47: {col:2, row:8}, 48: {col:1, row:8}, 49: {col:0, row:8},
        50: {col:0, row:7}, 51: {col:0, row:6}
    };
    if (pos >= 0 && pos <= 51) { const coords = mainTrackMap[pos]; if (coords) return cell(coords.col, coords.row); }
    if (pos >= 100 && pos <= 105) { const step = pos - 100; return cell(1 + step, 7); }
    if (pos >= 200 && pos <= 205) { const step = pos - 200; return cell(7, 1 + step); }
    if (pos >= 300 && pos <= 305) { const step = pos - 300; return cell(13 - step, 7); }
    if (pos >= 400 && pos <= 405) { const step = pos - 400; return cell(7, 13 - step); }
    return null;
};

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.roomId as string;
  const playerName = searchParams.get('name') || '';

  const [players, setPlayers] = useState<Player[]>([]);
  const [serverTurnIndex, setServerTurnIndex] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  
  // ESTADO PARA ALERTAS DE KILL
  const [killAlert, setKillAlert] = useState<{killer: string, victim: string} | null>(null);

  const pushMsg = (msg: string) => {
    setMessages(prev => [msg, ...prev].slice(0, 50));
  };

  // Función simple para reproducir sonidos
  const playSound = (type: 'dice' | 'move' | 'kill' | 'win') => {
    try {
        const audio = new Audio(`/${type}.mp3`);
        audio.volume = 0.5;
        audio.play().catch(e => console.log("Audio play failed (user interaction needed first)", e));
    } catch (e) {
        console.log("No audio file found");
    }
  };

  const joinAndSync = useCallback(() => {
    if (!roomId) return;
    setMyId(socket.id ?? null);
    socket.emit('joinRoom', { roomId, playerName });
  }, [roomId, playerName]);

  useEffect(() => {
    if (socket.connected) {
      joinAndSync();
    } else {
      socket.on('connect', joinAndSync);
    }

    const handleGameState = (state: any) => {
      if (state.players) setPlayers(state.players);
      setDice(state.dice);
      setServerTurnIndex(state.turnIndex);
      if (state.winners) {
        setWinners(state.winners);
        if(state.status === 'finished') playSound('win');
      }
    };

    const handleDiceRolled = ({ value }: { value: number }) => {
      setDice(value);
      playSound('dice');
    };
    
    const handlePieceMoved = () => {
        playSound('move');
    };

    // NUEVO: Manejar evento de Kill
    const handleKillEvent = (data: {killer: string, victim: string}) => {
        setKillAlert(data);
        playSound('kill');
        setTimeout(() => setKillAlert(null), 3000); // Ocultar alerta a los 3 seg
    };

    const handleTurnChanged = ({ turnIndex }: { turnIndex: number }) => {
      setServerTurnIndex(turnIndex);
    };

    const handleServerMessage = (msg: string) => pushMsg(`📢 ${msg}`);
    const handleError = (msg: string) => pushMsg(`❌ ${msg}`);

    socket.on('game_state', handleGameState);
    socket.on('diceRolled', handleDiceRolled);
    socket.on('pieceMoved', handlePieceMoved); // Escuchar movimiento para sonido
    socket.on('killEvent', handleKillEvent); // Escuchar kill
    socket.on('turnChanged', handleTurnChanged);
    socket.on('message', handleServerMessage);
    socket.on('error', handleError);
    socket.on('errorJoining', handleError);

    return () => {
      socket.off('connect', joinAndSync);
      socket.off('game_state', handleGameState);
      socket.off('diceRolled', handleDiceRolled);
      socket.off('pieceMoved', handlePieceMoved);
      socket.off('killEvent', handleKillEvent);
      socket.off('turnChanged', handleTurnChanged);
      socket.off('message', handleServerMessage);
      socket.off('error', handleError);
      socket.off('errorJoining', handleError);
    };
  }, [joinAndSync]);

  const rollDice = () => {
    socket.emit('rollDice', { roomId });
  };

  const movePiece = (playerId: string, pieceIndex: number) => {
    // Seguridad Frontend extra: no dejar enviar evento si no es mío
    if (playerId !== myId) return; 
    const currentServerPlayer = players[serverTurnIndex];
    if (currentServerPlayer?.id !== myId) return;
    socket.emit('movePiece', { roomId, playerId, pieceIndex });
  };

  const currentServerPlayer = players[serverTurnIndex];
  const isMyTurn = myId && currentServerPlayer?.id === myId;
  const myPlayer = players.find(p => p.id === myId);
  const isGameFinished = players.length > 0 && winners.length >= players.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center bg-green-50 p-4 relative overflow-hidden font-sans">
      
      {/* ALERTA DE KILL (Pop-up emocionante) */}
      {killAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-red-600 text-white px-8 py-6 rounded-3xl shadow-[0_0_50px_rgba(255,0,0,0.5)] animate-[bounce_0.5s_infinite] border-4 border-yellow-400">
                <h2 className="text-4xl font-black uppercase italic drop-shadow-md text-center">
                    ⚔️ ¡ATAQUE! ⚔️
                </h2>
                <p className="text-2xl mt-2 text-center font-bold">
                    <span className="text-yellow-300">{killAlert.killer}</span> destrozó a <span className="text-black/50">{killAlert.victim}</span>
                </p>
            </div>
        </div>
      )}

      {/* HUD Superior */}
      <div className="w-full max-w-3xl flex justify-between items-center bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl mb-6 sticky top-4 z-20 border border-white/50">
        <div>
          <h1 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-600">Sala: {roomId}</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 shadow-sm">
               <div style={{width: 14, height: 14, borderRadius: '50%', background: myPlayer?.color || 'gray', boxShadow: 'inset 0 0 4px rgba(0,0,0,0.3)'}}></div>
               <span className="font-bold text-gray-700">{myPlayer?.name || playerName}</span>
            </div>
          </div>
        </div>

        {isGameFinished ? (
            <div className="text-xl font-extrabold text-purple-600 animate-bounce">
                ¡Juego Terminado!
            </div>
        ) : (
            <div className="flex flex-col items-end">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">Turno de:</div>
            <div className={`flex items-center gap-2 text-lg font-bold transition-all ${isMyTurn ? 'scale-110' : ''}`}>
                <div className={`w-5 h-5 rounded-full border-2 border-white shadow-md transition-all ${isMyTurn ? 'animate-pulse shadow-yellow-400/50' : ''}`} style={{background: currentServerPlayer?.color || 'gray'}}></div>
                <span className={isMyTurn ? 'text-blue-700' : 'text-gray-800'}>{currentServerPlayer?.name || 'Esperando...'}</span>
            </div>
            </div>
        )}
      </div>

      {/* Área de Juego Central */}
      <div className="flex flex-col md:flex-row gap-8 items-center justify-center w-full max-w-5xl">
        
        {/* Tablero Contenedor */}
        <div className="relative flex-shrink-0 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white p-2 border-4 border-gray-800/80">
            <div className="relative w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] md:w-[520px] md:h-[520px] select-none rounded-2xl overflow-hidden">
            <img src="/ludo-board.png" className="w-full h-full object-contain pointer-events-none" alt="Tablero" />

            {players.map(p =>
                p.pieces.map((pos, idx) => {
                const key = `${p.id}-${idx}`;
                
                // --- CORRECCIÓN CLAVE AQUÍ: isMine ---
                const isMine = p.id === myId;
                
                let coord;
                if (pos === -1) { coord = homePositions[p.color][idx]; } else { coord = getBoardCoords(pos); }
                if (!coord) return null;

                // Ahora isMovable REQIERE isMine. Nadie puede ver movible la ficha de otro.
                const isMovable = isMine && isMyTurn && dice !== null && (pos !== -1 || dice === 6) && !winners.includes(p.id);
                const isWinnerPiece = pos >= 100 && (pos % 100 === 5);

                return (
                    <div
                    key={key}
                    // Si no es mía, el click no hace nada
                    onClick={() => isMine && movePiece(p.id, idx)}
                    className={`absolute flex justify-center items-center transition-all duration-300 ease-out
                        ${isMovable ? 'cursor-pointer z-30 hover:scale-110 hover:-translate-y-1' : 'z-10'}
                        ${isWinnerPiece ? 'z-10 scale-75 opacity-80' : ''}
                    `}
                    style={{
                        left: coord.left, top: coord.top, width: '6.5%', height: '6.5%', transform: 'translate(-50%, -50%)',
                    }}
                    >
                        <div 
                            className={`w-full h-full rounded-full border-[2.5px] border-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_4px_8px_rgba(0,0,0,0.3)] relative
                            ${isMovable ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-transparent' : ''}`}
                            style={{ backgroundColor: p.color }}
                        >
                            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-2/3 h-1/3 bg-gradient-to-b from-white/70 to-transparent rounded-full"></div>
                        </div>
                        {isMovable && <span className="absolute inset-0 w-full h-full rounded-full animate-ping bg-yellow-400 opacity-40"></span>}
                    </div>
                );
                })
            )}
            </div>
        </div>

        {/* Controles y Chat */}
        <div className="flex flex-col gap-4 w-full max-w-sm md:w-72 md:self-stretch">
          <div className="bg-white/90 backdrop-blur p-5 rounded-2xl shadow-xl text-center border border-white/50 flex flex-col justify-between min-h-[180px]">
             {!isGameFinished && (
                 <>
                    <div className="mb-4 flex-1 flex items-center justify-center bg-gray-50/80 rounded-xl border border-gray-100 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        {dice ? (
                        <span key={dice} className="text-6xl font-black text-gray-800 drop-shadow-lg animate-[bounce_0.5s_ease-out]">{dice}</span>
                        ) : (
                        <div className="text-gray-400 text-sm flex flex-col items-center gap-1">
                            <span className="text-3xl opacity-50">🎲</span>
                            Esperando tiro...
                        </div>
                        )}
                    </div>

                    <button
                    onClick={rollDice}
                    disabled={!isMyTurn || dice !== null}
                    className={`w-full py-4 rounded-xl font-extrabold text-lg shadow-md transition-all transform relative overflow-hidden
                        ${isMyTurn && dice === null 
                        ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white hover:scale-[1.02] active:scale-95 hover:shadow-lg hover:shadow-orange-500/30' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
                    >
                        <div className="relative z-10 flex items-center justify-center gap-2">
                        {isMyTurn 
                            ? (dice !== null ? '¡Mueve tu ficha!' : <><span>🎲</span> ¡TIRAR DADO!</>) 
                            : <>⏳ Espera a {currentServerPlayer?.name?.split(' ')[0]}</>
                        }
                        </div>
                        {isMyTurn && dice === null && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                    </button>
                 </>
             )}

             {isGameFinished && (
                 <div className="flex-1 flex flex-col items-center justify-center">
                     <h2 className="text-2xl font-bold mb-2">🏆 Ganadores</h2>
                     <ul className="space-y-1">
                         {winners.map((id, idx) => {
                             const p = players.find(pl => pl.id === id);
                             return <li key={id} className="font-bold" style={{color: p?.color}}>#{idx+1} {p?.name}</li>
                         })}
                     </ul>
                 </div>
             )}
          </div>

          <div className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg flex-1 h-48 md:h-auto flex flex-col border border-white/50">
            <h3 className="text-xs font-extrabold text-gray-500 uppercase mb-2 tracking-widest ml-1">Historial</h3>
            <ul className="flex-1 overflow-y-auto text-sm space-y-1.5 pr-1 custom-scrollbar-elegant bg-gray-50/50 rounded-lg p-2">
              {messages.map((m, i) => {
                const isError = m.startsWith('❌');
                const isImportat = m.startsWith('📢');
                return (
                    <li key={i} className={`pb-1 border-b border-gray-100 last:border-0 ${isError ? 'text-red-600 font-medium' : (isImportat ? 'text-blue-700 font-medium' : 'text-gray-600')}`}>
                        {m}
                    </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar-elegant::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-elegant::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-elegant::-webkit-scrollbar-thumb { background-color: rgba(0, 0, 0, 0.1); border-radius: 10px; }
        .custom-scrollbar-elegant::-webkit-scrollbar-thumb:hover { background-color: rgba(0, 0, 0, 0.2); }
      `}</style>
    </div>
  );
}