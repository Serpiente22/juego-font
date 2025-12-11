'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import socket from '../../lib/socket';

interface Player { id: string; name: string; color: string; pieces: number[]; }

// --- CONFIGURACIÓN VISUAL (Mantenemos tu configuración actual) ---
const CELL_SIZE = 6.66; 
const OFFSET_X = 0; 
const OFFSET_Y = -0.5;

const homePositions: Record<string, { left: string; top: string }[]> = {
  green: [{ left: '16%', top: '16%' }, { left: '27%', top: '16%' }, { left: '16%', top: '27%' }, { left: '27%', top: '27%' }],
  yellow: [{ left: '73%', top: '16%' }, { left: '84%', top: '16%' }, { left: '73%', top: '27%' }, { left: '84%', top: '27%' }],
  red:    [{ left: '16%', top: '73%' }, { left: '27%', top: '73%' }, { left: '16%', top: '84%' }, { left: '27%', top: '84%' }],
  blue:   [{ left: '73%', top: '73%' }, { left: '84%', top: '73%' }, { left: '73%', top: '84%' }, { left: '84%', top: '84%' }],
};

const getBoardCoords = (pos: number): { left: string, top: string } | null => {
    // ... (Mantenemos tu lógica de coordenadas manuales/automáticas aquí)
    const manualOverrides: Record<number, { left: string, top: string }> = {
        34: { left: '56.6%', top: '83%' }, 35: { left: '56.6%', top: '89.5%' }, 
        36: { left: '56.6%', top: '94.0%' }, 37: { left: '50.0%', top: '94.0%' }, 
        38: { left: '43.3%', top: '94.0%' }, 39: { left: '43.3%', top: '89.5%' },
        40: { left: '43.3%', top: '81.5%' }, 41: { left: '43.3%', top: '76.6%' },
    };
    if (manualOverrides[pos]) return manualOverrides[pos];

    const cell = (col: number, row: number) => ({ 
        left: `${(col * CELL_SIZE) + (CELL_SIZE / 2) + OFFSET_X}%`, 
        top: `${(row * CELL_SIZE) + (CELL_SIZE / 2) + OFFSET_Y}%` 
    });

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
  const router = useRouter();

  const roomId = params.roomId as string;
  // PERSISTENCIA: Intentamos leer del nombre si no viene en la URL
  const playerNameParam = searchParams.get('name');
  const [playerName, setPlayerName] = useState(playerNameParam || '');

  const [players, setPlayers] = useState<Player[]>([]);
  const [serverTurnIndex, setServerTurnIndex] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  const [killAlert, setKillAlert] = useState<{killer: string, victim: string} | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  // --- NUEVO: ESTADO PARA EL TEMPORIZADOR ---
  const [timeLeft, setTimeLeft] = useState(15);

  const pushMsg = (msg: string) => setMessages(prev => [msg, ...prev].slice(0, 5));
  const playSound = (type: string) => { try { new Audio(`/${type}.mp3`).play().catch(() => {}); } catch {} };

  // --- EFECTO DE MÚSICA ---
  useEffect(() => {
    bgMusicRef.current = new Audio('/bg-music.mp3');
    bgMusicRef.current.loop = true; bgMusicRef.current.volume = 0.3;
    const tryPlay = () => { if (musicEnabled && bgMusicRef.current) bgMusicRef.current.play().catch(() => {}); };
    document.addEventListener('click', tryPlay, { once: true });
    return () => { if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current = null; } };
  }, []);

  useEffect(() => {
      if (bgMusicRef.current) { musicEnabled ? bgMusicRef.current.play().catch(() => {}) : bgMusicRef.current.pause(); }
  }, [musicEnabled]);

  // --- EFECTO DE PERSISTENCIA (SESSION STORAGE) ---
  useEffect(() => {
      // 1. Si tenemos nombre en la URL, lo guardamos para el futuro
      if (playerNameParam) {
          sessionStorage.setItem('ludo_player_name', playerNameParam);
          setPlayerName(playerNameParam);
      } else {
          // 2. Si NO tenemos nombre en la URL (F5), intentamos recuperarlo
          const savedName = sessionStorage.getItem('ludo_player_name');
          if (savedName) {
              setPlayerName(savedName);
          } else {
              // Si no hay nombre ni guardado, volver al inicio
              router.push('/');
          }
      }
  }, [playerNameParam, router]);

  // --- UNIRSE Y SINCRONIZAR ---
  const joinAndSync = useCallback(() => {
    if (!roomId || !playerName) return;
    setMyId(socket.id ?? null);
    
    // Emitimos joinRoom. Gracias al backend actualizado, esto nos devolverá el estado actual
    // incluso si es una reconexión.
    socket.emit('joinRoom', { roomId, playerName });
  }, [roomId, playerName]);

  useEffect(() => {
    if (socket.connected && playerName) joinAndSync(); 
    else socket.on('connect', joinAndSync);

    socket.on('game_state', (s) => {
        if (s.players) setPlayers(s.players);
        setDice(s.dice);
        // IMPORTANTE: Al recibir estado, actualizamos el turno
        setServerTurnIndex(s.turnIndex); 
        if (s.winners) { setWinners(s.winners); if (s.status === 'finished') playSound('win'); }
    });
    
    socket.on('diceRolled', ({value}) => { setDice(value); playSound('dice'); });
    socket.on('pieceMoved', () => playSound('move'));
    socket.on('killEvent', (d) => { setKillAlert(d); playSound('kill'); setTimeout(() => setKillAlert(null), 3500); });
    
    // Al cambiar turno, REINICIAMOS EL TIMER LOCAL
    socket.on('turnChanged', ({turnIndex}) => {
        setServerTurnIndex(turnIndex);
        setTimeLeft(15); // Reiniciar a 15s
    });
    
    socket.on('message', (m) => pushMsg(m));
    socket.on('error', (m) => pushMsg(`❌ ${m}`));

    return () => { 
        socket.off('connect'); socket.off('game_state'); socket.off('diceRolled'); 
        socket.off('pieceMoved'); socket.off('killEvent'); socket.off('turnChanged'); 
        socket.off('message'); socket.off('error'); 
    };
  }, [joinAndSync, playerName]);

  // --- EFECTO DE CUENTA REGRESIVA ---
  useEffect(() => {
      // Solo correr el timer si el juego no ha terminado
      if (winners.length > 0) return;

      const timer = setInterval(() => {
          setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      return () => clearInterval(timer);
  }, [serverTurnIndex, winners]); // Se reinicia/recrea cuando cambia el turno

  const rollDice = () => socket.emit('rollDice', { roomId });
  
  const movePiece = (pid: string, idx: number) => {
    if (pid !== myId || players[serverTurnIndex]?.id !== myId) return;
    socket.emit('movePiece', { roomId, playerId: pid, pieceIndex: idx });
  };

  const surrender = () => {
      if (confirm('¿Seguro que quieres rendirte? Tus fichas se eliminarán.')) {
          socket.emit('surrender', { roomId });
          router.push('/'); // Volver al inicio
      }
  }

  const currentServerPlayer = players[serverTurnIndex];
  const isMyTurn = myId && currentServerPlayer?.id === myId;
  const isGameFinished = players.length > 0 && winners.length >= players.length - 1;

  // Calcular porcentaje de tiempo para la barra visual
  const timePercentage = (timeLeft / 15) * 100;
  const timerColor = timeLeft > 10 ? 'bg-green-500' : timeLeft > 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-50 text-gray-800 font-sans overflow-hidden">
      {killAlert && (
        <div className="fixed top-1/4 left-0 w-full z-50 flex justify-center pointer-events-none animate-bounce">
            <div className="bg-red-500/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-2xl border-2 border-red-400 flex flex-col items-center">
                <span className="text-4xl mb-1">⚔️</span>
                <div className="text-lg font-bold uppercase tracking-wider">¡Aniquilado!</div>
                <div className="text-sm opacity-90"><span className="font-black text-yellow-300">{killAlert.killer}</span> eliminó a {killAlert.victim}</div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex-none p-4 flex justify-between items-center z-10">
        <div className="bg-white/80 backdrop-blur px-4 py-2 rounded-xl shadow-sm border border-gray-200">
             <h1 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sala</h1>
             <p className="font-mono font-bold text-gray-700 text-sm">{roomId}</p>
        </div>
        
        <div className="flex gap-2">
            {/* Botón Rendirse */}
            {!isGameFinished && (
                <button 
                    onClick={surrender} 
                    className="bg-white/80 px-3 py-2 rounded-xl shadow-sm text-red-500 font-bold text-xs hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                    title="Rendirse"
                >
                    🏳️ Rendirse
                </button>
            )}

            <button onClick={() => setMusicEnabled(!musicEnabled)} className="bg-white/80 p-2 rounded-full shadow-sm text-gray-500 hover:text-gray-800">{musicEnabled ? '🔊' : '🔇'}</button>
            
            {!isGameFinished && (
                <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-3 transition-all">
                    <div className="text-right"><p className="text-[10px] font-bold text-gray-400 uppercase">Turno</p><p className="font-bold text-gray-800 text-sm leading-none">{currentServerPlayer?.name}</p></div>
                    <div className="w-8 h-8 rounded-full border-2 border-gray-100 shadow-inner" style={{background: currentServerPlayer?.color || '#eee'}}></div>
                </div>
            )}
        </div>
      </header>

      {/* ÁREA DE JUEGO */}
      <main className="flex-1 relative w-full flex items-center justify-center p-2 min-h-0">
        <div className="relative aspect-square h-auto w-auto max-h-full max-w-full shadow-2xl rounded-[15%] bg-white p-2 border border-gray-200">
            <div className="relative w-full h-full select-none rounded-[12%] overflow-hidden bg-gray-50">
                <img src="/ludo-board.png" className="w-full h-full object-contain pointer-events-none opacity-90 mix-blend-multiply" alt="Tablero" />
                {players.map(p => p.pieces.map((pos, idx) => {
                    // Si pos es -99, el jugador se rindió, no mostrar ficha
                    if (pos === -99) return null;

                    const isMine = p.id === myId;
                    const coord = (pos === -1) ? homePositions[p.color][idx] : getBoardCoords(pos);
                    if (!coord) return null;
                    const isMovable = isMine && isMyTurn && dice !== null && (pos !== -1 || dice === 6 || dice === 1) && !winners.includes(p.id);

                    return (
                        <div key={`${p.id}-${idx}`} onClick={() => isMovable && movePiece(p.id, idx)}
                             className={`absolute flex justify-center items-center transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isMovable ? 'cursor-pointer z-50 hover:scale-125' : 'z-20'}`}
                             style={{ left: coord.left, top: coord.top, width: '5.5%', height: '5.5%', transform: 'translate(-50%, -50%)' }}>
                            <div className={`w-full h-full rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.4)] relative border-2 border-white/70 ${isMovable ? 'animate-pulse ring-4 ring-yellow-400/60 scale-110' : ''}`} style={{background: p.color}}>
                                <div className="absolute top-1 left-1.5 w-1/3 h-1/3 bg-white/50 rounded-full blur-[0.5px]"></div>
                            </div>
                        </div>
                    );
                }))}
            </div>
        </div>
      </main>

      {/* CONTROLES */}
      <footer className="flex-none w-full max-w-md mx-auto p-4 z-20">
         
         {/* BARRA DE TIEMPO (NUEVO) */}
         {!isGameFinished && (
             <div className="mb-3 px-2">
                 <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase mb-1">
                     <span>Tiempo Restante</span>
                     <span>{timeLeft}s</span>
                 </div>
                 <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                     <div 
                        className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} 
                        style={{ width: `${timePercentage}%` }}
                     ></div>
                 </div>
             </div>
         )}

         <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-3 flex items-center justify-between gap-4">
             <div className="flex flex-col items-center justify-center w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 shadow-inner relative overflow-hidden">
                 {dice ? (<span key={dice} className="text-4xl font-black text-gray-800 animate-[bounce_0.4s]">{dice}</span>) : (<span className="text-2xl opacity-20">🎲</span>)}
             </div>
             <div className="flex-1">
                 {!isGameFinished ? (
                     <button onClick={rollDice} disabled={!isMyTurn || dice !== null}
                        className={`w-full h-16 rounded-xl font-black text-lg tracking-wide shadow-lg transition-all transform active:scale-95 flex flex-col items-center justify-center ${isMyTurn && dice === null ? 'bg-gray-900 text-white hover:bg-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                        {isMyTurn ? (dice !== null ? '¡MUEVE!' : 'TIRAR') : 'ESPERA'}
                        <span className="text-[9px] font-normal opacity-60 uppercase tracking-widest -mt-0.5">{isMyTurn ? (dice !== null ? 'Selecciona ficha' : 'Tu turno') : 'Turno del oponente'}</span>
                     </button>
                 ) : (
                     <div className="text-center h-16 flex flex-col justify-center"><h3 className="font-bold text-gray-800 text-sm">¡Finalizado!</h3><div className="flex justify-center gap-1 mt-1">{winners.map((w, i) => (<div key={i} className="w-5 h-5 rounded-full border border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white" style={{background: players.find(p=>p.id===w)?.color}}>{i+1}</div>))}</div></div>
                 )}
             </div>
         </div>
      </footer>
    </div>
  );
}