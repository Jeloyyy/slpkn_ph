export type Player = 1 | 2;
export type PieceKind =
  | "F"
  | "P"
  | "S"
  | "SGT"
  | "2LT"
  | "1LT"
  | "CPT"
  | "MAJ"
  | "LTC"
  | "COL"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G5";

export type Piece = { kind: PieceKind; owner: Player };
export type Board = (Piece | null)[][];
export type PieceCounts = Record<PieceKind, number>;

export const PIECES: {
  kind: PieceKind;
  name: string;
  symbol: string;
  count: number;
  rank: number;
}[] = [
  { kind: "F", name: "Flag", symbol: "⚑", count: 1, rank: 0 },
  { kind: "P", name: "Private", symbol: "♟", count: 6, rank: 2 },
  { kind: "S", name: "Spy", symbol: "♟", count: 2, rank: 1 },
  { kind: "SGT", name: "Sergeant", symbol: "♜", count: 1, rank: 3 },
  { kind: "2LT", name: "2nd Lieutenant", symbol: "♞", count: 1, rank: 4 },
  { kind: "1LT", name: "1st Lieutenant", symbol: "♝", count: 1, rank: 5 },
  { kind: "CPT", name: "Captain", symbol: "♛", count: 1, rank: 6 },
  { kind: "MAJ", name: "Major", symbol: "♚", count: 1, rank: 7 },
  { kind: "LTC", name: "Lieutenant Colonel", symbol: "♞", count: 1, rank: 8 },
  { kind: "COL", name: "Colonel", symbol: "♜", count: 1, rank: 9 },
  { kind: "G1", name: "1-Star General", symbol: "★", count: 1, rank: 10 },
  { kind: "G2", name: "2-Star General", symbol: "★★", count: 1, rank: 11 },
  { kind: "G3", name: "3-Star General", symbol: "★★★", count: 1, rank: 12 },
  { kind: "G4", name: "4-Star General", symbol: "★★★★", count: 1, rank: 13 },
  { kind: "G5", name: "5-Star General", symbol: "★★★★★", count: 1, rank: 14 },
];

export function createBoard(): Board {
  return Array.from({ length: 8 }, () => Array<Piece | null>(9).fill(null));
}

export function createPieceCounts(): PieceCounts {
  return Object.fromEntries(PIECES.map(({ kind, count }) => [kind, count])) as PieceCounts;
}

export function allPiecesPlaced(counts: PieceCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}

export function combatWinner(attacker: Piece, defender: Piece): Piece | null {
  if (attacker.kind === "F") return defender;
  if (defender.kind === "F") return attacker;
  if (attacker.kind === "S") return defender.kind === "P" ? defender : attacker;
  if (defender.kind === "S") return attacker.kind === "P" ? attacker : defender;

  const attackerRank = PIECES.find((piece) => piece.kind === attacker.kind)?.rank ?? 0;
  const defenderRank = PIECES.find((piece) => piece.kind === defender.kind)?.rank ?? 0;
  if (attackerRank === defenderRank) return null;
  return attackerRank > defenderRank ? attacker : defender;
}

export function findWinner(board: Board): Player | null {
  const flags: Record<Player, { found: boolean; row: number | null }> = {
    1: { found: false, row: null },
    2: { found: false, row: null },
  };

  board.forEach((row, rowIndex) => {
    row.forEach((piece) => {
      if (piece?.kind === "F") {
        flags[piece.owner] = { found: true, row: rowIndex };
      }
    });
  });

  if (!flags[1].found) return 2;
  if (!flags[2].found) return 1;
  if (flags[1].row === 0) return 1;
  if (flags[2].row === 7) return 2;
  return null;
}

export function pieceName(kind: PieceKind): string {
  return PIECES.find((piece) => piece.kind === kind)?.name ?? kind;
}
