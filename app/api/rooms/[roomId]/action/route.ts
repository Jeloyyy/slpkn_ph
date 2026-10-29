import {
  applyRoomAction,
  findRoom,
  getPlayerForToken,
  getPublicRoom,
  jsonError,
  readPlayerToken,
  updateRoom,
} from "@/lib/game-room";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const token = readPlayerToken(request);
  if (!token) return jsonError("Player token required.", 401);
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }
  const { roomId } = await params;
  try {
    const room = await findRoom(roomId);
    if (!room) return jsonError("Room not found.", 404);
    const player = getPlayerForToken(room, token);
    if (!player) return jsonError("Invalid room credentials.", 403);
    const problem = applyRoomAction(room, player, input);
    if (problem) return jsonError(problem, 400);
    if (!(await updateRoom(room))) {
      return jsonError("The game changed while processing your action. Refreshing the board.", 409);
    }
    const updatedRoom = await findRoom(roomId);
    if (!updatedRoom) return jsonError("Room not found after updating.", 404);
    return Response.json(getPublicRoom(updatedRoom, player), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Could not apply game action.", error);
    return jsonError("Could not update the game. Check the database connection and try again.", 500);
  }
}
