import { randomBytes } from "node:crypto";
import {
  createInitialRoom,
  createSecret,
  getDatabase,
  getPublicRoom,
  getRoomSummary,
  hashSecret,
  jsonError,
  validGuestName,
} from "@/lib/game-room";

export async function GET() {
  try {
    const sql = getDatabase();
    const rows = await sql`
      SELECT * FROM game_rooms
      WHERE visibility = 'public'
        AND updated_at > now() - interval '24 hours'
        AND phase IN ('setup', 'playing', 'finished')
      ORDER BY
        CASE WHEN phase = 'setup' AND player2_token_hash IS NULL THEN 0
             WHEN phase = 'playing' THEN 1 ELSE 2 END,
        updated_at DESC
      LIMIT 50
    `;
    return Response.json(rows.map((row) => getRoomSummary(row as Parameters<typeof getRoomSummary>[0])), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Could not load public rooms.", error);
    return jsonError("Could not load rooms. Check the database configuration and try again.", 500);
  }
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  const payload = input as { name?: unknown; visibility?: unknown } | null;
  const name = validGuestName(payload?.name);
  if (!name) return jsonError("Enter a name between 1 and 24 characters.", 400);
  const visibility = payload?.visibility;
  if (visibility !== "public" && visibility !== "private") {
    return jsonError("Choose a public or private room.", 400);
  }

  const roomId = randomBytes(9).toString("base64url");
  const inviteToken = createSecret();
  const playerToken = createSecret();
  const room = createInitialRoom(
    roomId,
    hashSecret(inviteToken),
    hashSecret(playerToken),
    name,
    visibility,
  );

  try {
    const sql = getDatabase();
    await sql`
      INSERT INTO game_rooms (
        room_id, invite_token_hash, visibility, player1_token_hash, player1_name,
        board, pool1, pool2, captured1, captured2
      ) VALUES (
        ${room.room_id}, ${room.invite_token_hash}, ${room.visibility},
        ${room.player1_token_hash}, ${room.player1_name},
        ${JSON.stringify(room.board)}::jsonb,
        ${JSON.stringify(room.pool1)}::jsonb,
        ${JSON.stringify(room.pool2)}::jsonb,
        '[]'::jsonb, '[]'::jsonb
      )
    `;
    return Response.json({
      room: getPublicRoom(room, 1),
      player: 1,
      playerToken,
      inviteToken,
    });
  } catch (error) {
    console.error("Could not create game room.", error);
    return jsonError("Could not create the room. Check the database configuration and try again.", 500);
  }
}
