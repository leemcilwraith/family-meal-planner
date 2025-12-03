"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      setMessage("Logged in successfully!")
      // Later: redirect to dashboard, fetch household, etc.
      console.log("Session:", data)
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Log in</h1>
      <p>This uses Supabase to log you into your account.</p>

      <form
        onSubmit={handleLogin}
        style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 320 }}
      >
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: 4,
            border: "none",
            background: loading ? "#6b7280" : "#111827",
            color: "white",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      {message && <p style={{ marginTop: "1rem", color: "green" }}>{message}</p>}
      {error && <p style={{ marginTop: "1rem", color: "red" }}>{error}</p>}
    </main>
  )
}