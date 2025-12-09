"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export default function PlannerPage() {
  const [plan, setPlan] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function generatePlan() {
    setLoading(true)
    setError("")
    setPlan(null)

    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        body: JSON.stringify({
          greenMeals: ["Roast Dinner", "Fish Fingers"], // placeholder — replace later
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
    <div className="max-w-3xl mx-auto space-y-10 pt-10">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* Generate button */}
      <Button onClick={generatePlan} disabled={loading} className="text-lg py-6">
        {loading ? "Generating..." : "Generate Plan"}
      </Button>

      {/* Error message */}
      {error && <p className="text-red-500">{error}</p>}

      {/* Plan results */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => (
            <div key={day} className="border rounded-lg p-4 bg-white shadow-sm">
              <h2 className="text-2xl font-semibold mb-3">{day}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">Lunch</h3>
                  <p className="text-gray-700">
                    {plan[day]?.lunch || <span className="italic text-gray-400">No meal</span>}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Dinner</h3>
                  <p className="text-gray-700">
                    {plan[day]?.dinner || <span className="italic text-gray-400">No meal</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}