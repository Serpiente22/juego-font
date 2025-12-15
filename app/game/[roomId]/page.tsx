'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import socket from '../../lib/socket';

interface Player { 
  id: string; 
  name: string; 
  color: string; 
  pieces: number[]; 
  bomb?: { pieceIndex: number; timer: number }; 
}

interface PowerUp { pos: number; type: string; }

// --- CONFIGURACIÓN VISUAL ---
// Ajuste de tamaño a 4.5% como pediste
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
  const playerNameParam = searchParams.get('name');
  const [playerName, setPlayerName] = useState(playerNameParam || '');

  const [players, setPlayers] = useState<Player[]>([]);
  const [serverTurnIndex, setServerTurnIndex] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [winners, setWinners] = useState<string[]>([]);
  
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]); 
  const [killAlert, setKillAlert] = useState<{killer: string, victim: string} | null>(null);
  const [powerAlert, setPowerAlert] = useState<{player: string, msg: string} | null>(null);
  const [explosion, setExplosion] = useState<{pos: number} | null>(null);
  
  const [musicEnabled, setMusicEnabled] = useState(true);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);

  const pushMsg = (msg: string) => setMessages(prev => [msg, ...prev].slice(0, 5));
  const playSound = (type: string) => { try { new Audio(`/${type}.mp3`).play().catch(() => {}); } catch {} };

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

  useEffect(() => {
      if (playerNameParam) { sessionStorage.setItem('ludo_player_name', playerNameParam); setPlayerName(playerNameParam); }
      else { const savedName = sessionStorage.getItem('ludo_player_name'); if (savedName) setPlayerName(savedName); else router.push('/'); }
  }, [playerNameParam, router]);

  const joinAndSync = useCallback(() => {
    if (!roomId || !playerName) return;
    setMyId(socket.id ?? null);
    socket.emit('joinRoom', { roomId, playerName });
  }, [roomId, playerName]);

  useEffect(() => {
    if (socket.connected && playerName) joinAndSync(); else socket.on('connect', joinAndSync);

    socket.on('game_state', (s) => {
        if (s.players) setPlayers(s.players);
        setDice(s.dice);
        setServerTurnIndex(s.turnIndex);
        if (s.powerUps) setPowerUps(s.powerUps); 
        if (s.winners) { setWinners(s.winners); if (s.status === 'finished') playSound('win'); }
    });
    
    socket.on('diceRolled', ({value}) => { setDice(value); playSound('dice'); });
    socket.on('pieceMoved', () => playSound('move'));
    socket.on('killEvent', (d) => { setKillAlert(d); playSound('kill'); setTimeout(() => setKillAlert(null), 3000); });
    socket.on('powerUpActivated', (d) => { setPowerAlert({ player: d.player, msg: d.effect.msg }); playSound('powerup'); setTimeout(() => setPowerAlert(null), 4000); });
    socket.on('explosion', (d) => { setExplosion(d); playSound('explosion'); setTimeout(() => setExplosion(null), 1000); });
    socket.on('turnChanged', ({turnIndex}) => { setServerTurnIndex(turnIndex); setTimeLeft(15); });
    socket.on('message', (m) => pushMsg(m));
    socket.on('error', (m) => pushMsg(`❌ ${m}`));

    return () => { 
        socket.off('connect'); socket.off('game_state'); socket.off('diceRolled'); 
        socket.off('pieceMoved'); socket.off('killEvent'); socket.off('powerUpActivated');
        socket.off('explosion'); socket.off('turnChanged'); socket.off('message'); socket.off('error'); 
    };
  }, [joinAndSync, playerName]);

  useEffect(() => {
      if (winners.length > 0) return;
      const timer = setInterval(() => { setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)); }, 1000);
      return () => clearInterval(timer);
  }, [serverTurnIndex, winners]);

  const rollDice = () => socket.emit('rollDice', { roomId });
  const movePiece = (pid: string, idx: number) => {
    if (pid !== myId || players[serverTurnIndex]?.id !== myId) return;
    socket.emit('movePiece', { roomId, playerId: pid, pieceIndex: idx });
  };
  const surrender = () => { if (confirm('¿Seguro que quieres rendirte?')) { socket.emit('surrender', { roomId }); router.push('/'); } }

  const currentServerPlayer = players[serverTurnIndex];
  const isMyTurn = myId && currentServerPlayer?.id === myId;
  const isGameFinished = players.length > 0 && winners.length >= players.length - 1;
  const timePercentage = (timeLeft / 15) * 100;
  const timerColor = timeLeft > 10 ? 'bg-green-500' : timeLeft > 5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`flex flex-col h-[100dvh] w-full bg-gray-50 text-gray-800 font-sans overflow-hidden ${explosion ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
      
      {/* ALERTAS */}
      {killAlert && (
        <div className="fixed top-20 z-50 animate-bounce w-full flex justify-center pointer-events-none">
            <div className="bg-red-500/90 backdrop-blur-md text-white px-8 py-4 rounded-2xl shadow-2xl border-2 border-red-400 flex flex-col items-center">
                <span className="text-4xl mb-1">⚔️</span>
                <div className="text-lg font-bold uppercase tracking-wider">¡Aniquilado!</div>
                <div className="text-sm opacity-90"><span className="font-black text-yellow-300">{killAlert.killer}</span> eliminó a {killAlert.victim}</div>
            </div>
        </div>
      )}
      {powerAlert && (
        <div className="fixed top-32 z-50 animate-bounce w-full flex justify-center pointer-events-none">
            <div className="bg-yellow-400/90 backdrop-blur-md text-black px-8 py-6 rounded-3xl shadow-xl border-4 border-white flex flex-col items-center">
                <span className="text-5xl mb-2">🎁</span>
                <div className="text-xl font-black uppercase tracking-wider">¡PODER!</div>
                <div className="text-md font-bold text-center">{powerAlert.msg}</div>
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
            {!isGameFinished && <button onClick={surrender} className="bg-white/80 px-3 py-2 rounded-xl shadow-sm text-red-500 font-bold text-xs hover:bg-red-50 transition-colors">🏳️ Rendirse</button>}
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
                
                {/* PODERES (4.5%) */}
                {powerUps.map((p, i) => {
                    const coord = getBoardCoords(p.pos);
                    if(!coord) return null;
                    return (
                        <div key={`pow-${i}`} className="absolute flex justify-center items-center z-10 animate-pulse" style={{ left: coord.left, top: coord.top, width: '4.5%', height: '4.5%', transform: 'translate(-50%, -50%)' }}>
                            <div className="text-xl drop-shadow-md">❓</div>
                        </div>
                    )
                })}

                {/* FICHAS CON STACKING */}
                {players.map(p => {
                    // Agrupar fichas por posición
                    const groupedPieces: Record<number, number[]> = {};
                    p.pieces.forEach((pos, idx) => {
                        if (pos === -99) return;
                        if (!groupedPieces[pos]) groupedPieces[pos] = [];
                        groupedPieces[pos].push(idx);
                    });

                    return Object.entries(groupedPieces).map(([posStr, indices]) => {
                        const pos = parseInt(posStr);
                        // Solo renderizamos 1 elemento visual por posición
                        const idx = indices[0]; 
                        const count = indices.length;

                        const isMine = p.id === myId;
                        const coord = (pos === -1) ? homePositions[p.color][idx] : getBoardCoords(pos); // Si es casa, usamos índice para separar
                        if (!coord) return null;
                        
                        // Si es casa (-1), NO agrupamos visualmente, renderizamos individual
                        if (pos === -1) {
                            return indices.map(subIdx => {
                                const subCoord = homePositions[p.color][subIdx];
                                const subMovable = isMine && isMyTurn && dice !== null && (dice === 1 || dice === 6) && !winners.includes(p.id);
                                return (
                                    <div key={`${p.id}-${subIdx}`} onClick={() => subMovable && movePiece(p.id, subIdx)}
                                         className={`absolute flex justify-center items-center transition-all duration-300 ${subMovable ? 'cursor-pointer z-50 hover:scale-125' : 'z-20'}`}
                                         style={{ left: subCoord.left, top: subCoord.top, width: '4.5%', height: '4.5%', transform: 'translate(-50%, -50%)' }}>
                                        <div className={`w-full h-full rounded-full shadow-md border-2 border-white ${subMovable ? 'animate-pulse ring-2 ring-yellow-400' : ''}`} style={{background: p.color}}></div>
                                    </div>
                                );
                            });
                        }

                        const isMovable = isMine && isMyTurn && dice !== null && !winners.includes(p.id);

                        return (
                            <div key={`${p.id}-group-${pos}`} onClick={() => isMovable && movePiece(p.id, idx)}
                                 className={`absolute flex justify-center items-center transition-all duration-300 ${isMovable ? 'cursor-pointer z-50 hover:scale-125' : 'z-20'}`}
                                 style={{ left: coord.left, top: coord.top, width: '4.5%', height: '4.5%', transform: 'translate(-50%, -50%)' }}>
                                
                                <div className={`w-full h-full rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.4)] relative border-2 border-white/70 ${isMovable ? 'animate-pulse ring-4 ring-yellow-400/60 scale-110' : ''}`} style={{background: p.color}}>
                                    {/* CONTADOR DE STACK */}
                                    {count > 1 && (
                                        <div className="absolute -top-3 -right-3 bg-black text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white z-30">
                                            {count}
                                        </div>
                                    )}
                                    
                                    {/* BOMBA */}
                                    {p.bomb && indices.includes(p.bomb.pieceIndex) && (
                                        <span className="absolute -top-3 -left-2 text-sm z-20 animate-pulse">💣</span>
                                    )}
                                    <div className="absolute top-1 left-1.5 w-1/3 h-1/3 bg-white/50 rounded-full blur-[0.5px]"></div>
                                </div>
                            </div>
                        );
                    });
                })}
            </div>
        </div>
      </main>

      {/* CONTROLES */}
      <footer className="flex-none w-full max-w-md mx-auto p-4 z-20">
         {!isGameFinished && (
             <div className="mb-3 px-2">
                 <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase mb-1"><span>Tiempo Restante</span><span>{timeLeft}s</span></div>
                 <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ease-linear ${timerColor}`} style={{ width: `${timePercentage}%` }}></div></div>
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
      
      <style jsx global>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}