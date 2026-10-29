import {
  findRoom,
  getPlayerForToken,
  getPublicRoom,
  jsonError,
  readPlayerToken,
} from "@/lib/game-room";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const token = readPlayerToken(request);
  const { roomId } = await params;
  try {
    const room = await findRoom(roomId);
    if (!room) return jsonError("Room not found.", 404);
    if (!token) {
      const url = new URL(request.url);
      if (url.searchParams.get("watch") !== "1" || room.visibility !== "public") {
        return jsonError("Player token required.", 401);
      }
      return Response.json(getPublicRoom(room, "spectator"), {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    const player = getPlayerForToken(room, token);
    if (!player) return jsonError("Invalid room credentials.", 403);
    return Response.json(getPublicRoom(room, player), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Could not load game room.", error);
    return jsonError("Could not load the game. Check the database connection and try again.", 500);
  }
}
