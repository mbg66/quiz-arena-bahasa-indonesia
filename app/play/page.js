
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const PLAYER_TOKEN_KEY = "quiz_bahasa_player_token";
const PLAYER_SESSIONS_KEY = "quiz_bahasa_player_sessions";

function readSessions() {
  try {
    const data = JSON.parse(
      localStorage.getItem(PLAYER_SESSIONS_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  localStorage.setItem(
    PLAYER_SESSIONS_KEY,
    JSON.stringify(sessions)
  );
}

export default function PlayPage() {
  const router = useRouter();

  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");

  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryNickname, setRecoveryNickname] = useState("");

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function updateSessions(next) {
    writeSessions(next);
    setSessions(next);
  }

  function savePlayerSession(token, code, name) {
    const current = readSessions();

    const next = [
      ...current.filter((item) => item.token !== token),
      {
        token,
        code,
        nickname: name,
      },
    ];

    updateSessions(next);

    sessionStorage.setItem(
      PLAYER_TOKEN_KEY,
      token
    );
  }

  // Memeriksa sesi pemain yang tersimpan di browser.
  useEffect(() => {
    async function prepareSessions() {
      try {
        let saved = readSessions();

        const tabToken = sessionStorage.getItem(
          PLAYER_TOKEN_KEY
        );

        if (
          tabToken &&
          !saved.some((item) => item.token === tabToken)
        ) {
          saved.push({ token: tabToken });
        }

        const oldToken = localStorage.getItem(
          PLAYER_TOKEN_KEY
        );

        if (
          oldToken &&
          !saved.some((item) => item.token === oldToken)
        ) {
          saved.push({ token: oldToken });
        }

        const validSessions = [];

        for (const item of saved) {
          if (!item?.token) continue;

          const { data, error } = await supabase.rpc(
            "player_get_state",
            {
              p_token: item.token,
            }
          );

          if (error || !data?.success || !data?.room) {
            continue;
          }

          const player = (data.players || []).find(
            (p) => p.id === data.my_player_id
          );

          validSessions.push({
            token: item.token,
            roomId: data.room.id,
            code: data.room.code,
            nickname:
              player?.nickname ||
              item.nickname ||
              "Pemain",
          });
        }

        updateSessions(validSessions);
      } catch (err) {
        setError(
          err.message || "Gagal memeriksa sesi pemain."
        );
      } finally {
        setChecking(false);
      }
    }

    prepareSessions();
  }, []);

  // Melanjutkan sesi yang tokennya masih tersimpan.
  function resumeGame(session) {
    if (!session?.token) return;

    sessionStorage.setItem(
      PLAYER_TOKEN_KEY,
      session.token
    );

    setError("");
    router.push("/game");
  }

  // Memulihkan sesi lama menggunakan kode room dan nama pemain.
  async function recoverSession(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const code = recoveryCode.trim().toUpperCase();
      const name = recoveryNickname.trim();

      const { data, error } = await supabase.rpc(
        "player_recover_session",
        {
          p_code: code,
          p_nickname: name,
        }
      );

      if (error) throw error;

      if (!data?.success || !data?.player_token) {
        throw new Error(
          data?.message || "Sesi pemain tidak ditemukan."
        );
      }

      savePlayerSession(
        data.player_token,
        code,
        name
      );

      setMessage(
        "Sesi lama berhasil dipulihkan. Membuka permainan..."
      );

      router.push("/game");
    } catch (err) {
      setError(
        err.message || "Gagal memulihkan sesi pemain."
      );
    } finally {
      setLoading(false);
    }
  }

  // Bergabung sebagai pemain baru.
  async function joinRoom(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const code = roomCode.trim().toUpperCase();
      const name = nickname.trim();

      const { data, error } = await supabase.rpc(
        "join_room",
        {
          p_code: code,
          p_nickname: name,
        }
      );

      if (error) throw error;

      if (!data?.success || !data?.player_token) {
        throw new Error(
          data?.message || "Tidak berhasil bergabung ke room."
        );
      }

      savePlayerSession(
        data.player_token,
        code,
        name
      );

      setMessage(
        "Berhasil bergabung! Membuka permainan..."
      );

      router.push("/game");
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  // Keluar hanya dari sesi pemain yang dipilih.
  async function logoutPlayer(session) {
    if (!session?.token) return;

    const confirmed = window.confirm(
      `Keluar dari sesi pemain ${session.nickname || ""}? Token sesi ini akan dinonaktifkan. Data permainan yang sudah tersimpan tidak dihapus.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "player_logout",
        {
          p_token: session.token,
        }
      );

      if (error) throw error;

      const next = readSessions().filter(
        (item) => item.token !== session.token
      );

      updateSessions(next);

      if (
        sessionStorage.getItem(PLAYER_TOKEN_KEY) ===
        session.token
      ) {
        sessionStorage.removeItem(PLAYER_TOKEN_KEY);
      }

      setMessage(
        `Sesi pemain ${session.nickname || ""} sudah dinonaktifkan.`
      );
    } catch (err) {
      setError(
        err.message || "Gagal keluar dari sesi pemain."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #172554, #1e40af)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          background: "white",
          padding: 30,
          borderRadius: 20,
          width: "100%",
          maxWidth: 480,
          textAlign: "center",
          boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
        }}
      >
        <h1 style={{ color: "#1e3a8a", fontSize: 25 }}>
          🎮 HALAMAN PEMAIN
        </h1>

        <h2 style={{ color: "#334155", fontSize: 18 }}>
          QUIZ ARENA LIVE
        </h2>

        <p style={{ color: "#64748b" }}>
          BAHASA INDONESIA
        </p>

        {checking ? (
          <p style={{ color: "#64748b", marginTop: 30 }}>
            Memeriksa permainan sebelumnya...
          </p>
        ) : (
          <>
            {/* SESI PEMAIN YANG TERSIMPAN */}
            <div
              style={{
                marginTop: 25,
                padding: 18,
                background: "#eff6ff",
                borderRadius: 14,
                textAlign: "left",
              }}
            >
              <h3
                style={{
                  color: "#1e3a8a",
                  marginTop: 0,
                  textAlign: "center",
                }}
              >
                📂 PERMAINAN SEBELUMNYA
              </h3>

              {sessions.length === 0 ? (
                <p
                  style={{
                    color: "#64748b",
                    textAlign: "center",
                    fontSize: 14,
                  }}
                >
                  Belum ada sesi pemain yang tersimpan di browser ini.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                  }}
                >
                  {sessions.map((session) => (
                    <div
                      key={session.token}
                      style={{
                        background: "white",
                        border: "1px solid #bfdbfe",
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          color: "#1e293b",
                          fontWeight: "bold",
                          marginBottom: 5,
                        }}
                      >
                        {session.nickname}
                      </div>

                      <div
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          marginBottom: 10,
                        }}
                      >
                        Room: {session.code || "-"}
                      </div>

                      <button
                        type="button"
                        onClick={() => resumeGame(session)}
                        disabled={loading}
                        style={{
                          width: "100%",
                          padding: 13,
                          border: "none",
                          borderRadius: 9,
                          background: "#15803d",
                          color: "white",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        ▶ LANJUTKAN PERMAINAN
                      </button>

                      <button
                        type="button"
                        onClick={() => logoutPlayer(session)}
                        disabled={loading}
                        style={{
                          width: "100%",
                          padding: 10,
                          marginTop: 8,
                          border: "1px solid #fecaca",
                          borderRadius: 9,
                          background: "#fee2e2",
                          color: "#b91c1c",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        🚪 KELUAR DARI SESI INI
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PEMULIHAN SESI LAMA */}
            <div
              style={{
                marginTop: 25,
                padding: 18,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 14,
              }}
            >
              <h3 style={{ color: "#166534", marginTop: 0 }}>
                ♻️ PULIHKAN PERMAINAN LAMA
              </h3>

              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Masukkan kode room dan nama yang digunakan sebelumnya.
              </p>

              <form onSubmit={recoverSession}>
                <input
                  value={recoveryCode}
                  onChange={(e) =>
                    setRecoveryCode(e.target.value.toUpperCase())
                  }
                  placeholder="Kode room sebelumnya"
                  maxLength={6}
                  required
                  style={{
                    width: "100%",
                    padding: 14,
                    marginTop: 10,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    fontSize: 17,
                    boxSizing: "border-box",
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                />

                <input
                  value={recoveryNickname}
                  onChange={(e) =>
                    setRecoveryNickname(e.target.value)
                  }
                  placeholder="Nama pemain sebelumnya"
                  maxLength={24}
                  required
                  style={{
                    width: "100%",
                    padding: 14,
                    marginTop: 12,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    fontSize: 17,
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 14,
                    marginTop: 15,
                    border: "none",
                    borderRadius: 10,
                    background: loading ? "#94a3b8" : "#15803d",
                    color: "white",
                    fontSize: 16,
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {loading
                    ? "SEDANG MEMULIHKAN..."
                    : "♻️ LANJUTKAN PERMAINAN LAMA"}
                </button>
              </form>
            </div>

            {/* PEMAIN BARU */}
            <div
              style={{
                marginTop: 25,
                borderTop: "1px solid #e2e8f0",
                paddingTop: 20,
              }}
            >
              <h3 style={{ color: "#1e3a8a" }}>
                ➕ BERGABUNG SEBAGAI PEMAIN BARU
              </h3>

              <form onSubmit={joinRoom}>
                <input
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase())
                  }
                  placeholder="Masukkan kode room"
                  maxLength={6}
                  required
                  style={{
                    width: "100%",
                    padding: 14,
                    marginTop: 15,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    fontSize: 17,
                    boxSizing: "border-box",
                    textAlign: "center",
                    textTransform: "uppercase",
                  }}
                />

                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Masukkan nama pemain"
                  maxLength={24}
                  required
                  style={{
                    width: "100%",
                    padding: 14,
                    marginTop: 12,
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    fontSize: 17,
                    boxSizing: "border-box",
                    textAlign: "center",
                  }}
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: 15,
                    marginTop: 20,
                    border: "none",
                    borderRadius: 10,
                    background: loading ? "#94a3b8" : "#2563eb",
                    color: "white",
                    fontSize: 17,
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {loading
                    ? "SEDANG BERGABUNG..."
                    : "➕ BERGABUNG SEBAGAI PEMAIN BARU"}
                </button>
              </form>
            </div>
          </>
        )}

        {message && (
          <p
            style={{
              color: "#166534",
              background: "#dcfce7",
              padding: 12,
              borderRadius: 10,
              marginTop: 18,
              fontSize: 14,
            }}
          >
            {message}
          </p>
        )}

        {error && (
          <p
            style={{
              color: "#b91c1c",
              background: "#fee2e2",
              padding: 12,
              borderRadius: 10,
              marginTop: 18,
              fontSize: 14,
              overflowWrap: "anywhere",
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 22,
            padding: 10,
            border: "none",
            background: "transparent",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          ← KEMBALI KE BERANDA
        </button>
      </section>
    </main>
  );
}
