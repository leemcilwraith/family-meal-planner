"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

/* ---------------------------------------
   CONSTANTS & TYPES
----------------------------------------*/
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

type Day = (typeof DAYS)[number]

type DayConfig = {
  lunch: boolean
  dinner: boolean
}

type DayConfigMap = Record<Day, DayConfig>

type MealSlot = {
  lunch?: string
  dinner?: string
}

type WeeklyPlan = Record<Day, MealSlot>

type FavouriteMeal = {
  id: string
  name: string
}

/* ---------------------------------------
   HELPERS
----------------------------------------*/
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

/* ---------------------------------------
   COMPONENT
----------------------------------------*/
export default function PlannerPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(true)

  // Generation-only config
  const [dayConfig, setDayConfig] = useState<DayConfigMap>(() =>
    Object.fromEntries(
      DAYS.map((d) => [d, { lunch: true, dinner: true }])
    ) as DayConfigMap
  )

  // Persisted plan
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState("")

  /* ---------------------------------------
     LOAD HOUSEHOLD, FAVOURITES, LATEST PLAN
  ----------------------------------------*/
  useEffect(() => {
    let active = true

    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || !active) {
        setLoadingHousehold(false)
        return
      }

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id || !active) {
        setLoadingHousehold(false)
        return
      }

      const hid = link.household_id
      setHouseholdId(hid)

      // Load favourites
      const { data: favRows } = await supabase
        .from("household_meals")
        .select("meals(id, name)")
        .eq("household_id", hid)
        .eq("is_favourite", true)
        .eq("meals.type", "meal")

      if (favRows && active) {
        setFavourites(
          favRows.map((r: any) => r.meals).filter(Boolean)
        )
      }

      // Load latest plan
      const { data: planRow } = await supabase
        .from("weekly_plans")
        .select("plan_json")
        .eq("household_id", hid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (planRow?.plan_json && active) {
        setPlan(planRow.plan_json as WeeklyPlan)
      }

      setLoadingHousehold(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  /* ---------------------------------------
     GENERATION HELPERS
  ----------------------------------------*/
  function toggleMeal(day: Day, meal: "lunch" | "dinner") {
    setDayConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] },
    }))
  }

  function selectAll() {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((d) => [d, { lunch: true, dinner: true }])
      ) as DayConfigMap
    )
  }

  function clearAll() {
    setDayConfig(
      Object.fromEntries(
        DAYS.map((d) => [d, { lunch: false, dinner: false }])
      ) as DayConfigMap
    )
  }

  function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

async function savePlan(plan: WeeklyPlan) {
  if (!householdId) return

  const weekStart = getWeekStart()

  const { error } = await supabase
    .from("weekly_plans")
    .upsert(
      {
        household_id: householdId,
        week_start: weekStart,
        plan_json: plan,
      },
      {
        onConflict: "household_id,week_start",
      }
    )

  if (error) {
    console.error("❌ Failed to save plan:", error)
  }
}

  function swapMeal(day: Day, mealType: "lunch" | "dinner", newMeal: string) {
    if (!plan || !newMeal) return

    const updated: WeeklyPlan = {
      ...plan,
      [day]: { ...plan[day], [mealType]: newMeal },
    }

    setPlan(updated)
    savePlan(updated)
  }

  async function reshuffleMeal(
    day: Day,
    mealType: "lunch" | "dinner",
    currentMeal?: string
  ) {
    if (!householdId || !currentMeal || !plan) return

    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        householdId,
        mode: "slot",
        day,
        mealType,
        existingMeal: currentMeal,
      }),
    })

    const data = await res.json()
    if (!res.ok || !data.meal) return

    swapMeal(day, mealType, data.meal)
  }

  /* ---------------------------------------
     GENERATE PLAN
  ----------------------------------------*/
  async function generatePlan() {
    if (!householdId) {
      setError("Household not ready yet.")
      return
    }

    if (!DAYS.some((d) => dayConfig[d].lunch || dayConfig[d].dinner)) {
      setError("Please select at least one meal.")
      return
    }

    setLoadingPlan(true)
    setError("")
    setPlan(null)

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

    setPlan(data.plan as WeeklyPlan)
    await savePlan(data.plan)

    setLoadingPlan(false)
  }

  /* ---------------------------------------
     UI
  ----------------------------------------*/
  if (loadingHousehold) return <p className="p-10">Loading planner…</p>

  if (!householdId) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold">No household found</h1>
        <p>Please complete onboarding first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-6">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* Generation controls */}
      <div className="border rounded-lg p-6 bg-white shadow space-y-4">
        <div className="grid grid-cols-3 font-semibold gap-4">
          <div>Day</div>
          <div>Lunch</div>
          <div>Dinner</div>
        </div>

        {DAYS.map((day) => (
          <div key={day} className="grid grid-cols-3 gap-4 items-center">
            <div>{day}</div>

            <Checkbox
              checked={dayConfig[day].lunch}
              disabled={!!plan}
              onCheckedChange={() => toggleMeal(day, "lunch")}
            />

            <Checkbox
              checked={dayConfig[day].dinner}
              disabled={!!plan}
              onCheckedChange={() => toggleMeal(day, "dinner")}
            />
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={selectAll} disabled={!!plan}>
            Select All
          </Button>
          <Button variant="outline" onClick={clearAll} disabled={!!plan}>
            Clear All
          </Button>
        </div>
      </div>

      <Button onClick={generatePlan} disabled={loadingPlan || !!plan}>
        {loadingPlan ? "Generating…" : "Generate Plan"}
      </Button>

      {plan && (
        <Button variant="outline" onClick={() => setPlan(null)}>
          Start over
        </Button>
      )}

      {error && <p className="text-red-500">{error}</p>}

      {/* Render Plan (source of truth) */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const dayPlan = plan[day]
            if (!dayPlan) return null

            return (
              <div key={day} className="border p-4 rounded bg-white shadow">
                <h3 className="text-xl font-semibold mb-3">{day}</h3>

                {dayPlan.lunch && (
                  <div className="mb-4">
                    <p className="font-semibold">Lunch</p>
                    <p>{dayPlan.lunch}</p>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reshuffleMeal(day, "lunch", dayPlan.lunch)
                      }
                    >
                      🔄 Re-shuffle
                    </Button>

                    {favourites.length > 0 && (
                      <select
                        className="ml-2 border rounded px-2 py-1"
                        onChange={(e) =>
                          swapMeal(day, "lunch", e.target.value)
                        }
                        defaultValue=""
                      >
                        <option value="">Swap for favourite…</option>
                        {favourites.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {dayPlan.dinner && (
                  <div>
                    <p className="font-semibold">Dinner</p>
                    <p>{dayPlan.dinner}</p>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reshuffleMeal(day, "dinner", dayPlan.dinner)
                      }
                    >
                      🔄 Re-shuffle
                    </Button>

                    {favourites.length > 0 && (
                      <select
                        className="ml-2 border rounded px-2 py-1"
                        onChange={(e) =>
                          swapMeal(day, "dinner", e.target.value)
                        }
                        defaultValue=""
                      >
                        <option value="">Swap for favourite…</option>
                        {favourites.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
