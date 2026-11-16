
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { QUESTION_BANK } from "../../lib/questionBank";

const HOST_TOKEN_KEY = "quiz_bahasa_host_token";
const HOST_SESSIONS_KEY = "quiz_bahasa_host_sessions";
const QUESTION_TIME = 30;
const COUNTDOWN_TIME = 3;
const TOTAL_QUESTIONS = 100;

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function savedKey(roomId) {
  return `quiz_bahasa_questions_saved_${roomId}`;
}

function readSessions() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(HOST_SESSIONS_KEY) || "[]"
    );

    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  localStorage.setItem(
    HOST_SESSIONS_KEY,
    JSON.stringify(sessions)
  );
}

export default function HostPage() {
  const router = useRouter();

  const [token, setToken] = useState(null);
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [questionsSaved, setQuestionsSaved] = useState(false);

  const processingRef = useRef(false);

  const updateSessions = useCallback((nextSessions) => {
    writeSessions(nextSessions);
    setSessions(nextSessions);
  }, []);

  const loadRoom = useCallback(async (hostToken) => {
    if (!hostToken) return null;

    try {
      const { data, error } = await supabase.rpc(
        "host_get_state",
        { p_token: hostToken }
      );

      if (error) throw error;

      if (!data?.success || !data.room) {
        throw new Error("Data room tidak ditemukan.");
      }

      setRoom(data.room);
      setPlayers(data.players || []);

      setQuestionsSaved(
        localStorage.getItem(savedKey(data.room.id)) === "true"
      );

      setError("");

      const currentSessions = readSessions();

      const updated = currentSessions.map((item) =>
        item.token === hostToken
          ? {
              ...item,
              roomId: data.room.id,
              code: data.room.code,
              status: data.room.status,
            }
          : item
      );

      updateSessions(updated);

      return data;
    } catch (err) {
      setError(err.message || "Gagal mengambil data room.");
      return null;
    }
  }, [updateSessions]);

  // Memeriksa room yang pernah dibuat.
  useEffect(() => {
    async function prepareSessions() {
      try {
        let list = readSessions();

        const oldToken = localStorage.getItem(HOST_TOKEN_KEY);

        if (
          oldToken &&
          !list.some((item) => item.token === oldToken)
        ) {
          list.push({
            token: oldToken,
            roomId: null,
            code: "Memeriksa room...",
          });
        }

        const validSessions = [];

        for (const item of list) {
          if (!item?.token) continue;

          const { data, error } = await supabase.rpc(
            "host_get_state",
            { p_token: item.token }
          );

          if (error || !data?.success || !data.room) {
            continue;
          }

          validSessions.push({
            token: item.token,
            roomId: data.room.id,
            code: data.room.code,
            status: data.room.status,
          });
        }

        updateSessions(validSessions);
      } catch (err) {
        setError(
          err.message || "Gagal memeriksa room sebelumnya."
        );
      } finally {
        setChecking(false);
      }
    }

    prepareSessions();
  }, [updateSessions]);

  // Membuat room baru dengan token Host tersendiri.
  async function createRoom() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const code = generateRoomCode();

      const { data, error } = await supabase.rpc(
        "create_host_room",
        { p_code: code }
      );

      if (error) throw error;

      if (!data?.success || !data?.host_token) {
        throw new Error("Room gagal dibuat.");
      }

      const newToken = data.host_token;

      const currentSessions = readSessions();

      const nextSessions = [
        ...currentSessions.filter(
          (item) => item.token !== newToken
        ),
        {
          token: newToken,
          roomId: data.room_id,
          code: data.code,
          status: "waiting",
        },
      ];

      updateSessions(nextSessions);

      localStorage.setItem(HOST_TOKEN_KEY, newToken);

      setToken(newToken);
      setRoom(null);
      setPlayers([]);
      setQuestionsSaved(false);

      const loaded = await loadRoom(newToken);

      if (!loaded) {
        throw new Error("Room dibuat, tetapi gagal dimuat.");
      }

      setMessage("Room baru berhasil dibuat.");
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  // Melanjutkan room sebelumnya.
  async function resumeRoom(session) {
    if (!session?.token) return;

    setLoading(true);
    setError("");
    setMessage("");

    const loaded = await loadRoom(session.token);

    if (loaded) {
      setToken(session.token);

      localStorage.setItem(
        HOST_TOKEN_KEY,
        session.token
      );

      setMessage(
        `Room ${loaded.room.code} berhasil dilanjutkan.`
      );
    } else {
      setError(
        "Room tidak dapat dilanjutkan. Token mungkin sudah dicabut."
      );
    }

    setLoading(false);
  }

  // Keluar hanya jika Host menekan tombol Keluar.
  async function logoutHost() {
    if (!token) return;

    const confirmed = window.confirm(
      "Keluar dari room ini? Token Host akan dinonaktifkan dan tidak bisa digunakan untuk melanjutkan room ini lagi."
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.rpc(
        "host_logout",
        { p_token: token }
      );

      if (error) throw error;

      const nextSessions = readSessions().filter(
        (item) => item.token !== token
      );

      updateSessions(nextSessions);

      if (localStorage.getItem(HOST_TOKEN_KEY) === token) {
        localStorage.removeItem(HOST_TOKEN_KEY);
      }

      setToken(null);
      setRoom(null);
      setPlayers([]);
      setQuestionsSaved(false);

      setMessage(
        "Anda sudah keluar. Token Host ini telah dinonaktifkan."
      );
    } catch (err) {
      setError(err.message || "Gagal keluar dari room.");
    } finally {
      setLoading(false);
    }
  }

  // Menyimpan 100 soal ke room.
  async function saveQuestions() {
    if (!token || !room?.id) return;

    if (QUESTION_BANK.length !== TOTAL_QUESTIONS) {
      setError(
        `Jumlah soal harus 100. Saat ini terdeteksi ${QUESTION_BANK.length} soal.`
      );
      return;
    }

    if (room.status !== "waiting") {
      setError(
        "Bank soal hanya dapat disimpan sebelum permainan dimulai."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "host_save_questions",
        {
          p_token: token,
          p_questions: QUESTION_BANK.map((question) => ({
            prompt: question.prompt,
            options: question.options,
            correct_option: question.correct_option,
            explanation: question.explanation || "",
          })),
        }
      );

      if (error) throw error;

      if (data && data.success === false) {
        throw new Error(
          data.message || "Bank soal gagal disimpan."
        );
      }

      localStorage.setItem(savedKey(room.id), "true");

      setQuestionsSaved(true);
      setMessage("Berhasil! 100 soal sudah disimpan ke room.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan bank soal.");
    } finally {
      setLoading(false);
    }
  }

  // Menyalin kode room.
  async function copyRoomCode() {
    if (!room?.code) return;

    try {
      await navigator.clipboard.writeText(room.code);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kode room gagal disalin.");
    }
  }

  // Memulai permainan satu kali melalui hitung mundur.
  async function startGame() {
    if (!token || !room) return;

    if (!questionsSaved) {
      setError("Simpan 100 soal terlebih dahulu sebelum memulai.");
      return;
    }

    if (players.length === 0) {
      setError("Tunggu minimal satu siswa bergabung.");
      return;
    }

    if (room.status !== "waiting") {
      setError("Room belum siap untuk memulai permainan.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "host_publish_question",
        {
          p_token: token,
          p_question_index: 0,
          p_countdown_seconds: COUNTDOWN_TIME,
        }
      );

      if (error) throw error;

      setMessage(
        "Hitung mundur dimulai. Setiap siswa akan mendapatkan soal dan timer pribadi."
      );

      await loadRoom(token);
    } catch (err) {
      setError(err.message || "Gagal memulai permainan.");
    } finally {
      setLoading(false);
    }
  }

  // Host hanya memantau room dan menyelesaikan hitung mundur.
  // Tidak ada lagi host_finish_round atau publikasi soal global.
  const processGame = useCallback(async (hostToken) => {
    if (!hostToken || processingRef.current) return;

    processingRef.current = true;

    try {
      const { data, error } = await supabase.rpc(
        "host_get_state",
        { p_token: hostToken }
      );

      if (error || !data?.success || !data.room) return;

      const currentRoom = data.room;

      setRoom(currentRoom);
      setPlayers(data.players || []);

      if (
        currentRoom.status === "countdown" &&
        currentRoom.ends_at
      ) {
        const remaining =
          new Date(currentRoom.ends_at).getTime() - Date.now();

        if (remaining <= 0) {
          const { error: startError } = await supabase.rpc(
            "host_start_live_after_countdown",
            { p_token: hostToken }
          );

          if (startError) throw startError;

          const refreshed = await supabase.rpc(
            "host_get_state",
            { p_token: hostToken }
          );

          if (refreshed.error) throw refreshed.error;

          if (refreshed.data?.success) {
            setRoom(refreshed.data.room);
            setPlayers(refreshed.data.players || []);

            setMessage(
              "Permainan berlangsung! Setiap siswa mengerjakan soal masing-masing."
            );
          }
        }
      }
    } catch (err) {
      setError(
        err.message || "Terjadi masalah saat memantau permainan."
      );
    } finally {
      processingRef.current = false;
    }
  }, []);

  // Pemantauan otomatis setiap detik.
  useEffect(() => {
    if (!token) return;

    processGame(token);

    const interval = setInterval(() => {
      processGame(token);
    }, 1000);

    return () => clearInterval(interval);
  }, [token, processGame]);

  const statusText = {
    waiting: "MENUNGGU SISWA",
    countdown: "HITUNG MUNDUR",
    live: "PERMAINAN BERLANGSUNG",
    finished: "PERMAINAN SELESAI",
  };

  if (checking) {
    return (
      <main style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#eff6ff",
        fontFamily: "Arial",
      }}>
        <h2 style={{ color: "#1e3a8a" }}>
          Memeriksa room Host...
        </h2>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #10234d, #1e40af)",
      padding: "24px",
      fontFamily: "Arial, sans-serif",
      color: "white",
    }}>
      <div style={{
        maxWidth: "900px",
        margin: "20px auto",
        background: "white",
        color: "#1e293b",
        borderRadius: "24px",
        padding: "28px",
        boxShadow: "0 10px 35px rgba(0,0,0,0.2)",
      }}>
        <h1 style={{
          textAlign: "center",
          color: "#1e3a8a",
          fontSize: "30px",
        }}>
          👨‍🏫 HALAMAN HOST
        </h1>

        <p style={{
          textAlign: "center",
          color: "#64748b",
        }}>
          QUIZ ARENA LIVE - BAHASA INDONESIA
        </p>

        {!token ? (
          <div style={{ padding: "20px 0" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "60px" }}>🎲 🐍 🪜</div>
              <h2>Kelola Permainan Host</h2>
              <p style={{
                color: "#64748b",
                lineHeight: 1.6,
              }}>
                Buat room baru atau lanjutkan room yang pernah dibuat.
              </p>
            </div>

            <button
              onClick={createRoom}
              disabled={loading}
              style={{
                width: "100%",
                padding: "18px",
                background: loading ? "#94a3b8" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "14px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "15px",
              }}
            >
              {loading ? "MEMBUAT ROOM..." : "➕ BUAT ROOM BARU"}
            </button>

            <h3 style={{
              color: "#1e3a8a",
              marginTop: "30px",
            }}>
              📂 ROOM SEBELUMNYA
            </h3>

            {sessions.length === 0 ? (
              <p style={{ color: "#64748b" }}>
                Belum ada room sebelumnya yang dapat dilanjutkan.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gap: "12px",
              }}>
                {sessions.map((session) => (
                  <button
                    key={session.token}
                    onClick={() => resumeRoom(session)}
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "16px",
                      background: "#ecfdf5",
                      border: "2px solid #86efac",
                      borderRadius: "12px",
                      color: "#166534",
                      fontWeight: "bold",
                      fontSize: "16px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    ▶ LANJUTKAN ROOM {session.code || ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {room && (
              <>
                <div style={{
                  background: "#dbeafe",
                  borderRadius: "18px",
                  padding: "22px",
                  textAlign: "center",
                  marginTop: "25px",
                }}>
                  <p style={{
                    color: "#1e40af",
                    fontWeight: "bold",
                    margin: "0 0 10px",
                  }}>
                    KODE ROOM
                  </p>

                  <div style={{
                    fontSize: "42px",
                    fontWeight: "900",
                    letterSpacing: "8px",
                    color: "#1e3a8a",
                  }}>
                    {room.code}
                  </div>

                  <button
                    onClick={copyRoomCode}
                    style={{
                      marginTop: "15px",
                      padding: "12px 22px",
                      background: "white",
                      color: "#2563eb",
                      border: "2px solid #2563eb",
                      borderRadius: "10px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "✓ KODE TERSALIN" : "📋 SALIN KODE ROOM"}
                  </button>
                </div>

                <div style={{
                  marginTop: "22px",
                  padding: "18px",
                  borderRadius: "14px",
                  background: "#f1f5f9",
                }}>
                  <h3 style={{
                    color: "#1e3a8a",
                    marginTop: 0,
                  }}>
                    📚 BANK SOAL
                  </h3>

                  <p style={{ color: "#334155" }}>
                    Jumlah soal tersedia:{" "}
                    <strong>{QUESTION_BANK.length} soal</strong>
                  </p>

                  <p style={{
                    color: questionsSaved ? "#166534" : "#92400e",
                    fontWeight: "bold",
                  }}>
                    {questionsSaved
                      ? "✓ 100 soal sudah disimpan ke room."
                      : "Bank soal belum disimpan ke room."}
                  </p>

                  {!questionsSaved && (
                    <button
                      onClick={saveQuestions}
                      disabled={loading || room.status !== "waiting"}
                      style={{
                        width: "100%",
                        padding: "15px",
                        background: loading ? "#94a3b8" : "#0d9488",
                        color: "white",
                        border: "none",
                        borderRadius: "12px",
                        fontSize: "16px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      {loading ? "MENYIMPAN SOAL..." : "💾 SIMPAN 100 SOAL"}
                    </button>
                  )}
                </div>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginTop: "25px",
                }}>
                  <h2 style={{
                    color: "#1e3a8a",
                    margin: 0,
                  }}>
                    👥 DAFTAR SISWA
                  </h2>

                  <span style={{
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "9px 15px",
                    borderRadius: "20px",
                    fontWeight: "bold",
                  }}>
                    {players.length} SISWA BERGABUNG
                  </span>
                </div>

                <div style={{
                  marginTop: "15px",
                  background: "#f1f5f9",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  color: "#334155",
                }}>
                  Status room:{" "}
                  <strong>
                    {statusText[room.status] || room.status}
                  </strong>
                </div>

                {players.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "35px 10px",
                    color: "#64748b",
                  }}>
                    <div style={{ fontSize: "45px" }}>📱</div>
                    <p>Belum ada siswa yang bergabung.</p>
                    <p>Bagikan kode room kepada siswa.</p>
                  </div>
                ) : (
                  <div style={{
                    marginTop: "15px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}>
                    {players.map((player, index) => (
                      <div
                        key={player.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "14px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: "12px",
                        }}
                      >
                        <div style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: player.color || "#2563eb",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: "bold",
                        }}>
                          {index + 1}
                        </div>

                        <div style={{ flex: 1 }}>
                          <strong style={{ color: "#1e293b" }}>
                            {player.nickname}
                          </strong>

                          <div style={{
                            fontSize: "13px",
                            color: "#64748b",
                            marginTop: "4px",
                          }}>
                            Kotak {player.position}
                          </div>
                        </div>

                        <span title={
                          player.is_connected ? "Terhubung" : "Terputus"
                        }>
                          {player.is_connected ? "🟢" : "🔴"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {room.status === "waiting" && (
                  <>
                    <button
                      onClick={startGame}
                      disabled={
                        loading ||
                        !questionsSaved ||
                        players.length === 0
                      }
                      style={{
                        width: "100%",
                        marginTop: "25px",
                        padding: "18px",
                        background:
                          loading ||
                          !questionsSaved ||
                          players.length === 0
                            ? "#94a3b8"
                            : "#16a34a",
                        color: "white",
                        border: "none",
                        borderRadius: "14px",
                        fontSize: "18px",
                        fontWeight: "bold",
                        cursor: "pointer",
                      }}
                    >
                      {loading ? "MEMPROSES..." : "🎲 MULAI PERMAINAN"}
                    </button>

                    <p style={{
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "13px",
                      marginTop: "15px",
                    }}>
                      Permainan menggunakan 100 soal, waktu{" "}
                      {QUESTION_TIME} detik per soal, dan hitung mundur{" "}
                      {COUNTDOWN_TIME} detik.
                    </p>
                  </>
                )}

                {room.status === "countdown" && (
                  <div style={{
                    marginTop: "22px",
                    padding: "18px",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: "12px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}>
                    🚦 HITUNG MUNDUR SEDANG BERJALAN
                    <p style={{ marginBottom: 0 }}>
                      Permainan segera dimulai.
                    </p>
                  </div>
                )}

                {room.status === "live" && (
                  <div style={{
                    marginTop: "22px",
                    padding: "20px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: "12px",
                    textAlign: "center",
                  }}>
                    <h3 style={{ marginTop: 0 }}>
                      🟢 PERMAINAN BERLANGSUNG
                    </h3>
                    <p style={{ fontWeight: "bold" }}>
                      Setiap siswa mengerjakan soal masing-masing.
                    </p>
                    <p>
                      Timer pribadi: {QUESTION_TIME} detik untuk setiap soal.
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      Host cukup memantau posisi dan koneksi siswa.
                    </p>
                  </div>
                )}

                {room.status === "finished" && (
                  <div style={{
                    marginTop: "22px",
                    padding: "20px",
                    background: "#dcfce7",
                    color: "#166534",
                    borderRadius: "12px",
                    textAlign: "center",
                  }}>
                    <h3>🏆 PERMAINAN TELAH SELESAI</h3>
                    <p>Permainan di room ini sudah berakhir.</p>
                  </div>
                )}

                <button
                  onClick={logoutHost}
                  disabled={loading}
                  style={{
                    width: "100%",
                    marginTop: "25px",
                    padding: "15px",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    borderRadius: "12px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  🚪 KELUAR DARI ROOM
                </button>
              </>
            )}
          </>
        )}

        {message && (
          <p style={{
            color: "#166534",
            background: "#dcfce7",
            padding: "12px",
            borderRadius: "10px",
            marginTop: "20px",
          }}>
            {message}
          </p>
        )}

        {error && (
          <p style={{
            color: "#b91c1c",
            background: "#fee2e2",
            padding: "12px",
            borderRadius: "10px",
            marginTop: "20px",
            overflowWrap: "anywhere",
          }}>
            {error}
          </p>
        )}

        <button
          onClick={() => router.push("/")}
          style={{
            display: "block",
            margin: "25px auto 0",
            padding: "12px 20px",
            border: "none",
            background: "#e2e8f0",
            color: "#334155",
            borderRadius: "10px",
            cursor: "pointer",
          }}
        >
          ← KEMBALI KE BERANDA
        </button>
      </div>
    </main>
  );
}
