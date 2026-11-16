
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const PLAYER_TOKEN_KEY = "quiz_bahasa_player_token";
const QUESTION_TIME = 30;

const SNAKES = {
  17: 4, 19: 7, 21: 9, 43: 18,
  50: 34, 54: 31, 62: 19, 64: 60,
  87: 24, 93: 73, 95: 75, 98: 79,
};

const LADDERS = {
  3: 22, 5: 8, 11: 26, 20: 29,
  27: 56, 36: 44, 51: 67, 71: 92, 80: 99,
};

function getCenter(number) {
  const rowFromBottom = Math.floor((number - 1) / 10);
  const positionInRow = (number - 1) % 10;

  const column = rowFromBottom % 2 === 0
    ? positionInRow
    : 9 - positionInRow;

  const rowFromTop = 9 - rowFromBottom;

  return {
    x: (column + 0.5) * 100,
    y: (rowFromTop + 0.5) * 100,
  };
}

function getSnakePath(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const direction = start.x < end.x ? 1 : -1;

  const controlX = (start.x + end.x) / 2 +
    (-dy / length) * 65 * direction;

  const controlY = (start.y + end.y) / 2 +
    (dx / length) * 65 * direction;

  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
}

function SnakeDrawing({ from, to }) {
  const start = getCenter(Number(from));
  const end = getCenter(Number(to));
  const path = getSnakePath(start, end);

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#14532d"
        strokeWidth="25"
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke="#22c55e"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <circle
        cx={start.x}
        cy={start.y}
        r="14"
        fill="#16a34a"
        stroke="#14532d"
        strokeWidth="4"
      />
      <circle cx={start.x - 5} cy={start.y - 4} r="2.8" fill="white" />
      <circle cx={start.x + 5} cy={start.y - 4} r="2.8" fill="white" />
      <circle cx={start.x - 5} cy={start.y - 4} r="1.2" fill="#111827" />
      <circle cx={start.x + 5} cy={start.y - 4} r="1.2" fill="#111827" />
      <circle
        cx={end.x}
        cy={end.y}
        r="6"
        fill="#166534"
        stroke="#14532d"
        strokeWidth="2"
      />
    </g>
  );
}

