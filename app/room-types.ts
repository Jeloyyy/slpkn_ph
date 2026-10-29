import type { Piece, PieceCounts, PieceKind, Player, WinReason } from "./game";

export type RoomPhase = "setup" | "playing" | "finished";
export type PublicPiece = Piece | { owner: Player; hidden: true };
export type RoomVisibility = "public" | "private";

export type PublicRoom = {
  roomId: string;
  visibility: RoomVisibility;
  phase: RoomPhase;
  board: (PublicPiece | null)[][];
  reserve: PieceCounts;
  captured: [PieceKind[], PieceKind[]];
  ready: [boolean, boolean];
  players: [string, string | null];
  turn: Player;
  winner: Player | null;
  winReason: WinReason | null;
  moveCount: number;
  version: number;
  youAre: Player | "spectator";
};

export type RoomSummary = {
  roomId: string;
  visibility: RoomVisibility;
  phase: RoomPhase;
  host: string;
  opponent: string | null;
  turn: Player;
  moveCount: number;
  updatedAt: string;
};
