"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  allPiecesPlaced,
  combatWinner,
  createBoard,
  createPieceCounts,
  findWinner,
  getWinReason,
  PIECES,
  pieceImagePath,
  pieceName,
  type Board,
  type Piece,
  type PieceKind,
  type Player,
  type WinReason,
} from "./game";
import type { PublicLastMove, PublicPiece, PublicRoom, RoomSummary } from "./room-types";

type Screen = "home" | "rooms" | "join" | "setup" | "playing" | "finished" | "watching";
type Position = { row: number; col: number };
type BoardCell = Piece | PublicPiece | null;
type RoomCredentials = { token: string; player: Player };

const ROOM_POLL_INTERVAL = 800;

function roomStorageKey(roomId: string) {
  return `slpkn-room:${roomId}`;
}

function screenForRoom(room: PublicRoom): Screen {
  if (room.youAre === "spectator") return "watching";
  if (room.phase === "setup") return "setup";
  return room.phase;
}

function getErrorMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload &&
    typeof payload.error === "string"
    ? payload.error
    : fallback;
}

function playerName(player: Player) {
  return `Player ${player}`;
}

function squareNotation(row: number, col: number) {
  return `${"ABCDEFGHI"[col]}${8 - row}`;
}

export default function GameClient() {
  const [screen, setScreen] = useState<Screen>("home");
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [pools, setPools] = useState(() => [createPieceCounts(), createPieceCounts()]);
  const [localActivePlayer, setLocalActivePlayer] = useState<Player>(1);
  const [localCaptured, setLocalCaptured] = useState<[PieceKind[], PieceKind[]]>([[], []]);
  const [localLastMove, setLocalLastMove] = useState<PublicLastMove | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<PieceKind | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [localWinReason, setLocalWinReason] = useState<WinReason | null>(null);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [notice, setNotice] = useState("Choose a piece, then place it on your side of the board.");
  const [guestName, setGuestName] = useState("");
  const [onlineRoom, setOnlineRoom] = useState<PublicRoom | null>(null);
  const [playerToken, setPlayerToken] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [roomList, setRoomList] = useState<RoomSummary[]>([]);
  const [roomListRefreshing, setRoomListRefreshing] = useState(false);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [timeChoice, setTimeChoice] = useState<"untimed" | "5" | "10" | "custom">("untimed");
  const [customMinutes, setCustomMinutes] = useState("15");
  const [clockNow, setClockNow] = useState(0);
  const isRefreshing = useRef(false);
  const onlineRoomRef = useRef<PublicRoom | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRequestRef = useRef<{ version: number; retryAt: number } | null>(null);

  const playMoveSound = useCallback(() => {
    if (typeof window === "undefined" || !window.AudioContext) return;

    try {
      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new window.AudioContext();
        audioContextRef.current = context;
      }

      const playTone = () => {
        const oscillator = context.createOscillator();
        const volume = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(460, now);
        oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.07);
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
        volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        oscillator.connect(volume);
        volume.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
      };

      if (context.state === "suspended") {
        void context.resume().then(playTone).catch((error: unknown) => {
          console.error("Could not play the move sound.", error);
        });
      } else {
        playTone();
      }
    } catch (error) {
      console.error("Could not play the move sound.", error);
    }
  }, []);

  const isSetup = screen === "setup";
  const activePlayer =
    isOnline && onlineRoom
      ? onlineRoom.youAre === "spectator"
        ? onlineRoom.turn
        : isSetup
          ? onlineRoom.youAre
          : onlineRoom.turn
      : localActivePlayer;
  const isRotated = onlineRoom?.youAre === 2 || (!isOnline && activePlayer === 2);
  const currentPool = isOnline && onlineRoom ? onlineRoom.reserve : pools[activePlayer - 1];
  const activeSetupPiece =
    selectedPiece && currentPool[selectedPiece] > 0
      ? selectedPiece
      : PIECES.find((piece) => currentPool[piece.kind] > 0)?.kind ?? null;
  const placedCount = Object.values(currentPool).reduce((sum, count) => sum + count, 0);
  const activePlayerName =
    isOnline && onlineRoom
      ? onlineRoom.players[activePlayer - 1] ?? playerName(activePlayer)
      : playerName(activePlayer);
  const currentMoveCount = isOnline && onlineRoom ? onlineRoom.moveCount : moveCount;
  const gameWinner = isOnline && onlineRoom ? onlineRoom.winner : winner;
  const capturedPieces = onlineRoom?.captured ?? localCaptured;
  const lastMove = isOnline ? onlineRoom?.lastMove ?? null : localLastMove;
  const winReason = isOnline && onlineRoom ? onlineRoom.winReason : localWinReason;
  const showCelebration =
    gameWinner !== null &&
    (screen === "finished" || (isOnline && onlineRoom?.phase === "finished")) &&
    !celebrationDismissed;
  const winnerName = gameWinner
    ? onlineRoom?.players[gameWinner - 1] ?? playerName(gameWinner)
    : "";
  const winnerColor = gameWinner === 1 ? "White" : "Black";
  const canRequestRematch = Boolean(onlineRoom && onlineRoom.youAre !== "spectator");
  const ownRematchRequested = onlineRoom && onlineRoom.youAre !== "spectator"
    ? onlineRoom.rematch[onlineRoom.youAre - 1]
    : false;
  const opponentRematchRequested = onlineRoom && onlineRoom.youAre !== "spectator"
    ? onlineRoom.rematch[onlineRoom.youAre === 1 ? 1 : 0]
    : false;
  const clockValue = (player: Player) => {
    if (!onlineRoom || onlineRoom.clocksMs[player - 1] === null) return null;
    const stored = onlineRoom.clocksMs[player - 1] ?? 0;
    const isRunning = onlineRoom.phase === "playing" &&
      onlineRoom.turn === player &&
      onlineRoom.clockStartedAt !== null;
    const elapsed = isRunning
      ? Math.max(0, clockNow - Date.parse(onlineRoom.clockStartedAt ?? ""))
      : 0;
    return Math.max(0, stored - elapsed);
  };
  const formatClock = (milliseconds: number | null) => {
    if (milliseconds === null) return "—";
    const totalSeconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  };
  const lastMoveText = lastMove
    ? (() => {
        const mover = onlineRoom?.players[lastMove.player - 1] ?? playerName(lastMove.player);
        const destination = squareNotation(lastMove.toRow, lastMove.toCol);
        if (lastMove.result === "capture") {
          return `${mover}'s ${pieceName(lastMove.movedKind ?? "P")} captured ${lastMove.capturedKinds.map(pieceName).join(" and ")} at ${destination}.`;
        }
        if (lastMove.result === "lost") {
          return `${mover}'s ${pieceName(lastMove.movedKind ?? "P")} was captured at ${destination}.`;
        }
        if (lastMove.result === "mutual") {
          const opposingKind = lastMove.capturedKinds[0];
          return `${mover}'s ${pieceName(lastMove.movedKind ?? "P")} clashed with ${opposingKind ? pieceName(opposingKind) : "an opposing piece"}; both were removed at ${destination}.`;
        }
        return `${mover} moved a hidden piece from ${squareNotation(lastMove.fromRow, lastMove.fromCol)} to ${destination}.`;
      })()
    : "No moves have been made yet.";

  function getRoomTimeControlSeconds() {
    if (timeChoice === "untimed") return null;
    const minutes = timeChoice === "custom" ? Number(customMinutes) : Number(timeChoice);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) return null;
    return minutes * 60;
  }

  const applyRoomSnapshot = useCallback((room: PublicRoom) => {
    const current = onlineRoomRef.current;
    if (current?.roomId === room.roomId && current.version > room.version) return false;
    if (current?.roomId === room.roomId && room.moveCount > current.moveCount) {
      playMoveSound();
    }
    onlineRoomRef.current = room;
    setOnlineRoom(room);
    setScreen(screenForRoom(room));
    setSelectedSquare(null);
    return true;
  }, [playMoveSound]);

  function isLatestMoveSquare(row: number, col: number) {
    return Boolean(
      lastMove &&
      ((lastMove.fromRow === row && lastMove.fromCol === col) ||
        (lastMove.toRow === row && lastMove.toCol === col)),
    );
  }

  useEffect(() => {
    const defaultTitle = document.title.startsWith("Your turn · ")
      ? "SLPKN PH | Salpakan"
      : document.title;
    const updateTitle = () => {
      const isYourTurn =
        isOnline &&
        onlineRoom?.phase === "playing" &&
        onlineRoom.youAre !== "spectator" &&
        onlineRoom.turn === onlineRoom.youAre;
      document.title = isYourTurn ? "Your turn · SLPKN PH" : defaultTitle;
    };

    updateTitle();
    document.addEventListener("visibilitychange", updateTitle);
    return () => {
      document.removeEventListener("visibilitychange", updateTitle);
      document.title = defaultTitle;
    };
  }, [isOnline, onlineRoom?.phase, onlineRoom?.turn, onlineRoom?.youAre]);

  useEffect(() => {
    if (
      !isOnline ||
      onlineRoom?.phase !== "playing" ||
      onlineRoom.timeControlSeconds === null
    ) return;
    const interval = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [isOnline, onlineRoom?.phase, onlineRoom?.timeControlSeconds]);

  useEffect(() => {
    if (
      !isOnline ||
      !onlineRoom ||
      onlineRoom.phase !== "playing" ||
      onlineRoom.timeControlSeconds === null ||
      onlineRoom.youAre === "spectator" ||
      !playerToken ||
      !onlineRoom.clockStartedAt
    ) return;

    const remaining = onlineRoom.clocksMs[onlineRoom.turn - 1];
    if (remaining === null) return;
    const elapsed = Math.max(0, clockNow - Date.parse(onlineRoom.clockStartedAt));
    if (remaining > elapsed) return;

    const previousAttempt = timeoutRequestRef.current;
    if (
      previousAttempt?.version === onlineRoom.version &&
      previousAttempt.retryAt > clockNow
    ) return;
    timeoutRequestRef.current = { version: onlineRoom.version, retryAt: clockNow + 5000 };

    void (async () => {
      try {
        const response = await fetch(`/api/rooms/${onlineRoom.roomId}/action`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${playerToken}`,
          },
          body: JSON.stringify({ type: "claim-timeout" }),
        });
        const result: unknown = await response.json();
        if (response.ok && onlineRoomRef.current?.roomId === onlineRoom.roomId) {
          const room = result as PublicRoom;
          onlineRoomRef.current = room;
          setOnlineRoom(room);
          setScreen(screenForRoom(room));
          setRoomError("");
        } else if (response.status !== 400 && response.status !== 409) {
          setRoomError(getErrorMessage(result, "Could not check the expired game clock."));
        }
      } catch (error) {
        if (onlineRoomRef.current?.roomId === onlineRoom.roomId) {
          setRoomError(error instanceof Error ? error.message : "Could not check the expired game clock.");
        }
      }
    })();
  }, [clockNow, isOnline, onlineRoom, playerToken]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await Promise.resolve();
      if (!active) return;
      const savedName = window.localStorage.getItem("slpkn-guest-name");
      if (savedName) setGuestName(savedName);

      const query = new URLSearchParams(window.location.search);
      const roomId = query.get("room");
      if (!roomId) return;
      const invitation = query.get("invite") ?? "";
      if (query.get("watch") === "1") {
        void openSpectatorRoom(roomId);
        return;
      }

      const rawCredentials = window.localStorage.getItem(roomStorageKey(roomId));
      if (rawCredentials) {
        try {
          const credentials = JSON.parse(rawCredentials) as RoomCredentials;
          if (typeof credentials.token === "string" && (credentials.player === 1 || credentials.player === 2)) {
            const response = await fetch(`/api/rooms/${roomId}`, {
              cache: "no-store",
              headers: { Authorization: `Bearer ${credentials.token}` },
            });
            const result: unknown = await response.json();
            if (!response.ok) throw new Error(getErrorMessage(result, "Could not open this room."));
            const room = result as PublicRoom;
            onlineRoomRef.current = room;
            setOnlineRoom(room);
            setPlayerToken(credentials.token);
            setLocalActivePlayer(credentials.player);
            setIsOnline(true);
            setScreen(screenForRoom(room));
            setNotice(room.phase === "playing" ? "The board is synced with the room." : "Set up your army.");
            setInviteToken(
              invitation ||
                window.localStorage.getItem(`slpkn-invite:${roomId}`),
            );
            return;
          }
        } catch (error) {
          window.localStorage.removeItem(roomStorageKey(roomId));
          if (active) setRoomError(error instanceof Error ? error.message : "Could not open this room.");
        }
      }
      if (!active) return;
      if (invitation) {
        setPendingRoom(roomId);
        setPendingInvite(invitation);
        setScreen("join");
      } else {
        setRoomError("Room credentials were not found on this device. Join again from the room invitation.");
        setScreen("rooms");
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);

  const refreshRoomList = useCallback(async () => {
    setRoomListRefreshing(true);
    try {
      const response = await fetch("/api/rooms", { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not load rooms."));
      if (Array.isArray(result)) setRoomList(result as RoomSummary[]);
      setRoomError("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Could not load rooms.");
    } finally {
      setRoomListRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (screen !== "rooms") return;
    const timeout = window.setTimeout(() => void refreshRoomList(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshRoomList, screen]);

  useEffect(() => {
    if (!isOnline || !onlineRoom || screen === "rooms" || screen === "home" || screen === "join") return;
    let active = true;
    const refreshRoom = async () => {
      if (isRefreshing.current) return;
      isRefreshing.current = true;
      try {
        const watch = onlineRoom.youAre === "spectator";
        const response = await fetch(
          `/api/rooms/${onlineRoom.roomId}${watch ? "?watch=1" : ""}`,
          {
            cache: "no-store",
            headers: playerToken ? { Authorization: `Bearer ${playerToken}` } : {},
          },
        );
        const result: unknown = await response.json();
        if (!response.ok) throw new Error(getErrorMessage(result, "Could not refresh the game."));
        if (active) {
          const nextRoom = result as PublicRoom;
          setRoomError("");
          if (nextRoom.version !== onlineRoom.version) {
            applyRoomSnapshot(nextRoom);
          }
        }
      } catch (error) {
        if (active) setRoomError(error instanceof Error ? error.message : "Could not refresh the game.");
      } finally {
        isRefreshing.current = false;
      }
    };
    const interval = window.setInterval(() => void refreshRoom(), ROOM_POLL_INTERVAL);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [applyRoomSnapshot, isOnline, onlineRoom, playerToken, screen]);

  async function openPlayerRoom(roomId: string, token: string) {
    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not open this room."));
      const room = result as PublicRoom;
      applyRoomSnapshot(room);
      setPlayerToken(token);
      setIsOnline(true);
      setLocalActivePlayer(room.youAre === 2 ? 2 : 1);
      setScreen(screenForRoom(room));
      setSelectedPiece(null);
      setSelectedSquare(null);
      setRoomError("");
      setNotice(room.phase === "playing" ? "The board is synced with the room." : "Set up your army.");
      window.history.replaceState({}, "", `/?room=${encodeURIComponent(roomId)}`);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Could not open this room.");
      setScreen("rooms");
    }
  }

  async function openSpectatorRoom(roomId: string) {
    try {
      const response = await fetch(`/api/rooms/${roomId}?watch=1`, { cache: "no-store" });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not watch this room."));
      const room = result as PublicRoom;
      onlineRoomRef.current = room;
      setOnlineRoom(room);
      setPlayerToken(null);
      setIsOnline(true);
      setScreen("watching");
      window.history.replaceState({}, "", `/?room=${encodeURIComponent(roomId)}&watch=1`);
      setRoomError("");
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Could not watch this room.");
      setScreen("rooms");
    }
  }

  function rememberGuest(name: string) {
    const normalized = name.trim();
    if (normalized.length < 1 || normalized.length > 24) {
      setRoomError("Enter a name between 1 and 24 characters.");
      return null;
    }
    window.localStorage.setItem("slpkn-guest-name", normalized);
    setGuestName(normalized);
    setRoomError("");
    return normalized;
  }

  async function createOnlineRoom(visibility: "public" | "private") {
    const name = rememberGuest(guestName);
    if (!name) return;
    if (timeChoice === "custom" && (!Number.isInteger(Number(customMinutes)) || Number(customMinutes) < 1 || Number(customMinutes) > 60)) {
      setRoomError("Enter a custom clock between 1 and 60 minutes.");
      return;
    }
    setRoomLoading(true);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visibility, timeControlSeconds: getRoomTimeControlSeconds() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not create a room."));
      const room = result.room as PublicRoom;
      const token = result.playerToken as string;
      const invitation = result.inviteToken as string;
      window.localStorage.setItem(roomStorageKey(room.roomId), JSON.stringify({ token, player: 1 }));
      if (visibility === "private") {
        window.localStorage.setItem(`slpkn-invite:${room.roomId}`, invitation);
      }
      setInviteToken(visibility === "private" ? invitation : null);
      onlineRoomRef.current = room;
      setOnlineRoom(room);
      setPlayerToken(token);
      setIsOnline(true);
      setScreen("setup");
      window.history.pushState(
        {},
        "",
        visibility === "private"
          ? `/?room=${room.roomId}&invite=${encodeURIComponent(invitation)}`
          : `/?room=${room.roomId}`,
      );
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Could not create a room.");
    } finally {
      setRoomLoading(false);
    }
  }

  async function joinRoom(roomId: string, invitation = "") {
    const name = rememberGuest(guestName);
    if (!name) return;
    setRoomLoading(true);
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, inviteToken: invitation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not join this room."));
      const token = result.playerToken as string;
      window.localStorage.setItem(roomStorageKey(roomId), JSON.stringify({ token, player: 2 }));
      setPendingRoom(null);
      setPendingInvite("");
      await openPlayerRoom(roomId, token);
    } catch (error) {
      setRoomError(error instanceof Error ? error.message : "Could not join this room.");
    } finally {
      setRoomLoading(false);
    }
  }

  async function sendOnlineAction(action: Record<string, unknown>) {
    if (!onlineRoom || !playerToken) return false;
    const roomBeforeAction = onlineRoom;
    const optimisticRoom: PublicRoom = {
      ...onlineRoom,
      board: onlineRoom.board.map((row) => [...row]),
      reserve: { ...onlineRoom.reserve },
    };
    const row = action.row;
    const col = action.col;
    if (
      action.type === "place" &&
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      (row as number) >= 0 &&
      (row as number) < 8 &&
      (col as number) >= 0 &&
      (col as number) < 9
    ) {
      const piece = PIECES.find((item) => item.kind === action.kind);
      if (piece && optimisticRoom.reserve[piece.kind] > 0) {
        optimisticRoom.board[row as number][col as number] = {
          kind: piece.kind,
          owner: onlineRoom.youAre === 2 ? 2 : 1,
        };
        optimisticRoom.reserve[piece.kind] -= 1;
      }
    } else if (
      action.type === "remove" &&
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      (row as number) >= 0 &&
      (row as number) < 8 &&
      (col as number) >= 0 &&
      (col as number) < 9
    ) {
      const placed = optimisticRoom.board[row as number][col as number];
      if (placed && "kind" in placed && placed.owner === onlineRoom.youAre) {
        optimisticRoom.board[row as number][col as number] = null;
        optimisticRoom.reserve[placed.kind] += 1;
      }
    } else if (
      action.type === "move" &&
      onlineRoom.youAre !== "spectator" &&
      Number.isInteger(action.fromRow) &&
      Number.isInteger(action.fromCol) &&
      Number.isInteger(action.toRow) &&
      Number.isInteger(action.toCol)
    ) {
      const fromRow = action.fromRow as number;
      const fromCol = action.fromCol as number;
      const toRow = action.toRow as number;
      const toCol = action.toCol as number;
      const attacker = optimisticRoom.board[fromRow]?.[fromCol];
      const defender = optimisticRoom.board[toRow]?.[toCol];
      if (
        fromRow >= 0 && fromRow < 8 && fromCol >= 0 && fromCol < 9 &&
        toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 9 &&
        attacker && "kind" in attacker && attacker.owner === onlineRoom.youAre &&
        defender?.owner !== onlineRoom.youAre
      ) {
        optimisticRoom.board[toRow][toCol] = attacker;
        optimisticRoom.board[fromRow][fromCol] = null;
      }
    }
    if (action.type === "place" || action.type === "remove" || action.type === "move") {
      onlineRoomRef.current = optimisticRoom;
      setOnlineRoom(optimisticRoom);
    }
    setRoomLoading(true);
    try {
      const response = await fetch(`/api/rooms/${onlineRoom.roomId}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${playerToken}`,
        },
        body: JSON.stringify(action),
      });
      const result: unknown = await response.json();
      if (response.status === 409) {
        await openPlayerRoom(onlineRoom.roomId, playerToken);
        setRoomError("");
        setNotice("The room changed while your move was being sent. The board has been refreshed.");
        return false;
      }
      if (!response.ok) throw new Error(getErrorMessage(result, "Could not update the game."));
      const room = result as PublicRoom;
      applyRoomSnapshot(room);
      setSelectedSquare(null);
      setRoomError("");
      if (action.type === "place") playMoveSound();
      setNotice(
        action.type === "rematch" && room.phase === "finished"
          ? "Rematch requested. Waiting for your opponent."
          : action.type === "rematch" && room.rematchSetup
            ? "Both players agreed. Your saved formations are ready to edit."
          : room.phase === "playing"
            ? `${room.players[room.turn - 1]}'s turn.`
            : notice,
      );
      return true;
    } catch (error) {
      if (roomBeforeAction) applyRoomSnapshot(roomBeforeAction);
      setRoomError(error instanceof Error ? error.message : "Could not update the game.");
      return false;
    } finally {
      setRoomLoading(false);
    }
  }

  function exitOnlineRoom() {
    setIsOnline(false);
    onlineRoomRef.current = null;
    setOnlineRoom(null);
    setPlayerToken(null);
    setInviteToken(null);
    setSelectedSquare(null);
    setSelectedPiece(null);
    setScreen("rooms");
    window.history.pushState({}, "", "/");
  }

  async function copyInvitation() {
    if (!onlineRoom || !inviteToken) return;
    const url = new URL("/", window.location.origin);
    url.searchParams.set("room", onlineRoom.roomId);
    url.searchParams.set("invite", inviteToken);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1800);
    } catch (error) {
      setRoomError(error instanceof Error ? `Could not copy invitation link: ${error.message}` : "Could not copy invitation link.");
    }
  }

  function startGame() {
    setIsOnline(false);
    setOnlineRoom(null);
    setPlayerToken(null);
    setBoard(createBoard());
    setPools([createPieceCounts(), createPieceCounts()]);
    setLocalCaptured([[], []]);
    setLocalLastMove(null);
    setLocalActivePlayer(1);
    setSelectedPiece(null);
    setSelectedSquare(null);
    setWinner(null);
    setLocalWinReason(null);
    setCelebrationDismissed(false);
    setMoveCount(0);
    setNotice("Choose a piece, then place it on your side of the board.");
    setScreen("setup");
  }

  function toBoardPosition(displayRow: number, displayCol: number): Position {
    return isRotated
      ? { row: 7 - displayRow, col: 8 - displayCol }
      : { row: displayRow, col: displayCol };
  }

  function onSetupSquare(position: Position) {
    if (isOnline) {
      const piece = onlineRoom?.board[position.row][position.col];
      if (piece?.owner === activePlayer && "kind" in piece) {
        void sendOnlineAction({ type: "remove", row: position.row, col: position.col });
      } else if (activeSetupPiece) {
        void sendOnlineAction({
          type: "place",
          row: position.row,
          col: position.col,
          kind: activeSetupPiece,
        });
      } else {
        setNotice("Select a piece from your reserve before placing it.");
      }
      return;
    }

    const piece = board[position.row][position.col];
    if (piece?.owner === activePlayer) {
      const nextBoard = board.map((row) => [...row]);
      nextBoard[position.row][position.col] = null;
      const nextPools = pools.map((pool) => ({ ...pool }));
      nextPools[activePlayer - 1][piece.kind] += 1;
      setBoard(nextBoard);
      setPools(nextPools);
      setNotice(`${pieceName(piece.kind)} returned to your reserve.`);
      return;
    }

    const onOwnSide = activePlayer === 1 ? position.row >= 5 : position.row <= 2;
    if (!onOwnSide) {
      setNotice("Place your pieces in the three rows closest to you.");
      return;
    }
    if (piece) {
      setNotice("That square is occupied. Remove your own piece first.");
      return;
    }
    if (!activeSetupPiece) {
      setNotice("Select a piece from your reserve before placing it.");
      return;
    }

    const nextBoard = board.map((row) => [...row]);
    nextBoard[position.row][position.col] = { kind: activeSetupPiece, owner: activePlayer };
    const nextPools = pools.map((pool) => ({ ...pool }));
    nextPools[activePlayer - 1][activeSetupPiece] -= 1;
    setBoard(nextBoard);
    setPools(nextPools);
    playMoveSound();
    setNotice(`${pieceName(activeSetupPiece)} placed. Arrange your remaining forces.`);
  }

  function finishSetup() {
    if (isOnline) {
      setSelectedPiece(null);
      void sendOnlineAction({ type: "ready" });
      return;
    }
    if (!allPiecesPlaced(currentPool)) {
      setNotice(`Place all your pieces before continuing. ${placedCount} remaining.`);
      return;
    }
    setSelectedPiece(null);
    if (activePlayer === 1) {
      setLocalActivePlayer(2);
      setNotice("Player 1 is ready. Pass the device to Player 2 to arrange their army.");
      return;
    }
    setLocalActivePlayer(1);
    setScreen("playing");
    setNotice("Both armies are ready. Player 1 moves first.");
  }

  function onGameSquare(position: Position) {
    if (isOnline && onlineRoom?.youAre !== "spectator") {
      const piece = onlineRoom?.board[position.row][position.col] ?? null;
      if (!selectedSquare) {
        if (piece && piece.owner === activePlayer && "kind" in piece) {
          setSelectedSquare(position);
          setNotice(`${pieceName(piece.kind)} selected. Choose an adjacent square.`);
        } else {
          setNotice("Select one of your own pieces to move.");
        }
        return;
      }
      if (piece?.owner === activePlayer) {
        if ("kind" in piece) {
          setSelectedSquare(position);
          setNotice(`${pieceName(piece.kind)} selected. Choose an adjacent square.`);
        }
        return;
      }
      const rowDistance = Math.abs(position.row - selectedSquare.row);
      const colDistance = Math.abs(position.col - selectedSquare.col);
      if (Math.max(rowDistance, colDistance) !== 1) {
        setSelectedSquare(null);
        setNotice("Pieces move one square in any direction, including diagonally.");
        return;
      }
      void sendOnlineAction({
        type: "move",
        fromRow: selectedSquare.row,
        fromCol: selectedSquare.col,
        toRow: position.row,
        toCol: position.col,
      });
      return;
    }
    if (isOnline) {
      setNotice("Spectators can watch the match but cannot move pieces.");
      return;
    }

    const piece = board[position.row][position.col];
    if (!selectedSquare) {
      if (piece?.owner === activePlayer) {
        setSelectedSquare(position);
        setNotice(`${pieceName(piece.kind)} selected. Choose an adjacent square.`);
      } else {
        setNotice("Select one of your own pieces to move.");
      }
      return;
    }

    const movingPiece = board[selectedSquare.row][selectedSquare.col];
    if (piece?.owner === activePlayer) {
      setSelectedSquare(position);
      setNotice(`${pieceName(piece.kind)} selected. Choose an adjacent square.`);
      return;
    }

    const rowDistance = Math.abs(position.row - selectedSquare.row);
    const colDistance = Math.abs(position.col - selectedSquare.col);
    if (Math.max(rowDistance, colDistance) !== 1) {
      setSelectedSquare(null);
      setNotice("Pieces move one square in any direction, including diagonally.");
      return;
    }
    if (!movingPiece) {
      setSelectedSquare(null);
      setNotice("Select a piece to move.");
      return;
    }

    const nextBoard = board.map((row) => [...row]);
    const nextCaptured: [PieceKind[], PieceKind[]] = [
      [...localCaptured[0]],
      [...localCaptured[1]],
    ];
    let battleNotice: string;
    let result: PublicLastMove["result"] = "move";
    let movedKind: PieceKind | null = null;
    const capturedKinds: PieceKind[] = [];
    if (!piece) {
      nextBoard[position.row][position.col] = movingPiece;
      battleNotice = `${pieceName(movingPiece.kind)} moved.`;
    } else {
      const victoriousPiece = combatWinner(movingPiece, piece);
      if (victoriousPiece === movingPiece) {
        nextBoard[position.row][position.col] = movingPiece;
        nextCaptured[activePlayer - 1].push(piece.kind);
        result = "capture";
        movedKind = movingPiece.kind;
        capturedKinds.push(piece.kind);
        battleNotice = `${pieceName(movingPiece.kind)} defeats ${pieceName(piece.kind)}.`;
      } else if (victoriousPiece === piece) {
        nextCaptured[piece.owner - 1].push(movingPiece.kind);
        result = "lost";
        movedKind = movingPiece.kind;
        capturedKinds.push(movingPiece.kind);
        battleNotice = `${pieceName(piece.kind)} defeats ${pieceName(movingPiece.kind)}.`;
      } else {
        nextBoard[position.row][position.col] = null;
        nextCaptured[activePlayer - 1].push(piece.kind);
        nextCaptured[piece.owner - 1].push(movingPiece.kind);
        result = "mutual";
        movedKind = movingPiece.kind;
        capturedKinds.push(movingPiece.kind, piece.kind);
        battleNotice = `${pieceName(movingPiece.kind)} and ${pieceName(piece.kind)} have equal rank. Both are removed.`;
      }
    }
    setLocalLastMove({
      fromRow: selectedSquare.row,
      fromCol: selectedSquare.col,
      toRow: position.row,
      toCol: position.col,
      player: activePlayer,
      result,
      movedKind,
      capturedKinds,
    });
    nextBoard[selectedSquare.row][selectedSquare.col] = null;
    setBoard(nextBoard);
    setLocalCaptured(nextCaptured);
    setSelectedSquare(null);
    setMoveCount((count) => count + 1);
    playMoveSound();
    const gameWinner = findWinner(nextBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setLocalWinReason(getWinReason(nextBoard, gameWinner));
      setCelebrationDismissed(false);
      setScreen("finished");
      setNotice(`${gameWinner === 1 ? "White" : "Black"} wins!`);
      return;
    }
    const nextPlayer: Player = activePlayer === 1 ? 2 : 1;
    setLocalActivePlayer(nextPlayer);
    setNotice(`${battleNotice} ${playerName(nextPlayer)}'s turn.`);
  }

  function surrender() {
    if (isOnline) {
      void sendOnlineAction({ type: "surrender" });
      return;
    }
    const winningPlayer: Player = activePlayer === 1 ? 2 : 1;
    setWinner(winningPlayer);
    setLocalWinReason("surrender");
    setCelebrationDismissed(false);
    setScreen("finished");
    setNotice(`${playerName(activePlayer)} surrendered. ${playerName(winningPlayer)} wins!`);
  }

  function requestRematch() {
    void sendOnlineAction({ type: "rematch" });
  }

  function displayPiece(piece: BoardCell) {
    if (!piece) return null;
    if ("hidden" in piece) {
      return <span className="piece-hidden spectator-piece" aria-label="Hidden piece" />;
    }
    const definition = PIECES.find((item) => item.kind === piece.kind);
    return (
      <Image
        className="piece-image"
        src={pieceImagePath(piece.kind, piece.owner)}
        alt=""
        width={123}
        height={74}
        title={definition?.name}
        draggable={false}
      />
    );
  }

  function renderBoard() {
    const activeBoard = isOnline && onlineRoom ? onlineRoom.board : board;
    const isSpectator = isOnline && onlineRoom?.youAre === "spectator";
    return (
      <div className="board-frame">
        <div className="board-coordinate board-top" aria-hidden="true">
          {"ABCDEFGHI".split("").map((letter) => <span key={letter}>{letter}</span>)}
        </div>
        <div className="board-row-wrap">
          <div className="board-coordinate board-side" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <span key={index}>{isRotated ? index + 1 : 8 - index}</span>)}
          </div>
          <div className="game-board" role="grid" aria-label="Game board">
            {Array.from({ length: 8 }, (_, displayRow) =>
              Array.from({ length: 9 }, (_, displayCol) => {
                const position = toBoardPosition(displayRow, displayCol);
                const piece = activeBoard[position.row][position.col] as BoardCell;
                const isHiddenOpponent = piece && (
                  "hidden" in piece ||
                  (isOnline
                    ? onlineRoom?.youAre === "spectator" || piece.owner !== onlineRoom?.youAre
                    : piece.owner !== activePlayer)
                );
                const isSelected =
                  selectedSquare?.row === position.row && selectedSquare.col === position.col;
                const isLastMoveFrom =
                  lastMove?.fromRow === position.row && lastMove.fromCol === position.col;
                const isLastMoveTo =
                  lastMove?.toRow === position.row && lastMove.toCol === position.col;
                const isSetupZone = isSetup && (activePlayer === 1 ? position.row >= 5 : position.row <= 2);
                const squareLabel = piece
                  ? isSpectator
                    ? `Hidden piece at row ${position.row + 1}, column ${position.col + 1}`
                    : isHiddenOpponent
                      ? `Opponent piece at row ${position.row + 1}, column ${position.col + 1}`
                      : "kind" in piece
                        ? `${playerName(piece.owner)} ${pieceName(piece.kind)} at row ${position.row + 1}, column ${position.col + 1}`
                        : `Hidden piece at row ${position.row + 1}, column ${position.col + 1}`
                  : `Empty square at row ${position.row + 1}, column ${position.col + 1}`;
                return (
                  <button
                    className={[
                      "board-square",
                      (displayRow + displayCol) % 2 === 0 ? "square-light" : "square-dark",
                      isSetupZone ? "setup-zone" : "",
                      isSelected ? "square-selected" : "",
                      isLatestMoveSquare(position.row, position.col) ? "square-last-move" : "",
                      isLastMoveFrom ? "square-last-move-from" : "",
                      isLastMoveTo ? "square-last-move-to" : "",
                    ].filter(Boolean).join(" ")}
                    key={`${displayRow}-${displayCol}`}
                    type="button"
                    role="gridcell"
                    aria-label={squareLabel}
                    title={piece
                      ? isSpectator
                        ? "Hidden piece"
                        : isHiddenOpponent
                          ? "Opponent piece — rank hidden"
                          : "kind" in piece
                            ? pieceName(piece.kind)
                            : "Hidden piece"
                      : undefined}
                    disabled={isOnline && roomLoading}
                    onClick={() => isSetup ? onSetupSquare(position) : onGameSquare(position)}
                  >
                    {isHiddenOpponent ? (
                      <span className="piece-hidden" aria-hidden="true">✦</span>
                    ) : (
                      displayPiece(piece)
                    )}
                  </button>
                );
              }),
            )}
          </div>
          <div className="board-coordinate board-side" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <span key={index}>{isRotated ? 8 - index : index + 1}</span>)}
          </div>
        </div>
        <div className="board-coordinate board-bottom" aria-hidden="true">
          {"ABCDEFGHI".split("").map((letter) => <span key={letter}>{letter}</span>)}
        </div>
      </div>
    );
  }

  if (screen === "rooms" || screen === "join") {
    const isJoin = screen === "join";
    return (
      <main className="site-shell rooms-shell">
        <header className="site-header">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setScreen("home"); }} aria-label="SLPKN PH home">
            <span className="brand-mark">S</span><span>SLPKN <b>PH</b></span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <button type="button" className="header-home" onClick={() => setScreen("home")}>Back home <span>↗</span></button>
          </nav>
        </header>
        <section className="rooms-heading">
          <span className="eyebrow"><span className="eyebrow-line" /> {isJoin ? "ROOM INVITATION" : "CHALLENGE LOBBY"}</span>
          <h1>{isJoin ? <>Join the <em>challenge.</em></> : <>Find your <em>opponent.</em></>}</h1>
          <p>
            {isJoin
              ? "Choose a guest name to join this room. Keep it secret, keep it strategic."
              : "Open a room for anyone to join, create a private invite-only room, or watch a public match."}
          </p>
        </section>
        <section className="room-actions-panel">
          <label className="guest-name-field">
            <span>YOUR GUEST NAME</span>
            <input
              maxLength={24}
              value={guestName}
              onChange={(event) => { setGuestName(event.target.value); setRoomError(""); }}
              placeholder="Enter your name"
            />
          </label>
          {isJoin ? (
            <button
              className="button-primary"
              type="button"
              disabled={roomLoading || !guestName.trim()}
              onClick={() => pendingRoom && void joinRoom(pendingRoom, pendingInvite)}
            >
              {roomLoading ? "Joining room..." : "Join this room"} <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <>
              <label className="time-control-field">
                <span>TIME CONTROL</span>
                <select
                  value={timeChoice}
                  onChange={(event) => {
                    setTimeChoice(event.target.value as typeof timeChoice);
                    setRoomError("");
                  }}
                >
                  <option value="untimed">Untimed</option>
                  <option value="5">5 minutes per player</option>
                  <option value="10">10 minutes per player</option>
                  <option value="custom">Custom (1–60 minutes)</option>
                </select>
                {timeChoice === "custom" && (
                  <input
                    aria-label="Custom time in minutes per player"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    step={1}
                    value={customMinutes}
                    onChange={(event) => {
                      setCustomMinutes(event.target.value);
                      setRoomError("");
                    }}
                  />
                )}
                <small>Each clock runs only on its player’s turn. Reaching zero loses.</small>
              </label>
              <div className="room-create-actions">
                <button
                  className="button-primary"
                  type="button"
                  disabled={roomLoading || !guestName.trim()}
                  onClick={() => void createOnlineRoom("public")}
                >
                  Open public room <span aria-hidden="true">↗</span>
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={roomLoading || !guestName.trim()}
                  onClick={() => void createOnlineRoom("private")}
                >
                  Create private room <span aria-hidden="true">⌑</span>
                </button>
              </div>
            </>
          )}
          {roomError && <p className="room-error" role="alert">{roomError}</p>}
        </section>
        {!isJoin && (
          <section className="room-list-section">
            <div className="room-list-heading">
              <div><span className="eyebrow"><span className="eyebrow-line" /> OPEN ROOMS</span><h2>Challenges & matches</h2></div>
              <button
                className="room-refresh-button"
                type="button"
                onClick={() => void refreshRoomList()}
                disabled={roomListRefreshing}
                aria-label={roomListRefreshing ? "Refreshing public rooms" : "Refresh public rooms"}
              >
                <span aria-hidden="true">{roomListRefreshing ? "…" : "↻"}</span>
                {roomListRefreshing ? "Refreshing..." : "Refresh rooms"}
              </button>
            </div>
            {roomList.length === 0 ? (
              <div className="empty-room-list">
                <span className="empty-room-mark">✦</span>
                <h3>No public rooms yet</h3>
                <p>Start the first challenge, or refresh to check for rooms.</p>
              </div>
            ) : (
              <div className="room-list">
                {roomList.map((room) => {
                  const isWaiting = room.phase === "setup" && !room.opponent;
                  return (
                    <article className="room-list-item" key={room.roomId}>
                      <div className="room-kind-mark">{isWaiting ? "＋" : "✦"}</div>
                      <div className="room-list-info">
                        <strong>{room.host}{room.opponent ? ` vs ${room.opponent}` : " · waiting for opponent"}</strong>
                        <span>
                          {isWaiting ? "Open challenge" : room.phase === "playing" ? `${room.moveCount} moves played` : "Match complete"}
                          {" · "}
                          {room.timeControlSeconds === null
                            ? "Untimed"
                            : `${Math.floor(room.timeControlSeconds / 60)} min`}
                        </span>
                      </div>
                      <span className={`room-phase-tag ${isWaiting ? "waiting" : ""}`}>
                        {isWaiting ? "OPEN" : room.phase === "playing" ? "LIVE" : "FINISHED"}
                      </span>
                      {isWaiting ? (
                        <button
                          className="room-entry-button"
                          type="button"
                          disabled={roomLoading || !guestName.trim()}
                          onClick={() => void joinRoom(room.roomId)}
                        >
                          Join <span>↗</span>
                        </button>
                      ) : (
                        <button
                          className="room-entry-button"
                          type="button"
                          onClick={() => void openSpectatorRoom(room.roomId)}
                        >
                          Watch <span>↗</span>
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <footer className="site-footer rooms-footer">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setScreen("home"); }}>
            <span className="brand-mark">S</span><span>SLPKN <b>PH</b></span>
          </a>
          <span>Public matches are visible to spectators. Private rooms require an invitation.</span>
        </footer>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <main className="site-shell">
        <header className="site-header">
          <a className="brand" href="#" aria-label="SLPKN PH home">
            <span className="brand-mark">S</span>
            <span>SLPKN <b>PH</b></span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#how-to-play">How to play</a>
            <a className="history-nav-link" href="/history">Game history</a>
            <button className="local-badge rooms-nav-button" type="button" onClick={() => { setRoomError(""); setScreen("rooms"); }}>
              <span /> CHALLENGE ROOMS
            </button>
          </nav>
        </header>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> A FILIPINO STRATEGY CLASSIC</span>
            <h1>Outthink.<br /><em>Outmaneuver.</em><br />Win the field.</h1>
            <p className="hero-description">
              Lead your army in a battle of bluff, memory, and strategy. Hide your ranks, read your rival, and make every move count.
            </p>
            <div className="hero-actions">
              <button className="button-secondary" type="button" onClick={() => { setRoomError(""); setScreen("rooms"); }}>
                Play online <span aria-hidden="true">↗</span>
              </button>
              <button className="button-primary" type="button" onClick={startGame}>
                Play locally <span aria-hidden="true">↗</span>
              </button>
              <a className="text-link" href="#how-to-play">Learn the rules <span>↓</span></a>
            </div>
            <div className="hero-meta"><span>♙</span> Private invites · Public challenges · Live spectators</div>
          </div>
          <div className="hero-art" aria-label="Illustration of the SLPKN PH game board">
            <div className="art-glow" />
            <div className="art-stamp">STRATEGY<br />MEETS<br />INSTINCT</div>
            <div className="hero-board">
              {[
                ["", "★", "", "✦", "", "★", "", ""],
                ["♟", "", "♜", "", "♝", "", "♟", ""],
                ["", "♞", "", "", "", "♚", "", "♟"],
                ["", "", "✧", "", "✧", "", "", ""],
                ["", "", "", "✧", "", "✧", "", ""],
                ["♟", "", "♛", "", "", "♜", "", ""],
                ["", "♟", "", "♝", "", "♟", "", "♞"],
                ["⚑", "", "♟", "", "♜", "", "♟", ""],
              ].flatMap((row, rowIndex) =>
                row.map((symbol, colIndex) => (
                  <div
                    className={`art-cell ${(rowIndex + colIndex) % 2 ? "art-cell-dark" : ""} ${symbol === "✧" ? "art-water" : ""}`}
                    key={`${rowIndex}-${colIndex}`}
                  >
                    {symbol && <span className={`art-piece ${rowIndex < 4 ? "art-enemy" : "art-own"}`}>{symbol}</span>}
                  </div>
                )),
              )}
            </div>
            <div className="art-caption"><span>01</span> THE BATTLEFIELD <span className="caption-line" /> 8 × 9</div>
          </div>
        </section>
        <section className="quick-stats" aria-label="Game features">
          <div><span className="stat-number">01</span><span className="stat-label">Set your<br />formation</span></div>
          <div><span className="stat-number">02</span><span className="stat-label">Conceal your<br />rank</span></div>
          <div><span className="stat-number">03</span><span className="stat-label">Capture the<br />flag</span></div>
          <div className="stat-note">A classic game of<br /><strong>Game of the Generals</strong></div>
        </section>
        <section className="rules-section" id="how-to-play">
          <div className="rules-heading">
            <span className="eyebrow"><span className="eyebrow-line" /> YOUR MISSION</span>
            <h2>Simple to learn.<br /><em>Hard to master.</em></h2>
            <p>Every soldier has a rank—but only you know what it is. Use that advantage wisely.</p>
          </div>
          <div className="rule-list">
            <article className="rule-card">
              <span className="rule-number">01</span>
              <div><h3>Set your army</h3><p>Place all 21 pieces in the three rows closest to you. Keep your ranks secret from your opponent.</p></div>
            </article>
            <article className="rule-card">
              <span className="rule-number">02</span>
              <div><h3>Make your move</h3><p>Players take turns moving one piece a single square in any direction, including diagonally.</p></div>
            </article>
            <article className="rule-card">
              <span className="rule-number">03</span>
              <div><h3>Win the battle</h3><p>Higher ranks defeat lower ranks. The Spy beats every rank except the Private; equal ranks take each other out.</p></div>
            </article>
            <article className="rule-card">
              <span className="rule-number">04</span>
              <div><h3>Claim victory</h3><p>Capture the enemy Flag, or advance your own Flag to the far edge. You can also surrender at any time.</p></div>
            </article>
          </div>
        </section>
        <section className="closing-cta">
          <div><span className="eyebrow"><span className="eyebrow-line" /> THE FIELD IS YOURS</span><h2>Ready to make<br /><em>your move?</em></h2></div>
          <button className="button-primary" type="button" onClick={startGame}>Set up your army <span aria-hidden="true">↗</span></button>
        </section>
        <footer className="site-footer"><a className="brand" href="#"><span className="brand-mark">S</span><span>SLPKN <b>PH</b></span></a><span>A hobby project inspired by Game of the Generals.</span><span>Made for the love of the game.</span></footer>
      </main>
    );
  }

  const playerPiecesRemaining = placedCount;
  const poolReady = allPiecesPlaced(currentPool);

  return (
    <>
    <main className="play-shell">
      <header className="play-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (isOnline) exitOnlineRoom(); else setScreen("home"); }} aria-label="Return to home">
          <span className="brand-mark">S</span><span>SLPKN <b>PH</b></span>
        </a>
        <div className="match-label">
          <span className="live-dot" />
          {isOnline
            ? onlineRoom?.visibility === "private" ? "PRIVATE ROOM" : "PUBLIC ROOM"
            : isSetup ? "ARMY SETUP" : screen === "finished" ? "MATCH COMPLETE" : "LOCAL MATCH"}
          {screen === "watching" ? " · SPECTATING" : null}
        </div>
        <button className="header-home" type="button" onClick={() => { if (isOnline) exitOnlineRoom(); else setScreen("home"); }}>
          {isOnline ? "Leave room" : "Back to home"} <span>↗</span>
        </button>
      </header>
      <div className="play-layout">
        <section className="match-main">
          <div className="match-title-row">
            <div>
              <span className="eyebrow"><span className="eyebrow-line" /> {screen === "watching" ? "SPECTATOR VIEW" : isSetup ? "PREPARE YOUR FORCES" : "THE BATTLEFIELD"}</span>
              <h1>{screen === "watching" ? <>Watch the <em>battle.</em></> : isSetup ? <>Set your <em>formation.</em></> : screen === "finished" ? <>The field is <em>decided.</em></> : <>Make your <em>move.</em></>}</h1>
            </div>
            <div className="round-counter"><span>{String(currentMoveCount + 1).padStart(2, "0")}</span><small>{isSetup ? "SETUP" : "TURN"}</small></div>
          </div>
          <div className="turn-banner">
            <span className={`turn-marker player-${activePlayer}`} />
            <div>
              <strong>
                {screen === "finished"
                  ? `${onlineRoom?.players[(gameWinner ?? activePlayer) - 1] ?? playerName(gameWinner ?? activePlayer)} wins`
                  : screen === "watching"
                            ? onlineRoom?.winner
                              ? `${onlineRoom.players[onlineRoom.winner - 1] ?? playerName(onlineRoom.winner)} wins`
                              : `${onlineRoom?.players[(onlineRoom?.turn ?? 1) - 1] ?? playerName(onlineRoom?.turn ?? 1)}'s turn`
                            : `${activePlayerName}${isSetup ? " · arranging army" : " · your turn"}`}
              </strong>
              <span>{roomError || (onlineRoom?.phase === "setup" && !onlineRoom.players[1]
                ? "Waiting for an opponent to join this room."
                : screen === "watching"
                  ? "Pieces are identical to keep both armies' ranks secret."
                  : notice)}</span>
            </div>
            {screen === "playing" && !isOnline && <button className="surrender-button" type="button" onClick={surrender}>Surrender</button>}
            {screen === "playing" && isOnline && <button className="surrender-button" type="button" onClick={surrender}>Surrender</button>}
          </div>
          {isOnline && onlineRoom?.timeControlSeconds !== null && onlineRoom?.timeControlSeconds !== undefined && (
            <div className="clock-strip" aria-label="Player clocks">
              {[1, 2].map((playerIndex) => {
                const player = playerIndex as Player;
                const remaining = clockValue(player);
                const activeClock = onlineRoom.turn === player && onlineRoom.phase === "playing";
                return (
                  <div className={`clock-card ${activeClock ? "clock-active" : ""} ${activeClock && remaining !== null && remaining <= 10000 ? "clock-low" : ""}`} key={player}>
                    <span>{onlineRoom.players[player - 1] ?? playerName(player)}</span>
                    <strong>{formatClock(remaining)}</strong>
                  </div>
                );
              })}
            </div>
          )}
          {renderBoard()}
          <div className="board-legend">
            <span><i className="legend-dot light" /> {onlineRoom?.players[0] ?? "Player 1"}</span>
            <span><i className="legend-dot dark" /> {onlineRoom?.players[1] ?? "Player 2"}</span>
            <span className="legend-secret"><i>✦</i> {screen === "watching" ? "All ranks hidden" : "Hidden rank"}</span>
          </div>
        </section>

        <aside className="game-sidebar">
          {isSetup ? (
            <>
              <div className="sidebar-heading"><span className="eyebrow">YOUR RESERVE</span><h2>Build your army</h2><p>{isOnline ? onlineRoom?.rematchSetup ? "Your last formation is restored. Tap your own pieces to return them to reserve, adjust your setup, then confirm." : `Set your private army, ${activePlayerName}. Only you can see your piece ranks.` : "Choose a piece, then tap a square in your three-row zone. Tap your placed pieces to return them."}</p></div>
              {isOnline && onlineRoom?.visibility === "private" && inviteToken && (
                <div className="invite-share-card">
                  <strong>Invite your opponent</strong>
                  <p>This private room is only accessible to someone with your link.</p>
                  <button className="button-secondary button-full" type="button" onClick={() => void copyInvitation()}>
                    {copiedInvite ? "Link copied" : "Copy private invite"} <span>↗</span>
                  </button>
                </div>
              )}
              <div className="reserve-progress"><div><span>Pieces to place</span><strong>{playerPiecesRemaining}<small> / 21</small></strong></div><div className="progress-track"><span style={{ width: `${((21 - playerPiecesRemaining) / 21) * 100}%` }} /></div></div>
              <div className="piece-reserve">
                {PIECES.map((piece) => {
                  const available = currentPool[piece.kind];
                  if (available === 0) return null;
                  return (
                    <button
                      className={`reserve-piece ${activeSetupPiece === piece.kind ? "reserve-selected" : ""}`}
                      key={piece.kind}
                      type="button"
                      disabled={roomLoading || (isOnline && onlineRoom?.ready[activePlayer - 1])}
                      title={piece.name}
                      onClick={() => { setSelectedPiece(piece.kind); setNotice(`${piece.name} selected. Tap a square in your setup zone.`); }}
                    >
                      <Image
                        className="reserve-piece-image"
                        src={pieceImagePath(piece.kind, activePlayer)}
                        alt=""
                        width={123}
                        height={74}
                        draggable={false}
                      />
                      <span className="reserve-name">{piece.name}</span>
                      <span className="reserve-count">×{available}</span>
                    </button>
                  );
                })}
              </div>
              <div className="setup-actions">
                <div className="pass-device-note"><span>↻</span><p>{isOnline ? onlineRoom?.rematchSetup ? "Your saved formation is loaded. Adjust any pieces you want, then confirm your army to start the rematch." : "Your army is hidden from your opponent. Confirm when you have placed all 21 pieces." : activePlayer === 1 ? "Your formation stays hidden when you pass the device." : "Player 1 is ready. Arrange your pieces, then begin."}</p></div>
                <button className="button-primary button-full" type="button" onClick={finishSetup} disabled={!poolReady || roomLoading || Boolean(isOnline && onlineRoom?.ready[activePlayer - 1])}>
                  {isOnline && onlineRoom?.ready[activePlayer - 1] ? "Waiting for opponent" : isOnline ? "Confirm army" : activePlayer === 1 ? "Player 1 ready" : "Begin the match"} <span aria-hidden="true">↗</span>
                </button>
                {!poolReady && <span className="setup-hint">Place all {playerPiecesRemaining} remaining pieces to continue.</span>}
                {isOnline && onlineRoom?.ready[activePlayer - 1] && <span className="setup-hint">Your army is locked in. Waiting for the other player.</span>}
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-heading"><span className="eyebrow">{screen === "watching" ? "SPECTATOR FIELD REPORT" : "FIELD REPORT"}</span><h2>{screen === "finished" ? "Match results" : screen === "watching" ? "Watching match" : "The battle"}</h2><p>{screen === "watching" ? "Every piece stays identical on the board. Only captured pieces are revealed in each player's captured list." : screen === "finished" ? "A well-played game. Ready for another?" : "Ranks stay hidden until a piece enters battle. Think ahead, and remember what you discover."}</p></div>
              <div className="player-card">
                <div className={`player-avatar player-${activePlayer}`}>{activePlayer === 1 ? "I" : "II"}</div>
                <div><strong>{activePlayerName}</strong><span>{screen === "finished" ? "Finished" : "Active turn"}</span></div>
                <span className="active-pill">{screen === "finished" ? "DONE" : screen === "watching" ? "LIVE" : "ACTIVE"}</span>
              </div>
              <div className="player-card player-card-muted">
                <div className={`player-avatar player-${activePlayer === 1 ? 2 : 1}`}>{activePlayer === 1 ? "II" : "I"}</div>
                <div><strong>{onlineRoom?.players[activePlayer === 1 ? 1 : 0] ?? `Player ${activePlayer === 1 ? 2 : 1}`}</strong><span>Opponent</span></div>
                <span className="secret-status">HIDDEN</span>
              </div>
              <div className="last-move-card" aria-live="polite">
                <span className="eyebrow">LATEST MOVE</span>
                <p>{lastMoveText}</p>
                {lastMove && (
                  <small>
                    {squareNotation(lastMove.fromRow, lastMove.fromCol)}
                    {" → "}
                    {squareNotation(lastMove.toRow, lastMove.toCol)}
                    {lastMove.result !== "move" ? " · BATTLE" : ""}
                  </small>
                )}
              </div>
              <div className="captured-columns">
                  {[0, 1].map((playerIndex) => (
                    <section className="captured-panel" key={playerIndex} aria-label={`Pieces captured by ${onlineRoom?.players[playerIndex] ?? playerName((playerIndex + 1) as Player)}`}>
                      <strong>{onlineRoom?.players[playerIndex] ?? playerName((playerIndex + 1) as Player)} captured</strong>
                      <div className="captured-pieces">
                        {capturedPieces[playerIndex].length === 0
                          ? <span className="no-captures">No captures yet</span>
                          : capturedPieces[playerIndex].map((kind, index) => (
                            <Image
                              className="captured-piece-image"
                              key={`${kind}-${index}`}
                              src={pieceImagePath(kind, playerIndex === 0 ? 2 : 1)}
                              alt={pieceName(kind)}
                              title={pieceName(kind)}
                              width={123}
                              height={74}
                            />
                          ))}
                      </div>
                    </section>
                  ))}
              </div>
              {(!isOnline || screen !== "watching") && <div className="field-note"><span className="note-icon">✦</span><div><strong>Remember what you learn</strong><p>When pieces battle, their ranks are revealed. Keep track—knowledge can turn the tide.</p></div></div>}
              {isOnline && screen === "playing" && <div className="online-sync-note"><span className="live-dot" /> Moves sync with both players</div>}
              <div className="turn-log">
                <span className="eyebrow">MATCH INFO</span>
                <div><span>Moves played</span><strong>{currentMoveCount}</strong></div>
                <div><span>Win condition</span><strong>Flag capture or advance</strong></div>
                {isOnline && <div><span>Room ID</span><strong>{onlineRoom?.roomId.slice(0, 10)}</strong></div>}
              </div>
              {screen === "finished" && !isOnline && <button className="button-primary button-full restart-button" type="button" onClick={startGame}>Play again <span aria-hidden="true">↗</span></button>}
              {screen === "finished" && isOnline && canRequestRematch && (
                <button
                  className="button-primary button-full restart-button"
                  type="button"
                  onClick={requestRematch}
                  disabled={roomLoading || ownRematchRequested}
                >
                  {ownRematchRequested
                    ? "Waiting for opponent..."
                    : opponentRematchRequested
                      ? "Accept rematch"
                      : "Restore armies for setup"}
                  <span aria-hidden="true">↗</span>
                </button>
              )}
              {isOnline && <button className="button-secondary button-full restart-button" type="button" onClick={exitOnlineRoom}>Back to challenge rooms <span aria-hidden="true">↗</span></button>}
            </>
          )}
        </aside>
      </div>
      <footer className="play-footer"><span>SLPKN PH <b>·</b> GAME OF THE GENERALS</span><span>{screen === "watching" ? "SPECTATOR VIEW · BOTH ARMIES' RANKS REMAIN HIDDEN" : isOnline ? `ROOM UPDATES EVERY ${ROOM_POLL_INTERVAL / 1000} SECONDS` : isSetup ? "PLACE YOUR PIECES IN YOUR THREE HOME ROWS" : "ONE SQUARE · ANY DIRECTION · EVERY MOVE MATTERS"}</span></footer>
    </main>
    {showCelebration && gameWinner && (
      <div className="victory-overlay">
        <section
          className={`victory-card victory-${gameWinner === 1 ? "white" : "black"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="victory-title"
        >
          <div className="victory-rays" aria-hidden="true" />
          <span className="victory-overline">SALPAKAN · MATCH COMPLETE</span>
          <div className="victory-flag">
            <Image
              src={pieceImagePath("F", gameWinner)}
              alt=""
              width={123}
              height={74}
            />
          </div>
          <span className="victory-color">{winnerColor}</span>
          <h2 id="victory-title">{winnerName} wins!</h2>
          <p className="victory-reason">
            {winReason === "flagged"
              ? "FLAG ADVANCED TO THE BACK RANK"
              : winReason === "surrender"
                ? "THE OPPONENT SURRENDERED"
                : winReason === "timeout"
                  ? "TIME EXPIRED"
                  : "OPPONENT'S FLAG CAPTURED"}
          </p>
          <div className="victory-divider"><span>✦</span></div>
          <div className="victory-actions">
            {isOnline ? (
              <>
                {canRequestRematch && (
                  <button
                    className="button-primary"
                    type="button"
                    onClick={requestRematch}
                    disabled={roomLoading || ownRematchRequested}
                  >
                    {ownRematchRequested
                      ? "Waiting for opponent..."
                      : opponentRematchRequested
                        ? "Accept rematch"
                        : "Restore armies for setup"}
                  </button>
                )}
                <button className="victory-dismiss" type="button" onClick={exitOnlineRoom}>
                  Back to rooms
                </button>
              </>
            ) : (
              <button className="button-primary" type="button" onClick={startGame}>
                Play again <span aria-hidden="true">↗</span>
              </button>
            )}
            <button
              className="victory-dismiss"
              type="button"
              onClick={() => setCelebrationDismissed(true)}
            >
              View the board
            </button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
