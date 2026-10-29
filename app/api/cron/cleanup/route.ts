import { timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/game-room";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "Room cleanup is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const sql = getDatabase();
    const deleted = await sql`
      WITH expired_rooms AS (
        SELECT room_id
        FROM game_rooms
        WHERE (
          phase <> 'playing'
          AND updated_at < now() - interval '24 hours'
        ) OR updated_at < now() - interval '7 days'
        ORDER BY updated_at ASC
        LIMIT 500
      )
      DELETE FROM game_rooms
      USING expired_rooms
      WHERE game_rooms.room_id = expired_rooms.room_id
      RETURNING game_rooms.room_id
    `;

    return Response.json({ deleted: deleted.length });
  } catch (error) {
    console.error("Could not clean up expired game rooms.", error);
    return Response.json({ error: "Could not clean up expired rooms." }, { status: 500 });
  }
}
