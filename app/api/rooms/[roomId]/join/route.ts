import {
  createSecret,
  findRoom,
  getDatabase,
  getPublicRoom,
  hashSecret,
  jsonError,
  validGuestName,
} from "@/lib/game-room";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  const payload = input as { name?: unknown; inviteToken?: unknown } | null;
  const name = validGuestName(payload?.name);
  const inviteToken = typeof payload?.inviteToken === "string" ? payload.inviteToken : "";
  if (!name) return jsonError("Enter a name between 1 and 24 characters.", 400);
  if (inviteToken && (inviteToken.length < 20 || inviteToken.length > 128)) {
    return jsonError("This invitation link is invalid.", 400);
  }
  const { roomId } = await params;
  const playerToken = createSecret();

  try {
    const sql = getDatabase();
    const rows = await sql`
      UPDATE game_rooms
      SET player2_name = ${name}, player2_token_hash = ${hashSecret(playerToken)},
          version = version + 1, updated_at = now()
      WHERE room_id = ${roomId}
        AND (
          (visibility = 'public' AND ${inviteToken === ""})
          OR
          (visibility = 'private' AND invite_token_hash = ${hashSecret(inviteToken)})
        )
        AND player2_token_hash IS NULL
        AND phase = 'setup'
      RETURNING *
    `;
    const joinedRoom = rows[0];
    if (!joinedRoom) {
      const room = await findRoom(roomId);
      if (!room) return jsonError("Room not found.", 404);
      return jsonError("This room cannot be joined. It may be private, full, or already in progress.", 409);
    }
    return Response.json({
      room: getPublicRoom(joinedRoom as Parameters<typeof getPublicRoom>[0], 2),
      player: 2,
      playerToken,
    });
  } catch (error) {
    console.error("Could not join game room.", error);
    return jsonError("Could not join the room. Check the database connection and try again.", 500);
  }
}
