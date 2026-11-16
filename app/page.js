
"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #172554, #1e40af, #2563eb)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "600px",
        background: "white",
        borderRadius: "28px",
        padding: "36px 24px",
        textAlign: "center",
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "12px" }}>
          🎲 🐍 🪜
        </div>

        <h1 style={{
          fontSize: "32px",
          fontWeight: "900",
          color: "#1e3a8a",
          margin: "0"
        }}>
          QUIZ ARENA LIVE
        </h1>

        <h2 style={{
          color: "#2563eb",
          fontSize: "23px",
          marginTop: "10px"
        }}>
          BAHASA INDONESIA
        </h2>

        <p style={{
          color: "#475569",
          lineHeight: "1.7",
          margin: "20px 0 28px"
        }}>
          Game edukasi ular tangga interaktif untuk siswa kelas 5 SD.
          Jawab pertanyaan, lempar dadu, naik tangga, dan hindari ular!
        </p>

        <button
          onClick={() => router.push("/host")}
          style={{
            width: "100%",
            padding: "18px",
            border: "none",
            borderRadius: "14px",
            background: "#2563eb",
            color: "white",
            fontSize: "18px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "14px"
          }}
        >
          👨‍🏫 BUAT PERMAINAN (HOST)
        </button>

        <button
          onClick={() => router.push("/play")}
          style={{
            width: "100%",
            padding: "18px",
            border: "2px solid #2563eb",
            borderRadius: "14px",
            background: "white",
            color: "#2563eb",
            fontSize: "18px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          🎮 GABUNG SEBAGAI PEMAIN
        </button>

        <p style={{
          color: "#94a3b8",
          fontSize: "12px",
          marginTop: "28px"
        }}>
          QUIZ ARENA LIVE · KELAS 5 SD · KURIKULUM MERDEKA
        </p>
      </div>
    </main>
  );
}
