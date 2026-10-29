import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  allPiecesPlaced,
  combatWinner,
  createBoard,
  createPieceCounts,
  findWinner,
  getWinReason,
  type Board,
  type PieceCounts,
  type PieceKind,
  type Player,
} from "@/app/game";
import type { PublicRoom, RoomPhase, RoomSummary, RoomVisibility } from "@/app/room-types";

export type RoomRow = {
  room_id: string;
  invite_token_hash: string;
  visibility: RoomVisibility;
  player1_token_hash: string;
  player2_token_hash: string | null;
  player1_name: string;
  player2_name: string | null;
  board: Board;
  pool1: PieceCounts;
  pool2: PieceCounts;
  captured1: PieceKind[];
  captured2: PieceKind[];
  ready1: boolean;
  ready2: boolean;
  phase: RoomPhase;
  turn: Player;
  winner: Player | null;
  win_reason: "flag-captured" | "flagged" | "surrender" | null;
  move_count: number;
  version: number;
  updated_at: string;
};

export function getDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return neon(connectionString);
}

export function createSecret() {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function readPlayerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

export function getPlayerForToken(room: RoomRow, token: string): Player | null {
  const hash = hashSecret(token);
  if (equalSecret(hash, room.player1_token_hash)) return 1;
  if (room.player2_token_hash && equalSecret(hash, room.player2_token_hash)) return 2;
  return null;
}

export function getPublicRoom(room: RoomRow, player: Player | "spectator"): PublicRoom {
  const board = room.board.map((row) =>
    row.map((piece) => {
      if (!piece || (player !== "spectator" && piece.owner === player)) return piece;
      return { owner: piece.owner, hidden: true as const };
    }),
  );
  return {
    roomId: room.room_id,
    visibility: room.visibility,
    phase: room.phase,
    board,
    reserve: player === "spectator"
      ? createPieceCounts()
      : player === 1
        ? room.pool1
        : room.pool2,
    captured: [room.captured1, room.captured2],
    ready: [room.ready1, room.ready2],
    players: [room.player1_name, room.player2_name],
    turn: room.turn,
    winner: room.winner,
    winReason: room.win_reason,
    moveCount: room.move_count,
    version: room.version,
    youAre: player,
  };
}

export function getRoomSummary(room: RoomRow): RoomSummary {
  return {
    roomId: room.room_id,
    visibility: room.visibility,
    phase: room.phase,
    host: room.player1_name,
    opponent: room.player2_name,
    turn: room.turn,
    moveCount: room.move_count,
    updatedAt: room.updated_at,
  };
}

export function validGuestName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 24 ? name : null;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function findRoom(roomId: string): Promise<RoomRow | null> {
  const sql = getDatabase();
  const rows = await sql`SELECT * FROM game_rooms WHERE room_id = ${roomId} LIMIT 1`;
  return (rows[0] as RoomRow | undefined) ?? null;
}

export async function updateRoom(room: RoomRow) {
  const sql = getDatabase();
  const rows = await sql`
    UPDATE game_rooms
    SET board = ${JSON.stringify(room.board)}::jsonb,
        pool1 = ${JSON.stringify(room.pool1)}::jsonb,
        pool2 = ${JSON.stringify(room.pool2)}::jsonb,
        captured1 = ${JSON.stringify(room.captured1)}::jsonb,
        captured2 = ${JSON.stringify(room.captured2)}::jsonb,
        ready1 = ${room.ready1},
        ready2 = ${room.ready2},
        phase = ${room.phase},
        turn = ${room.turn},
        winner = ${room.winner},
        win_reason = ${room.win_reason},
        move_count = ${room.move_count},
        version = version + 1,
        updated_at = now()
    WHERE room_id = ${room.room_id} AND version = ${room.version}
    RETURNING version
  `;
  return rows.length > 0;
}

export function createInitialRoom(
  roomId: string,
  inviteHash: string,
  playerHash: string,
  name: string,
  visibility: RoomVisibility,
) {
  return {
    room_id: roomId,
    invite_token_hash: inviteHash,
    visibility,
    player1_token_hash: playerHash,
    player2_token_hash: null,
    player1_name: name,
    player2_name: null,
    board: createBoard(),
    pool1: createPieceCounts(),
    pool2: createPieceCounts(),
    captured1: [],
    captured2: [],
    ready1: false,
    ready2: false,
    phase: "setup" as const,
    turn: 1 as const,
    winner: null,
    win_reason: null,
    move_count: 0,
    version: 0,
    updated_at: new Date().toISOString(),
  };
}

function isPosition(row: unknown, col: unknown): row is number {
  return Number.isInteger(row) && Number.isInteger(col) &&
    (row as number) >= 0 && (row as number) < 8 &&
    (col as number) >= 0 && (col as number) < 9;
}

export function applyRoomAction(room: RoomRow, player: Player, input: unknown): string | null {
  if (!input || typeof input !== "object") return "Invalid action.";
  const action = input as Record<string, unknown>;

  if (action.type === "surrender") {
    if (room.phase !== "playing") return "The match is not in progress.";
    room.phase = "finished";
    room.winner = player === 1 ? 2 : 1;
    room.win_reason = "surrender";
    return null;
  }

  if (action.type === "ready") {
    if (room.phase !== "setup") return "Army setup is already complete.";
    if (player === 1) {
      if (room.ready1) return "You have already confirmed your army.";
      if (!allPiecesPlaced(room.pool1)) return "Place all your pieces before readying.";
      room.ready1 = true;
    } else {
      if (room.ready2) return "You have already confirmed your army.";
      if (!allPiecesPlaced(room.pool2)) return "Place all your pieces before readying.";
      room.ready2 = true;
    }
    if (room.ready1 && room.ready2) room.phase = "playing";
    return null;
  }

  if (action.type === "place" || action.type === "remove") {
    if (room.phase !== "setup") return "Army setup is already complete.";
    if ((player === 1 && room.ready1) || (player === 2 && room.ready2)) {
      return "You have already confirmed your army.";
    }
    if (!isPosition(action.row, action.col)) return "Invalid board position.";
    const row = action.row as number;
    const col = action.col as number;
    const existing = room.board[row][col];
    const pool = player === 1 ? room.pool1 : room.pool2;

    if (action.type === "remove") {
      if (!existing || existing.owner !== player) return "You can only remove your own piece.";
      room.board[row][col] = null;
      pool[existing.kind] += 1;
      return null;
    }

    const kind = action.kind;
    if (
      typeof kind !== "string" ||
      !Object.prototype.hasOwnProperty.call(pool, kind)
    ) return "Invalid piece.";
    const ownZone = player === 1 ? row >= 5 : row <= 2;
    if (!ownZone) return "Place pieces in the three rows closest to you.";
    if (existing) return "That square is occupied.";
    if (pool[kind as keyof PieceCounts] < 1) return "You do not have that piece in reserve.";
    room.board[row][col] = { kind: kind as keyof PieceCounts, owner: player };
    pool[kind as keyof PieceCounts] -= 1;
    return null;
  }

  if (action.type === "move") {
    if (room.phase !== "playing") return "The match is not in progress.";
    if (room.turn !== player) return "It is not your turn.";
    if (
      !isPosition(action.fromRow, action.fromCol) ||
      !isPosition(action.toRow, action.toCol)
    ) {
      return "Invalid board position.";
    }
    const fromRow = action.fromRow as number;
    const fromCol = action.fromCol as number;
    const toRow = action.toRow as number;
    const toCol = action.toCol as number;
    if (Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol)) !== 1) {
      return "Pieces move one square in any direction.";
    }
    const attacker = room.board[fromRow][fromCol];
    const defender = room.board[toRow][toCol];
    if (!attacker || attacker.owner !== player) return "Select one of your own pieces.";
    if (defender?.owner === player) return "You cannot capture your own piece.";

    if (!defender) {
      room.board[toRow][toCol] = attacker;
    } else {
      const victor = combatWinner(attacker, defender);
      room.board[toRow][toCol] = victor ? { kind: victor.kind, owner: victor.owner } : null;
      if (!victor || victor.owner === player) {
        const capturePool = player === 1 ? room.captured1 : room.captured2;
        capturePool.push(defender.kind);
      }
      if (!victor || victor.owner !== player) {
        const capturePool = player === 1 ? room.captured2 : room.captured1;
        capturePool.push(attacker.kind);
      }
    }
    room.board[fromRow][fromCol] = null;
    room.move_count += 1;
    const winner = findWinner(room.board);
    if (winner) {
      room.phase = "finished";
      room.winner = winner;
      room.win_reason = getWinReason(room.board, winner);
    } else {
      room.turn = player === 1 ? 2 : 1;
    }
    return null;
  }

  return "Unknown action.";
}
