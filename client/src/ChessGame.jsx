// ChessGame.jsx (JS)
// npm i socket.io-client chess.js react-chessboard
import { useEffect, useMemo, useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { io } from "socket.io-client";

// ---- SINGLETON SOCKET (avoid React double-connect issues)
const socket = io("http://localhost:4000", { transports: ["websocket"] });

const timeControl = "300+0"; // 5|0 — both players must use the same TC

const ChessGame = () => {
  // server/game state
  const [connected, setConnected] = useState(false);
  const [gameId, setGameId] = useState(null);
  const [color, setColor] = useState(null); // 'w' | 'b'
  const [status, setStatus] = useState("idle"); // 'idle' | 'active' | 'ended'

  // board + moves
  const [fen, setFen] = useState("start"); // server authoritative FEN
  const [moves, setMoves] = useState([]); // [{san, from, to, fen}]
  const [turn, setTurn] = useState("w");  // 'w' | 'b'

  // clocks (optional UI)
  const [clocks, setClocks] = useState({ w: 300000, b: 300000 }); // ms left

  // local mirror chess for quick legality checks (not authoritative)
  const chess = useMemo(() => new Chess(), []);

  // derived move log (same look & feel as your original)
  const moveLog = useMemo(() => {
    return moves.map((m, i) => `${(i % 2 === 0 ? "White" : "Black")}: ${m.san}`);
  }, [moves]);

  // ---- SOCKET LIFECYCLE ----
  useEffect(() => {
    socket.off("connect").on("connect", () => setConnected(true));

    socket.off("queue:matched").on("queue:matched", ({ gameId, color }) => {
      setGameId(gameId);
      setColor(color);
      setStatus("active");
      // Reset local board to start
      try { chess.reset(); } catch { }
      setFen(chess.fen());
      setMoves([]);
      setTurn("w");
    });

    socket.off("game:state").on("game:state", ({ fen, moves, clocks, turn, status }) => {
      // Trust server state
      try { chess.load(fen); } catch { }
      setFen(fen);
      setMoves(moves || []);
      setClocks(clocks || { w: 300000, b: 300000 });
      setTurn(turn || chess.turn());
      setStatus(status || "active");
    });

    socket.off("game:move").on("game:move", ({ fen, clocks }) => {
      try { chess.load(fen); } catch { }
      setFen(fen);
      setClocks(clocks);
      setTurn(chess.turn());
    });

    socket.off("game:ended").on("game:ended", ({ result, reason, pgn }) => {
      setStatus("ended");
      // Optional: toast/modal — using alert for MVP
      alert(`${result} — ${reason}\n\n${pgn}`);
    });

    socket.off("game:drawOffered").on("game:drawOffered", ({ by }) => {
      const accept = window.confirm(`Opponent offered a draw. Accept?`);
      if (accept && gameId) socket.emit("game:acceptDraw", { gameId });
    });

    socket.off("error").on("error", (e) => {
      console.warn("[server-error]", e);
    });
  }, [chess, gameId]);

  // ---- UI actions ----
  const findMatch = () => {
    socket.emit("queue:join", { userId: crypto.randomUUID(), timeControl });
  };

  const offerDraw = () => {
    if (gameId) socket.emit("game:offerDraw", { gameId });
  };

  const resign = () => {
    if (gameId) socket.emit("game:resign", { gameId });
  };

  // ---- Drag-drop to server ----
  const onDrop = useCallback(
    (sourceSquare, targetSquare) => {
      console.log(sourceSquare, targetSquare);

      // Only allow when game is active and it's your turn
      if (status !== "active" || !gameId) return false;
      if (color !== turn) return false;

      // client-side legality check for instant feedback (server still verifies)
      const test = new Chess(fen);
      const mv = test.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!mv) return false;

      socket.emit("game:move", {
        gameId,
        from: sourceSquare,
        to: targetSquare,
        promotion: mv.promotion || "q",
      });

      return true; // let the board animate; server will echo the correct FEN
    },
    [status, gameId, color, turn, fen]
  );

  // ---- Status text (keeps your original flavor) ----
  const statusText = useMemo(() => {
    if (status !== "active") {
      if (status === "ended") return "Game Over";
      return "Click Find Match to start";
    }
    return `${turn === "w" ? "White" : "Black"} to move`;
  }, [status, turn]);

  // ---- (Preserve your CSS-in-JS layout) ----
  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    display: "flex",
    gap: "20px",
    flexDirection: window.innerWidth < 768 ? "column" : "row",
  };

  const boardContainerStyle = { flex: 2, maxWidth: "600px" };
  const moveLogStyle = { flex: 1, border: "1px solid #ccc", borderRadius: "4px", padding: "15px" };
  const moveListStyle = { height: "400px", overflowY: "auto", border: "1px solid #eee", padding: "10px" };
  const moveItemStyle = { padding: "8px", borderBottom: "1px solid #eee", backgroundColor: "#fff" };
  const button = {
    base: {
      padding: "8px 16px",
      color: "white",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      marginTop: "15px",
    },
    primary: { backgroundColor: "#16a34a" },
    warn: { backgroundColor: "#d97706" },
    danger: { backgroundColor: "#e11d48" },
    neutral: { backgroundColor: "#2196f3" },
  };
  const statusStyle = {
    fontSize: "20px",
    marginBottom: "15px",
    textAlign: "center",
    color: status === "active" && turn === "w" && chess.inCheck() ? "#d32f2f" : "#333",
  };

  return (
    <div style={containerStyle}>
      <div style={boardContainerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {connected ? "Connected" : "Connecting..."} · {status} · You are {color ?? "—"} · TC {timeControl}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            W: {Math.ceil(clocks.w / 1000)}s · B: {Math.ceil(clocks.b / 1000)}s
          </div>
        </div>

        <div style={statusStyle}>{statusText}</div>

        <Chessboard
          position={fen}
          onPieceDrop={onDrop}
          arePiecesDraggable={status === "active" && color === turn}
          boardOrientation={color === "b" ? "black" : "white"}   // 👈 flip for Black
          customBoardStyle={{
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
          }}
          customDarkSquareStyle={{ backgroundColor: "#779952" }}
          customLightSquareStyle={{ backgroundColor: "#edeed1" }}
        />


        {/* Controls */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={findMatch}
            style={{ ...button.base, ...button.primary }}
            onMouseOver={(e) => (e.target.style.opacity = "0.9")}
            onMouseOut={(e) => (e.target.style.opacity = "1")}
          >
            Find Match
          </button>
          <button
            onClick={offerDraw}
            disabled={!gameId || status !== "active"}
            style={{ ...button.base, ...button.warn, opacity: !gameId || status !== "active" ? 0.6 : 1 }}
          >
            Offer Draw
          </button>
          <button
            onClick={resign}
            disabled={!gameId || status !== "active"}
            style={{ ...button.base, ...button.danger, opacity: !gameId || status !== "active" ? 0.6 : 1 }}
          >
            Resign
          </button>
        </div>
      </div>

      <div style={moveLogStyle}>
        <h2 style={{ marginBottom: "15px", fontSize: "18px" }}>Move History</h2>
        <div style={moveListStyle}>
          {moves.length > 0 ? (
            moves.map((m, index) => (
              <div key={index} style={moveItemStyle}>
                {`${Math.floor(index / 2) + 1}. ${index % 2 === 0 ? "White" : "Black"}: ${m.san}`}
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", color: "#666", fontStyle: "italic" }}>No moves yet</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChessGame;
