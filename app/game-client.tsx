"use client";

import { useState } from "react";
import {
  allPiecesPlaced,
  combatWinner,
  createBoard,
  createPieceCounts,
  findWinner,
  PIECES,
  pieceName,
  type Board,
  type Piece,
  type PieceKind,
  type Player,
} from "./game";

type Screen = "home" | "setup" | "playing" | "finished";
type Position = { row: number; col: number };

function playerName(player: Player) {
  return `Player ${player}`;
}

export default function GameClient() {
  const [screen, setScreen] = useState<Screen>("home");
  const [board, setBoard] = useState<Board>(() => createBoard());
  const [pools, setPools] = useState(() => [createPieceCounts(), createPieceCounts()]);
  const [activePlayer, setActivePlayer] = useState<Player>(1);
  const [selectedPiece, setSelectedPiece] = useState<PieceKind | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [notice, setNotice] = useState("Choose a piece, then place it on your side of the board.");

  const isSetup = screen === "setup";
  const isRotated = activePlayer === 2;
  const currentPool = pools[activePlayer - 1];
  const placedCount = Object.values(currentPool).reduce((sum, count) => sum + count, 0);

  function startGame() {
    setBoard(createBoard());
    setPools([createPieceCounts(), createPieceCounts()]);
    setActivePlayer(1);
    setSelectedPiece(null);
    setSelectedSquare(null);
    setWinner(null);
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
    if (!selectedPiece) {
      setNotice("Select a piece from your reserve before placing it.");
      return;
    }
    if (currentPool[selectedPiece] < 1) {
      setNotice("You have no more of that piece in your reserve.");
      return;
    }

    const nextBoard = board.map((row) => [...row]);
    nextBoard[position.row][position.col] = { kind: selectedPiece, owner: activePlayer };
    const nextPools = pools.map((pool) => ({ ...pool }));
    nextPools[activePlayer - 1][selectedPiece] -= 1;
    setBoard(nextBoard);
    setPools(nextPools);
    setNotice(`${pieceName(selectedPiece)} placed. Arrange your remaining forces.`);
  }

  function finishSetup() {
    if (!allPiecesPlaced(currentPool)) {
      setNotice(`Place all your pieces before continuing. ${placedCount} remaining.`);
      return;
    }
    setSelectedPiece(null);
    if (activePlayer === 1) {
      setActivePlayer(2);
      setNotice("Player 1 is ready. Pass the device to Player 2 to arrange their army.");
      return;
    }
    setActivePlayer(1);
    setScreen("playing");
    setNotice("Both armies are ready. Player 1 moves first.");
  }

  function onGameSquare(position: Position) {
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
    let battleNotice: string;
    if (!piece) {
      nextBoard[position.row][position.col] = movingPiece;
      battleNotice = `${pieceName(movingPiece.kind)} moved.`;
    } else {
      const victoriousPiece = combatWinner(movingPiece, piece);
      if (victoriousPiece === movingPiece) {
        nextBoard[position.row][position.col] = movingPiece;
        battleNotice = `${pieceName(movingPiece.kind)} defeats ${pieceName(piece.kind)}.`;
      } else if (victoriousPiece === piece) {
        battleNotice = `${pieceName(piece.kind)} defeats ${pieceName(movingPiece.kind)}.`;
      } else {
        nextBoard[position.row][position.col] = null;
        battleNotice = `${pieceName(movingPiece.kind)} and ${pieceName(piece.kind)} have equal rank. Both are removed.`;
      }
    }
    nextBoard[selectedSquare.row][selectedSquare.col] = null;
    setBoard(nextBoard);
    setSelectedSquare(null);
    setMoveCount((count) => count + 1);
    const gameWinner = findWinner(nextBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setScreen("finished");
      setNotice(`${playerName(gameWinner)} wins!`);
      return;
    }
    const nextPlayer: Player = activePlayer === 1 ? 2 : 1;
    setActivePlayer(nextPlayer);
    setNotice(`${battleNotice} ${playerName(nextPlayer)}'s turn.`);
  }

  function surrender() {
    const winningPlayer: Player = activePlayer === 1 ? 2 : 1;
    setWinner(winningPlayer);
    setScreen("finished");
    setNotice(`${playerName(activePlayer)} surrendered. ${playerName(winningPlayer)} wins!`);
  }

  function displayPiece(piece: Piece | null) {
    if (!piece) return null;
    const definition = PIECES.find((item) => item.kind === piece.kind);
    return (
      <span className={`piece-face player-${piece.owner}`} aria-hidden="true">
        <span className="piece-symbol">{definition?.symbol}</span>
        <span className="piece-code">{piece.kind}</span>
      </span>
    );
  }

  function renderBoard() {
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
                const piece = board[position.row][position.col];
                const isHiddenOpponent = piece && piece.owner !== activePlayer;
                const isSelected =
                  selectedSquare?.row === position.row && selectedSquare.col === position.col;
                const isSetupZone = isSetup && (activePlayer === 1 ? position.row >= 5 : position.row <= 2);
                const squareLabel = piece
                  ? isHiddenOpponent
                    ? `Opponent piece at row ${position.row + 1}, column ${position.col + 1}`
                    : `${playerName(piece.owner)} ${pieceName(piece.kind)} at row ${position.row + 1}, column ${position.col + 1}`
                  : `Empty square at row ${position.row + 1}, column ${position.col + 1}`;
                return (
                  <button
                    className={[
                      "board-square",
                      (displayRow + displayCol) % 2 === 0 ? "square-light" : "square-dark",
                      isSetupZone ? "setup-zone" : "",
                      isSelected ? "square-selected" : "",
                    ].filter(Boolean).join(" ")}
                    key={`${displayRow}-${displayCol}`}
                    type="button"
                    role="gridcell"
                    aria-label={squareLabel}
                    onClick={() =>
                      isSetup ? onSetupSquare(position) : onGameSquare(position)
                    }
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
            <span className="local-badge"><span /> LOCAL 2-PLAYER</span>
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
              <button className="button-primary" type="button" onClick={startGame}>
                Start a game <span aria-hidden="true">↗</span>
              </button>
              <a className="text-link" href="#how-to-play">Learn the rules <span>↓</span></a>
            </div>
            <div className="hero-meta"><span>♙</span> Two players · One screen · No account needed</div>
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
    <main className="play-shell">
      <header className="play-header">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setScreen("home"); }} aria-label="Return to home">
          <span className="brand-mark">S</span><span>SLPKN <b>PH</b></span>
        </a>
        <div className="match-label"><span className="live-dot" /> {isSetup ? "ARMY SETUP" : screen === "finished" ? "MATCH COMPLETE" : "LOCAL MATCH"}</div>
        <button className="header-home" type="button" onClick={() => setScreen("home")}>Back to home <span>↗</span></button>
      </header>
      <div className="play-layout">
        <section className="match-main">
          <div className="match-title-row">
            <div>
              <span className="eyebrow"><span className="eyebrow-line" /> {isSetup ? "PREPARE YOUR FORCES" : "THE BATTLEFIELD"}</span>
              <h1>{isSetup ? <>Set your <em>formation.</em></> : screen === "finished" ? <>The field is <em>decided.</em></> : <>Make your <em>move.</em></>}</h1>
            </div>
            <div className="round-counter"><span>{String(moveCount + 1).padStart(2, "0")}</span><small>{isSetup ? "SETUP" : "TURN"}</small></div>
          </div>
          <div className="turn-banner">
            <span className={`turn-marker player-${activePlayer}`} />
            <div><strong>{screen === "finished" ? `${playerName(winner ?? activePlayer)} wins` : `${playerName(activePlayer)}${isSetup ? " · arranging army" : " · your turn"}`}</strong><span>{notice}</span></div>
            {screen === "playing" && <button className="surrender-button" type="button" onClick={surrender}>Surrender</button>}
          </div>
          {renderBoard()}
          <div className="board-legend">
            <span><i className="legend-dot light" /> Player 1</span>
            <span><i className="legend-dot dark" /> Player 2</span>
            <span className="legend-secret"><i>✦</i> Hidden rank</span>
          </div>
        </section>

        <aside className="game-sidebar">
          {isSetup ? (
            <>
              <div className="sidebar-heading"><span className="eyebrow">YOUR RESERVE</span><h2>Build your army</h2><p>Choose a piece, then tap a square in your three-row zone. Tap your placed pieces to return them.</p></div>
              <div className="reserve-progress"><div><span>Pieces to place</span><strong>{playerPiecesRemaining}<small> / 21</small></strong></div><div className="progress-track"><span style={{ width: `${((21 - playerPiecesRemaining) / 21) * 100}%` }} /></div></div>
              <div className="piece-reserve">
                {PIECES.map((piece) => {
                  const available = currentPool[piece.kind];
                  if (available === 0) return null;
                  return (
                    <button
                      className={`reserve-piece ${selectedPiece === piece.kind ? "reserve-selected" : ""}`}
                      key={piece.kind}
                      type="button"
                      onClick={() => { setSelectedPiece(piece.kind); setNotice(`${piece.name} selected. Tap a square in your setup zone.`); }}
                    >
                      <span className="reserve-symbol">{piece.symbol}</span>
                      <span className="reserve-name">{piece.name}</span>
                      <span className="reserve-count">×{available}</span>
                    </button>
                  );
                })}
              </div>
              <div className="setup-actions">
                <div className="pass-device-note"><span>↻</span><p>{activePlayer === 1 ? "Your formation stays hidden when you pass the device." : "Player 1 is ready. Arrange your pieces, then begin."}</p></div>
                <button className="button-primary button-full" type="button" onClick={finishSetup} disabled={!poolReady}>
                  {activePlayer === 1 ? "Player 1 ready" : "Begin the match"} <span aria-hidden="true">↗</span>
                </button>
                {!poolReady && <span className="setup-hint">Place all {playerPiecesRemaining} remaining pieces to continue.</span>}
              </div>
            </>
          ) : (
            <>
              <div className="sidebar-heading"><span className="eyebrow">FIELD REPORT</span><h2>{screen === "finished" ? "Match results" : "The battle"}</h2><p>{screen === "finished" ? "A well-played game. Ready for another?" : "Ranks stay hidden until a piece enters battle. Think ahead, and remember what you discover."}</p></div>
              <div className="player-card">
                <div className={`player-avatar player-${activePlayer}`}>{activePlayer === 1 ? "I" : "II"}</div>
                <div><strong>{playerName(activePlayer)}</strong><span>{screen === "finished" ? "Finished" : "Active turn"}</span></div>
                <span className="active-pill">{screen === "finished" ? "DONE" : "ACTIVE"}</span>
              </div>
              <div className="player-card player-card-muted">
                <div className={`player-avatar player-${activePlayer === 1 ? 2 : 1}`}>{activePlayer === 1 ? "II" : "I"}</div>
                <div><strong>Player {activePlayer === 1 ? 2 : 1}</strong><span>Opponent</span></div>
                <span className="secret-status">HIDDEN</span>
              </div>
              <div className="field-note"><span className="note-icon">✦</span><div><strong>Remember what you learn</strong><p>When pieces battle, their ranks are revealed. Keep track—knowledge can turn the tide.</p></div></div>
              <div className="turn-log">
                <span className="eyebrow">MATCH INFO</span>
                <div><span>Moves played</span><strong>{moveCount}</strong></div>
                <div><span>Win condition</span><strong>Flag capture or advance</strong></div>
              </div>
              {screen === "finished" && <button className="button-primary button-full restart-button" type="button" onClick={startGame}>Play again <span aria-hidden="true">↗</span></button>}
            </>
          )}
        </aside>
      </div>
      <footer className="play-footer"><span>SLPKN PH <b>·</b> GAME OF THE GENERALS</span><span>{isSetup ? "PLACE YOUR PIECES IN YOUR THREE HOME ROWS" : "ONE SQUARE · ANY DIRECTION · EVERY MOVE MATTERS"}</span></footer>
    </main>
  );
}
