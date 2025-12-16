"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

type DayConfig = {
  lunch: boolean
  dinner: boolean
}

type DayConfigMap = {
  [day: string]: DayConfig
}

export default function PlannerPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(true)

  const [dayConfig, setDayConfig] = useState<DayConfigMap>(() =>
    Object.fromEntries(
      DAYS.map((day) => [day, { lunch: true, dinner: true }])
    )
  )

  const [plan, setPlan] = useState<Record<string, DayConfig & { lunch: string; dinner: string }> | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState("")

  // --------------------------------------------------
  // Load householdId ONCE
  // --------------------------------------------------
  useEffect(() => {
    async function loadHousehold() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        setLoadingHousehold(false)
        return
      }

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (link?.household_id) {
        setHouseholdId(link.household_id)
      }

      setLoadingHousehold(false)
    }

    loadHousehold()
  }, [])

  // --------------------------------------------------
  // Toggle handlers
  // --------------------------------------------------
  function toggleMeal(day: string, meal: "lunch" | "dinner") {
    setDayConfig((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [meal]: !prev[day][meal],
      },
    }))
  }

  function selectAll() {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((day) => [day, { lunch: true, dinner: true }])
      )
    )
  }

  function clearAll() {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((day) => [day, { lunch: false, dinner: false }])
      )
    )
  }

  // --------------------------------------------------
  // Generate Plan
  // --------------------------------------------------
  async function generatePlan() {
    if (!householdId) {
      setError("Household not ready yet. Please try again.")
      return
    }

    const hasAnySelection = DAYS.some(
      (day) => dayConfig[day].lunch || dayConfig[day].dinner
    )

    if (!hasAnySelection) {
      setError("Please select at least one meal.")
      return
    }

    setLoadingPlan(true)
    setError("")
    setPlan(null)

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          selectedDays: dayConfig,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to generate plan")
        setLoadingPlan(false)
        return
      }

      setPlan(data.plan)
    } catch (err) {
      setError("Network error while generating plan")
    }

    setLoadingPlan(false)
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  if (loadingHousehold) {
    return <p className="p-10">Loading planner…</p>
  }

  if (!householdId) {
    return (
      <div className="p-10 space-y-4">
        <h1 className="text-2xl font-semibold">No household found</h1>
        <p>Please complete onboarding first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-6">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* ---------------------------------- */}
      {/* Day / Meal Matrix */}
      {/* ---------------------------------- */}
      <div className="border rounded-lg p-6 space-y-4 bg-white shadow">
        <h2 className="text-2xl font-semibold">Select meals to generate</h2>

        <div className="grid grid-cols-3 font-semibold gap-4">
          <div>Day</div>
          <div>Lunch</div>
          <div>Dinner</div>
        </div>

        {DAYS.map((day) => (
          <div key={day} className="grid grid-cols-3 gap-4 items-center">
            <div>{day}</div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={dayConfig[day].lunch}
                onCheckedChange={() => toggleMeal(day, "lunch")}
              />
              <Label>Lunch</Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={dayConfig[day].dinner}
                onCheckedChange={() => toggleMeal(day, "dinner")}
              />
              <Label>Dinner</Label>
            </div>
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="outline" onClick={clearAll}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Generate Button */}
      <Button onClick={generatePlan} disabled={loadingPlan} className="text-lg py-6">
        {loadingPlan ? "Generating…" : "Generate Plan"}
      </Button>

      {error && <p className="text-red-500 font-medium">{error}</p>}

      {/* ---------------------------------- */}
      {/* Render Plan */}
      {/* ---------------------------------- */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const cfg = dayConfig[day]
            if (!cfg.lunch && !cfg.dinner) return null

            return (
              <div key={day} className="border rounded-lg p-4 bg-white shadow">
                <h3 className="text-2xl font-semibold mb-3">{day}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cfg.lunch && (
                    <div>
                      <p className="font-semibold">Lunch</p>
                      <p>{plan[day]?.lunch || "—"}</p>
                    </div>
                  )}
                  {cfg.dinner && (
                    <div>
                      <p className="font-semibold">Dinner</p>
                      <p>{plan[day]?.dinner || "—"}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
