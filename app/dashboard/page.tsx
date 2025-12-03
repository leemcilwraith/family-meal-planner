"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"

export default function Dashboard() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState<any>(null)

  // 1. Load the current logged-in session
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        // Not logged in → redirect to login
        window.location.href = "/login"
      } else {
        setSession(data.session)
      }
      setLoading(false)
    })
  }, [])

  // 2. Fetch household for this user
  useEffect(() => {
    if (!session) return

    const userId = session.user.id

    supabase
      .from("user_households")
      .select("households ( name, id )")
      .eq("user_id", userId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setHousehold(data.households)
        }
      })
  }, [session])

  if (loading) {
    return <main style={{ padding: "2rem" }}>Loading...</main>
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Dashboard</h1>

      {session && (
        <>
          <p>You are logged in as: <strong>{session.user.email}</strong></p>

          {household ? (
            <p>Your household: <strong>{household.name}</strong></p>
          ) : (
            <p>Loading household...</p>
          )}
        </>
      )}
    </main>
  )
}