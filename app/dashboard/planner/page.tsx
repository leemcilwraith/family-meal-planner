"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

type PlannerSlot = {
  id?: string
  name: string
  mealId?: string
}

type DayPlan = {
  lunch: PlannerSlot | null
  dinner: PlannerSlot | null
}

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function PlannerPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)

  // This will eventually be filled by AI. For now default empty.
  const [plan, setPlan] = useState<Record<string, DayPlan>>(() => {
    const empty: Record<string, DayPlan> = {}
    days.forEach((day) => {
      empty[day] = { lunch: null, dinner: null }
    })
    return empty
  })

  const [allMeals, setAllMeals] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------------
  // Load household + load meals user can pick from
  // -------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user) return

      // Household
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) return
      setHouseholdId(link.household_id)

      // Fetch meals (ONLY meals, not foods)
      const { data: ratings } = await supabase
        .from("household_meals")
        .select("meals(*)")

      const meals =
        ratings
          ?.filter((r) => r.meals?.type === "meal")
          .map((r) => ({
            id: r.meals!.id,
            name: r.meals!.name,
          })) ?? []

      setAllMeals(meals)
      setLoading(false)
    }

    load()
  }, [])

  // -------------------------------------------------------------
  // Update a slot’s meal
  // -------------------------------------------------------------
  function updateSlot(day: string, slot: "lunch" | "dinner", mealId: string) {
    const meal = allMeals.find((m) => m.id === mealId)
    if (!meal) return

    setPlan((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [slot]: {
          id: meal.id,
          name: meal.name,
        },
      },
    }))
  }

  // -------------------------------------------------------------
  // Replace a slot with an empty value
  // -------------------------------------------------------------
  function clearSlot(day: string, slot: "lunch" | "dinner") {
    setPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], [slot]: null },
    }))
  }

  // -------------------------------------------------------------
  // UI RENDER
  // -------------------------------------------------------------
  if (loading) return <p>Loading planner…</p>

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Weekly Meal Planner</h1>

      <div className="grid grid-cols-3 gap-6">
        <div></div>
        <div className="text-center font-semibold">Lunch</div>
        <div className="text-center font-semibold">Dinner</div>

        {days.map((day) => (
          <div key={day} className="contents">
            {/* Day label */}
            <div className="font-bold text-lg">{day}</div>

            {/* Lunch slot */}
            <div className="space-y-2">
              <Select
                value={plan[day].lunch?.id || ""}
                onValueChange={(v) => updateSlot(day, "lunch", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meal" />
                </SelectTrigger>
                <SelectContent>
                  {allMeals.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {plan[day].lunch && (
                <Button variant="outline" onClick={() => clearSlot(day, "lunch")}>
                  Clear
                </Button>
              )}
            </div>

            {/* Dinner slot */}
            <div className="space-y-2">
              <Select
                value={plan[day].dinner?.id || ""}
                onValueChange={(v) => updateSlot(day, "dinner", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meal" />
                </SelectTrigger>
                <SelectContent>
                  {allMeals.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {plan[day].dinner && (
                <Button variant="outline" onClick={() => clearSlot(day, "dinner")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Button className="text-lg px-8 py-4">Save Plan</Button>
      </div>
    </div>
  )
}
