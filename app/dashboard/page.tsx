"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession()
      setUser(data.session?.user ?? null)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Dashboard</h1>

      {user && (
        <p className="text-gray-600">
          You are logged in as: <strong>{user.email}</strong>
        </p>
      )}

      <p className="text-gray-700">
        Use the sidebar to manage meals, set preferences, or generate a weekly plan.
      </p>
    </div>
  )
}
