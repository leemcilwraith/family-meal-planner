"use client"

import { useState } from "react"
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

// Type for our new per-day plan selection
type DaySelection = {
  [day: string]: { lunch: boolean; dinner: boolean }
}

export default function PlannerPage() {
  const [plan, setPlan] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // --------------------------------------------
  // NEW: Per-Day Meal Selection
  // --------------------------------------------
  const [dayConfig, setDayConfig] = useState<DaySelection>(() =>
    Object.fromEntries(
      DAYS.map((day) => [
        day,
        { lunch: true, dinner: true } // default: both checked
      ])
    )
  )

  const toggleMeal = (day: string, meal: "lunch" | "dinner") => {
    setDayConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] }
    }))
  }

  const selectAllMeals = () => {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((day) => [day, { lunch: true, dinner: true }])
      )
    )
  }

  const clearAllMeals = () => {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((day) => [day, { lunch: false, dinner: false }])
      )
    )
  }

  // --------------------------------------------
  // Generate Plan
  // --------------------------------------------
  async function generatePlan() {
    // Ensure at least one meal is selected somewhere
    const anySelected = DAYS.some(
      (d) => dayConfig[d].lunch || dayConfig[d].dinner
    )
    if (!anySelected) {
      setError("Please select at least one meal on at least one day.")
      return
    }

    setLoading(true)
    setError("")
    setPlan(null)

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        body: JSON.stringify({
          dayConfig,
          greenMeals: ["Roast Dinner", "Fish Fingers"], // placeholder
          householdSettings: {
            kids_appetite: "medium",
            prep_time_preference: "standard",
            risk_level: 5,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to generate plan")
        setLoading(false)
        return
      }

      setPlan(data.plan)
    } catch (err) {
      setError("Network error")
    }

    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pt-10">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* ----------------------------------------------------- */}
      {/* DAY × MEAL SELECTION MATRIX */}
      {/* ----------------------------------------------------- */}
      <div className="space-y-4 p-4 border rounded-lg bg-white shadow">
        <h2 className="text-2xl font-semibold">Select Meals for Each Day</h2>

        <div className="grid grid-cols-3 gap-4 font-semibold">
          <div>Day</div>
          <div>Lunch</div>
          <div>Dinner</div>
        </div>

        {DAYS.map((day) => (
          <div key={day} className="grid grid-cols-3 gap-4 items-center">
            <div className="font-medium">{day}</div>

            {/* Lunch */}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={dayConfig[day].lunch}
                onCheckedChange={() => toggleMeal(day, "lunch")}
              />
              <Label>Lunch</Label>
            </div>

            {/* Dinner */}
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
          <Button variant="outline" onClick={selectAllMeals}>Select All</Button>
          <Button variant="outline" onClick={clearAllMeals}>Clear All</Button>
        </div>
      </div>

      {/* Generate button */}
      <Button onClick={generatePlan} disabled={loading} className="text-lg py-6">
        {loading ? "Generating..." : "Generate Plan"}
      </Button>

      {/* Error */}
      {error && <p className="text-red-500">{error}</p>}

      {/* ----------------------------------------------------- */}
      {/* DISPLAY RESULT */}
      {/* ----------------------------------------------------- */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const cfg = dayConfig[day]
            if (!cfg.lunch && !cfg.dinner) return null // Hide unused days

            return (
              <div key={day} className="border rounded-lg p-4 bg-white shadow-sm">
                <h2 className="text-2xl font-semibold mb-3">{day}</h2>

                <div className="grid grid-cols-2 gap-4">
                  {cfg.lunch && (
                    <div>
                      <h3 className="font-semibold">Lunch</h3>
                      <p className="text-gray-700">{plan[day]?.lunch || "—"}</p>
                    </div>
                  )}
                  {cfg.dinner && (
                    <div>
                      <h3 className="font-semibold">Dinner</h3>
                      <p className="text-gray-700">{plan[day]?.dinner || "—"}</p>
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