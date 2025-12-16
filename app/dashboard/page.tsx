"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  const router = useRouter()

  const [email, setEmail] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        router.push("/login")
        return
      }

      setEmail(user.email ?? null)

      const { data: link, error } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !link?.household_id) {
        console.error("Failed to load household", error)
        return
      }

      setHouseholdId(link.household_id)
      setLoading(false)
    }

    load()
  }, [router])

  if (loading) {
    return <div className="p-10 text-gray-500">Loading dashboard…</div>
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>Email:</strong> {email}
          </div>

          {householdId && (
            <div className="text-xs text-gray-400 break-all">
              Household ID: {householdId}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
