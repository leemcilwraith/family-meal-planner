"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

type DayPlan = {
  lunch: string | null
  dinner: string | null
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function PlannerPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [availableMeals, setAvailableMeals] = useState<any[]>([])
  const [plan, setPlan] = useState<Record<string, DayPlan>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // ------------------------------------------------------
  // Load household + meals + any existing weekly plan
  // ------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      // Find household
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) return
      setHouseholdId(link.household_id)

      // Load meals (green + neutral only)
      const { data: items } = await supabase
        .from("household_meals")
        .select("rating, meals(*)")
        .eq("household_id", link.household_id)

      const allowed = items
        ?.filter((i) => i.rating === "green" || i.rating === "neutral")
        .map((i) => ({ ...i.meals }))

      setAvailableMeals(allowed || [])

      // Load an existing weekly plan for the current week
      const today = new Date()
      const monday = new Date(today)
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // ensure Monday start

      const { data: planRow } = await supabase
        .from("weekly_plans")
        .select("*")
        .eq("household_id", link.household_id)
        .eq("week_start", monday.toISOString().split("T")[0])
        .maybeSingle()

      if (planRow?.plan_json) {
        setPlan(planRow.plan_json)
      } else {
        // Default empty plan
        const blank: Record<string, DayPlan> = {}
        DAYS.forEach((d) => {
          blank[d] = { lunch: null, dinner: null }
        })
        setPlan(blank)
      }

      setLoading(false)
    }

    load()
  }, [])

  // ------------------------------------------------------
  // Update meal for a specific day + time
  // ------------------------------------------------------
  function updateSlot(day: string, slot: "lunch" | "dinner", value: string | null) {
    setPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], [slot]: value },
    }))
  }

  // ------------------------------------------------------
  // Save the weekly plan
  // ------------------------------------------------------
  async function savePlan() {
    if (!householdId) return
    setSaving(true)

    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // Monday

    await supabase
      .from("weekly_plans")
      .upsert({
        household_id: householdId,
        week_start: monday.toISOString().split("T")[0],
        plan_json: plan,
      })

    setSaving(false)
    alert("Weekly plan saved!")
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Weekly Meal Planner</h1>
      <p className="text-gray-600">Select meals for lunch and dinner each day.</p>

      {/* ---------------------- Planner Grid ---------------------- */}
      <div className="grid grid-cols-3 gap-4 font-medium mb-4">
        <div>Day</div>
        <div>Lunch</div>
        <div>Dinner</div>
      </div>

      {DAYS.map((day) => (
        <div key={day} className="grid grid-cols-3 gap-4 items-center mb-4 bg-white p-4 rounded shadow">
          <div className="font-semibold">{day}</div>

          {/* Lunch selector */}
          <Select
            value={plan[day]?.lunch ?? ""}
            onValueChange={(v) => updateSlot(day, "lunch", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose lunch…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {availableMeals.map((m) => (
                <SelectItem key={m.id} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Dinner selector */}
          <Select
            value={plan[day]?.dinner ?? ""}
            onValueChange={(v) => updateSlot(day, "dinner", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose dinner…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {availableMeals.map((m) => (
                <SelectItem key={m.id} value={m.name}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      {/* ---------------------- Actions ---------------------- */}
      <div className="flex gap-4 mt-10">
        <Button onClick={savePlan} disabled={saving}>
          {saving ? "Saving..." : "Save Weekly Plan"}
        </Button>

        <Button variant="outline" onClick={() => alert("AI not added yet!")}>
          Generate with AI (coming soon)
        </Button>
      </div>
    </div>
  )
}
