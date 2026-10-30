import {
  findRoom,
  getPlayerForToken,
  getPublicRoom,
  isValidVisitorId,
  jsonError,
  recordRoomPresence,
  readPlayerToken,
  type RoomRow,
} from "@/lib/game-room";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const token = readPlayerToken(request);
  const visitorId = request.headers.get("x-room-visitor-id");
  const isPresenceHeartbeat = request.headers.get("x-room-presence") === "1";
  const { roomId } = await params;
  try {
    const room = await findRoom(roomId);
    if (!room) return jsonError("Room not found.", 404);
    let player: 1 | 2 | "spectator";
    if (!token) {
      const url = new URL(request.url);
      if (url.searchParams.get("watch") !== "1" || room.visibility !== "public") {
        return jsonError("Player token required.", 401);
      }
      player = "spectator";
    } else {
      const authenticatedPlayer = getPlayerForToken(room, token);
      if (!authenticatedPlayer) return jsonError("Invalid room credentials.", 403);
      player = authenticatedPlayer;
    }
    let activeRoom: RoomRow | null = room;
    if (isPresenceHeartbeat) {
      if (!isValidVisitorId(visitorId)) {
        return jsonError("Room visitor ID is invalid.", 400);
      }
      activeRoom = await recordRoomPresence(
        room,
        visitorId,
        player === "spectator" ? null : player,
      );
    }
    if (!activeRoom) return jsonError("Room not found.", 404);
    return Response.json(getPublicRoom(activeRoom, player), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Could not load game room.", error);
    return jsonError("Could not load the game. Check the database connection and try again.", 500);
  }
}
