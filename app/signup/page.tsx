"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function SignupPage() {
  const [householdName, setHouseholdName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      // 1) Sign up user in Supabase Auth
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Later: 2) Create household row in DB and link user
      setMessage("Signup successful. Check your email (if confirmation is required), then log in.")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Sign up</h1>
      <p>This will create your account via Supabase.</p>

      <form
        onSubmit={handleSignup}
        style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 320 }}
      >
        <label>
          Household name
          <input
            type="text"
            value={householdName}
            onChange={e => setHouseholdName(e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

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
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>

      {message && <p style={{ marginTop: "1rem", color: "green" }}>{message}</p>}
      {error && <p style={{ marginTop: "1rem", color: "red" }}>{error}</p>}
    </main>
  )
}