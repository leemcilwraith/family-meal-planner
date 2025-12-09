"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"

type Plan = {
  [day: string]: {
    lunch: string
    dinner: string
  }
}

export default function PlannerPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState("")

  // Days of the week (fixed order)
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]

  // ------------------------------
  // Load the user's household
  // ------------------------------
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (link?.household_id) {
        setHouseholdId(link.household_id)
      }
    }

    load()
  }, [])

  // ------------------------------
  // Generate plan via AI
  // ------------------------------
  async function generatePlan() {
    if (!householdId) return

    setLoading(true)
    setError("")
    setPlan(null)

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ householdId }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "AI failed to generate a plan")
      } else {
        setPlan(json.plan)
      }
    } catch (err) {
      console.error("AI error:", err)
      setError("Unable to generate plan")
    }

    setLoading(false)
  }

  // ------------------------------
  // Render UI
  // ------------------------------
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Weekly Planner</h1>

      <Button onClick={generatePlan} disabled={!householdId || loading}>
        {loading ? "Generating…" : "Generate Weekly Plan"}
      </Button>

      {error && <p className="text-red-500">{error}</p>}

      {/* No plan yet */}
      {!plan && !loading && (
        <p className="text-gray-600">Your plan will appear here once generated.</p>
      )}

      {/* Display generated plan */}
      {plan && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="font-bold text-lg">Day</div>
          <div className="font-bold text-lg">Lunch</div>
          <div className="font-bold text-lg">Dinner</div>

          {days.map((day) => (
            <Fragment key={day}>
              <div className="font-medium">{day}</div>
              <div className="bg-gray-100 p-2 rounded">{plan[day]?.lunch}</div>
              <div className="bg-gray-100 p-2 rounded">{plan[day]?.dinner}</div>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}

import { Fragment } from "react"