function LadderDrawing({ from, to }) {
  const start = getCenter(Number(from));
  const end = getCenter(Number(to));

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;

  const nx = (-dy / length) * 9;
  const ny = (dx / length) * 9;

  return (
    <g>
      <line
        x1={start.x + nx}
        y1={start.y + ny}
        x2={end.x + nx}
        y2={end.y + ny}
        stroke="#78350f"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        x1={start.x - nx}
        y1={start.y - ny}
        x2={end.x - nx}
        y2={end.y - ny}
        stroke="#78350f"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <line
        x1={start.x + nx}
        y1={start.y + ny}
        x2={end.x + nx}
        y2={end.y + ny}
        stroke="#fbbf24"
        strokeWidth="5"
      />
      <line
        x1={start.x - nx}
        y1={start.y - ny}
        x2={end.x - nx}
        y2={end.y - ny}
        stroke="#fbbf24"
        strokeWidth="5"
      />

      {Array.from({ length: 7 }, (_, index) => {
        const t = (index + 1) / 8;
        const x = start.x + dx * t;
        const y = start.y + dy * t;

        return (
          <line
            key={index}
            x1={x + nx}
            y1={y + ny}
            x2={x - nx}
            y2={y - ny}
            stroke="#78350f"
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

export default function GamePage() {
  const router = useRouter();

  const [players, setPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [question, setQuestion] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [questionStartedAt, setQuestionStartedAt] = useState(null);
  const [questionsRemaining, setQuestionsRemaining] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [token, setToken] = useState(null);

  const submittingRef = useRef(false);
  const timeoutQuestionRef = useRef(null);
  const currentQuestionRef = useRef(null);

  // Membaca token dan mempertahankan sesi pemain.
  useEffect(() => {
    let savedToken = localStorage.getItem(PLAYER_TOKEN_KEY);

    // Migrasi token lama dari sessionStorage.
    if (!savedToken) {
      savedToken = sessionStorage.getItem(PLAYER_TOKEN_KEY);

      if (savedToken) {
        localStorage.setItem(PLAYER_TOKEN_KEY, savedToken);
        sessionStorage.removeItem(PLAYER_TOKEN_KEY);
      }
    }

    if (!savedToken) {
      setError(
        "Token pemain tidak ditemukan. Silakan kembali ke halaman pemain."
      );
      setLoading(false);
      return;
    }

    setToken(savedToken);
  }, []);

  // Mengambil data permainan dan soal pribadi pemain.
  const loadGame = useCallback(async () => {
    if (!token) return;

    const { data, error } = await supabase.rpc(
      "player_get_state",
      { p_token: token }
    );

    if (error) {
      setError(
        "Koneksi terganggu. Mencoba memuat permainan kembali..."
      );
      setLoading(false);
      return;
    }

    if (!data?.success) {
      setError("Data permainan tidak ditemukan.");
      setLoading(false);
      return;
    }

    const newQuestionId = data.question?.id || null;

    // Menghapus hasil lama ketika soal berubah.
    if (
      currentQuestionRef.current !== null &&
      currentQuestionRef.current !== newQuestionId
    ) {
      setResult(null);
      timeoutQuestionRef.current = null;
    }

    currentQuestionRef.current = newQuestionId;

    setRoom(data.room);
    setPlayers(data.players || []);
    setMyPlayerId(data.my_player_id);
    setQuestion(data.question);
    setMyAnswer(data.my_answer);
    setQuestionStartedAt(data.my_question_started_at);
    setQuestionsRemaining(data.questions_remaining !== false);

    setLoading(false);
    setError("");
  }, [token]);

  // Memperbarui posisi dan status permainan setiap detik.
  useEffect(() => {
    if (!token) return;

    loadGame();

    const interval = setInterval(loadGame, 1000);

    return () => clearInterval(interval);
  }, [token, loadGame]);

  // Timer pribadi berdasarkan waktu mulai soal.
  useEffect(() => {
    if (
      room?.status !== "live" ||
      !question ||
      !questionStartedAt ||
      myAnswer
    ) {
      setTimeLeft(QUESTION_TIME);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor(
        (Date.now() - new Date(questionStartedAt).getTime()) / 1000
      );

      setTimeLeft(Math.max(0, QUESTION_TIME - elapsed));
    };

    updateTimer();

    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [
    room?.status,
    question?.id,
    questionStartedAt,
    myAnswer,
  ]);

  // Mengirim jawaban atau mencatat timeout.
  const submitAnswer = useCallback(async (option) => {
    if (
      submittingRef.current ||
      myAnswer ||
      room?.status !== "live" ||
      !token ||
      !question
    ) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      const { data, error } = await supabase.rpc(
        "player_submit_answer",
        {
          p_token: token,
          p_selected_option: option,
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error("Jawaban belum berhasil diproses.");
      }

      setResult(data);

      await loadGame();
    } catch (err) {
      // Server mungkin menerima permintaan sedikit terlalu cepat.
      // Lepaskan penanda agar sistem mencoba kembali.
      if (
        option === null &&
        err.message?.includes("Waktu menjawab belum habis")
      ) {
        timeoutQuestionRef.current = null;
        return;
      }

      setError(err.message || "Jawaban gagal dikirim.");
      await loadGame();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    myAnswer,
    room?.status,
    token,
    question,
    loadGame,
  ]);

  // Otomatis mencatat timeout ketika timer pribadi habis.
  useEffect(() => {
    if (
      room?.status !== "live" ||
      !question ||
      myAnswer ||
      submitting ||
      timeLeft > 0
    ) {
      return;
    }

    if (timeoutQuestionRef.current === question.id) return;

    timeoutQuestionRef.current = question.id;
    submitAnswer(null);
  }, [
    room?.status,
    question,
    myAnswer,
    submitting,
    timeLeft,
    submitAnswer,
  ]);

  const myPlayer = players.find((p) => p.id === myPlayerId);

  const rows = [];

  for (let row = 9; row >= 0; row--) {
    const numbers = Array.from(
      { length: 10 },
      (_, col) => row * 10 + col + 1
    );

    if (row % 2 === 1) numbers.reverse();
    rows.push(numbers);
  }

  if (loading) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#10234d",
        color: "white",
        display: "grid",
        placeItems: "center",
        fontSize: 22,
        fontWeight: "bold",
      }}>
        Memuat permainan...
      </main>
    );
  }

  if (error && !room) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#10234d",
        color: "white",
        padding: 30,
        textAlign: "center",
      }}>
        <h2>Permainan belum dapat dibuka</h2>
        <p>{error}</p>
        <button onClick={() => router.push("/play")}>
          Kembali ke halaman pemain
        </button>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      padding: 16,
      background: "linear-gradient(135deg, #10234d, #1e40af)",
      fontFamily: "Arial, sans-serif",
      color: "white",
      textAlign: "center",
    }}>

      <h1 style={{
        fontSize: "clamp(25px, 5vw, 38px)",
        color: "#facc15",
        marginBottom: 5,
        textShadow: "2px 2px 4px #000",
      }}>
        🐍 QUIZ ARENA LIVE 🪜
      </h1>

      <h2 style={{
        fontSize: 20,
        color: "white",
        marginTop: 5,
      }}>
        Ular Tangga Bahasa Indonesia
      </h2>

      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        margin: "20px auto",
      }}>
        <div style={{
          background: "#ffffff",
          color: "#172554",
          padding: "14px 22px",
          borderRadius: 14,
          minWidth: 125,
          boxShadow: "0 4px 12px #0005",
        }}>
          <strong>Nama Pemain</strong>
          <div style={{
            fontSize: 19,
            fontWeight: "bold",
            marginTop: 6,
          }}>
            {myPlayer?.nickname || "Siswa"}
          </div>
        </div>

        <div style={{
          background: "#facc15",
          color: "#172554",
          padding: "14px 22px",
          borderRadius: 14,
          minWidth: 125,
          boxShadow: "0 4px 12px #0005",
        }}>
          <strong>Posisi Pion</strong>
          <div style={{
            fontSize: 25,
            fontWeight: "bold",
            marginTop: 4,
          }}>
            Kotak {myPlayer?.position ?? 1}
          </div>
        </div>

        <div style={{
          background: timeLeft <= 5 ? "#fecaca" : "#ffffff",
          color: timeLeft <= 5 ? "#991b1b" : "#b91c1c",
          padding: "14px 22px",
          borderRadius: 14,
          minWidth: 125,
          boxShadow: "0 4px 12px #0005",
        }}>
          <strong>Waktu Menjawab</strong>
          <div style={{
            fontSize: 25,
            fontWeight: "bold",
            marginTop: 4,
          }}>
            {timeLeft} detik
          </div>
        </div>
      </div>

      {/* PAPAN ULAR TANGGA */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 650,
        aspectRatio: "1",
        margin: "20px auto",
        border: "5px solid #facc15",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 25px #0008",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
          width: "100%",
          height: "100%",
        }}>
          {rows.flat().map((number) => {
            const snake = SNAKES[number];
            const ladder = LADDERS[number];

            const occupants = players.filter(
              (p) => Number(p.position) === number
            );

            const baseColor = snake
              ? "#fecaca"
              : ladder
                ? "#bbf7d0"
                : (
                    Math.floor((number - 1) / 10) +
                    Math.floor((number - 1) % 10)
                  ) % 2 === 0
                    ? "#ffffff"
                    : "#bfdbfe";

            return (
              <div
                key={number}
                style={{
                  aspectRatio: "1",
                  border: "1px solid #475569",
                  background: baseColor,
                  color: "#111827",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "clamp(10px, 2.5vw, 17px)",
                  fontWeight: "bold",
                  position: "relative",
                  minWidth: 0,
                }}
              >
                <span style={{
                  position: "relative",
                  zIndex: 3,
                  background: "#ffffffcc",
                  borderRadius: 5,
                  padding: "1px 3px",
                }}>
                  {number}
                </span>

                <div style={{
                  position: "relative",
                  zIndex: 3,
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 2,
                }}>
                  {occupants.map((p) => (
                    <span
                      key={p.id}
                      title={p.nickname}
                      style={{
                        width: 15,
                        height: 15,
                        borderRadius: "50%",
                        background: p.color || "#2563eb",
                        border: p.id === myPlayerId
                          ? "3px solid #111827"
                          : "2px solid white",
                        display: "inline-block",
                        boxShadow: "0 1px 3px #0008",
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {Object.entries(LADDERS).map(([from, to]) => (
            <LadderDrawing
              key={`ladder-${from}`}
              from={from}
              to={to}
            />
          ))}

          {Object.entries(SNAKES).map(([from, to]) => (
            <SnakeDrawing
              key={`snake-${from}`}
              from={from}
              to={to}
            />
          ))}
        </svg>
      </div>

      {/* DAFTAR PEMAIN */}
      <div style={{
        maxWidth: 650,
        margin: "20px auto",
        padding: 18,
        background: "#172554",
        border: "2px solid #60a5fa",
        borderRadius: 14,
        textAlign: "left",
        boxShadow: "0 5px 15px #0005",
      }}>
        <h3 style={{
          color: "#facc15",
          marginTop: 0,
          fontSize: 21,
        }}>
          👥 DAFTAR PEMAIN
        </h3>

        {players.map((p, index) => (
          <div key={p.id} style={{
            padding: 12,
            marginBottom: 7,
            borderRadius: 8,
            background: index % 2 === 0 ? "#ffffff" : "#dbeafe",
            color: "#172554",
            fontSize: 15,
            fontWeight: "bold",
          }}>
            <span style={{
              display: "inline-block",
              width: 14,
              height: 14,
              background: p.color || "#2563eb",
              borderRadius: "50%",
              marginRight: 9,
              border: "1px solid #334155",
              verticalAlign: "middle",
            }} />

            {p.nickname}
            {p.id === myPlayerId ? " (Saya)" : ""}
            {" — Kotak "}{p.position}
            {p.dice_roll ? ` — Dadu ${p.dice_roll}` : ""}
          </div>
        ))}
      </div>

      {/* PERTANYAAN PRIBADI */}
      {room?.status === "live" && question && questionsRemaining && (
        <section style={{
          maxWidth: 650,
          margin: "20px auto",
          padding: 20,
          background: "#ffffff",
          color: "#172554",
          borderRadius: 14,
          textAlign: "left",
          boxShadow: "0 5px 15px #0005",
        }}>
          <h2 style={{ color: "#1d4ed8" }}>
            📝 PERTANYAAN UNTUK ANDA
          </h2>

          <p style={{
            fontSize: 18,
            fontWeight: "bold",
            lineHeight: 1.5,
          }}>
            {question.prompt}
          </p>

          {Array.isArray(question.options) &&
            question.options.map((option, index) => {
              const letter = ["A", "B", "C", "D"][index];

              const optionText = typeof option === "string"
                ? option
                : option.text || option.label || "";

              return (
                <button
                  key={letter}
                  disabled={!!myAnswer || submitting || timeLeft <= 0}
                  onClick={() => submitAnswer(letter)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 15,
                    marginTop: 10,
                    borderRadius: 10,
                    border: "2px solid #93c5fd",
                    background: myAnswer?.selected_option === letter
                      ? "#bfdbfe"
                      : "#eff6ff",
                    color: "#172554",
                    textAlign: "left",
                    fontSize: 16,
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {letter}. {optionText}
                </button>
              );
            })}

          {submitting && (
            <p style={{ color: "#1d4ed8", fontWeight: "bold" }}>
              Memproses jawaban...
            </p>
          )}

          {myAnswer && (
            <p style={{
              color: myAnswer.is_timeout ? "#b91c1c" : "#15803d",
              fontWeight: "bold",
            }}>
              {myAnswer.is_timeout
                ? "Waktu habis. Anda tetap di kotak yang sama dan mendapatkan soal baru."
                : myAnswer.is_correct
                  ? "Jawaban benar! Pion Anda bergerak."
                  : "Jawaban salah. Anda tetap di kotak yang sama dan mendapatkan soal baru."}
            </p>
          )}

          {result && (
            <p style={{
              color: result.is_correct ? "#15803d" : "#dc2626",
              fontWeight: "bold",
              fontSize: 17,
            }}>
              {result.is_timeout
                ? "Waktu habis! Soal berikutnya sedang disiapkan."
                : result.is_correct
                  ? `Benar! Dadu ${result.dice_roll}. Pion berpindah ke kotak ${result.new_position}.`
                  : "Jawaban belum tepat. Pion tetap di tempat."}
            </p>
          )}

          {timeLeft === 0 && !myAnswer && (
            <p style={{ color: "#b91c1c", fontWeight: "bold" }}>
              Waktu habis. Sistem sedang mencatat jawaban Anda...
            </p>
          )}
        </section>
      )}

      {room?.status === "waiting" && (
        <h3 style={{ color: "#facc15" }}>
          ⏳ Menunggu Host memulai permainan...
        </h3>
      )}

      {room?.status === "countdown" && (
        <h3 style={{ color: "#facc15" }}>
          🚦 Bersiap! Permainan akan segera dimulai...
        </h3>
      )}

      {room?.status === "finished" && (
        <h2 style={{ color: "#4ade80" }}>
          🏆 PERMAINAN TELAH SELESAI!
        </h2>
      )}

      {room?.status === "live" && !questionsRemaining && (
        <section style={{
          maxWidth: 650,
          margin: "20px auto",
          padding: 24,
          background: "#dcfce7",
          color: "#166534",
          borderRadius: 14,
          boxShadow: "0 5px 15px #0005",
        }}>
          <h2>🏆 PERMAINAN ANDA SELESAI!</h2>
          <p style={{ fontWeight: "bold", fontSize: 17 }}>
            Selamat! Anda sudah menyelesaikan seluruh soal yang tersedia.
          </p>
          <p>
            Posisi akhir pion: kotak {myPlayer?.position ?? 1}
          </p>
        </section>
      )}

      {room?.status === "live" && question && questionsRemaining === true && !myAnswer && (
        <p style={{
          color: "#facc15",
          fontWeight: "bold",
        }}>
          Waktu menjawab setiap soal adalah 30 detik.
        </p>
      )}

      {room?.status === "live" && !question && questionsRemaining && (
        <h3 style={{ color: "#facc15" }}>
          Soal sedang disiapkan...
        </h3>
      )}

      {error && (
        <p style={{
          color: "#fecaca",
          fontWeight: "bold",
          background: "#7f1d1d",
          padding: 10,
          borderRadius: 8,
        }}>
          {error}
        </p>
      )}
    </main>
  );
}
