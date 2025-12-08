import React from "react";
import "@/styles/ludo.css";

interface Props {
  players: any[];
  myId: string;
  dice: number | null;
  onMovePiece: (pieceIndex: number) => void;
}

export default function LudoBoard({ players, myId, dice, onMovePiece }: Props) {
  // mapa de 52 casillas
  const cells = Array.from({ length: 52 });

  const getPieceAt = (cellIndex: number) => {
    const result: any[] = [];
    players.forEach((p) => {
      p.pieces.forEach((pos: number, i: number) => {
        if (pos === cellIndex) {
          result.push({ color: p.color, owner: p.id, pieceIndex: i });
        }
      });
    });
    return result;
  };

  return (
    <div className="ludo-board">
      {cells.map((_, i) => {
        const pieces = getPieceAt(i);

        return (
          <div key={i} className="ludo-cell">
            {pieces.map((pc, j) => (
              <div
                key={j}
                className={`piece piece-${pc.color} ${pc.owner === myId && dice ? "clickable" : ""}`}
                onClick={() => {
                  if (pc.owner === myId && dice !== null) {
                    onMovePiece(pc.pieceIndex);
                  }
                }}
              ></div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
