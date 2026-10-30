import {
  findRoom,
  getPlayerForToken,
  isValidVisitorId,
  jsonError,
  leaveRoomPresence,
  readPlayerToken,
} from "@/lib/game-room";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const token = readPlayerToken(request);
  const visitorId = request.headers.get("x-room-visitor-id");
  if (!isValidVisitorId(visitorId)) return jsonError("Room visitor ID is invalid.", 400);

  try {
    const room = await findRoom(roomId);
    if (!room) return Response.json({ deleted: true });
    if (token) {
      if (!getPlayerForToken(room, token)) return jsonError("Invalid room credentials.", 403);
    } else {
      const url = new URL(request.url);
      if (url.searchParams.get("watch") !== "1" || room.visibility !== "public") {
        return jsonError("Player token required.", 401);
      }
    }

    const remaining = await leaveRoomPresence(roomId, visitorId, Boolean(token));
    return Response.json({ deleted: remaining === null });
  } catch (error) {
    console.error("Could not leave game room.", error);
    return jsonError("Could not leave the room. Check the database connection and try again.", 500);
  }
}
