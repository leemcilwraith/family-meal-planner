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
   DATE HELPERS
----------------------------------------*/
function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

/* ---------------------------------------
   COMPONENT
----------------------------------------*/
export default function PlannerPage() {
  const [activeWeek, setActiveWeek] = useState<string>(getWeekStart())
  const isCurrentWeek = activeWeek === getWeekStart()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(true)

  const [dayConfig, setDayConfig] = useState<DayConfigMap>(() =>
    Object.fromEntries(
      DAYS.map((d) => [d, { lunch: true, dinner: true }])
    ) as DayConfigMap
  )

  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState("")

  /* ---------------------------------------
     LOAD HOUSEHOLD, FAVOURITES, PLAN
  ----------------------------------------*/
  useEffect(() => {
    let mounted = true

    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || !mounted) {
        setLoadingHousehold(false)
        return
      }

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id || !mounted) {
        setLoadingHousehold(false)
        return
      }

      const hid = link.household_id
      setHouseholdId(hid)

      // Favourites
      const { data: favRows } = await supabase
        .from("household_meals")
        .select("meals(id, name)")
        .eq("household_id", hid)
        .eq("is_favourite", true)
        .eq("meals.type", "meal")

      if (favRows && mounted) {
        setFavourites(
          favRows.map((r: any) => r.meals).filter(Boolean)
        )
      }

      // Plan for active week
      const { data: planRow } = await supabase
        .from("weekly_plans")
        .select("plan_json")
        .eq("household_id", hid)
        .eq("week_start", activeWeek)
        .maybeSingle()

      if (planRow?.plan_json && mounted) {
        setPlan(planRow.plan_json as WeeklyPlan)
      } else {
        setPlan(null)
      }

      setLoadingHousehold(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [activeWeek])

  /* ---------------------------------------
     SAVE PLAN
  ----------------------------------------*/
  async function savePlan(plan: WeeklyPlan) {
    if (!householdId) return

    await supabase
      .from("weekly_plans")
      .upsert(
        {
          household_id: householdId,
          week_start: activeWeek,
          plan_json: plan,
        },
        { onConflict: "household_id,week_start" }
      )
  }

  /* ---------------------------------------
     GENERATION HELPERS
  ----------------------------------------*/
  function toggleMeal(day: Day, meal: "lunch" | "dinner") {
    if (!isCurrentWeek || plan) return

    setDayConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] },
    }))
  }

  function selectAll() {
    if (!isCurrentWeek || plan) return
    setDayConfig(
      Object.fromEntries(
        DAYS.map((d) => [d, { lunch: true, dinner: true }])
      ) as DayConfigMap
    )
  }

  function clearAll() {
    if (!isCurrentWeek || plan) return
    setDayConfig(
      Object.fromEntries(
        DAYS.map((d) => [d, { lunch: false, dinner: false }])
      ) as DayConfigMap
    )
  }

  function swapMeal(day: Day, mealType: "lunch" | "dinner", newMeal: string) {
    if (!plan || !newMeal || !isCurrentWeek) return

    const updated = {
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
    if (!householdId || !currentMeal || !plan || !isCurrentWeek) return

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
    if (!householdId || !isCurrentWeek) return

    if (!DAYS.some((d) => dayConfig[d].lunch || dayConfig[d].dinner)) {
      setError("Please select at least one meal.")
      return
    }

    setLoadingPlan(true)
    setError("")

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

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-6">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded shadow">
        <Button
          variant="outline"
          onClick={() =>
            setActiveWeek(
              getWeekStart(
                new Date(new Date(activeWeek).setDate(new Date(activeWeek).getDate() - 7))
              )
            )
          }
        >
          ← Previous Week
        </Button>

        <div className="font-semibold">
          Week starting {new Date(activeWeek).toLocaleDateString()}
          {!isCurrentWeek && (
            <span className="ml-2 text-sm text-gray-500">(Read only)</span>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() =>
            setActiveWeek(
              getWeekStart(
                new Date(new Date(activeWeek).setDate(new Date(activeWeek).getDate() + 7))
              )
            )
          }
        >
          Next Week →
        </Button>
      </div>

      {/* Generate */}
      <Button onClick={generatePlan} disabled={!isCurrentWeek || loadingPlan}>
        Generate Plan
      </Button>

      {error && <p className="text-red-500">{error}</p>}

      {/* Render Plan */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const dayPlan = plan[day]
            if (!dayPlan) return null

            return (
              <div key={day} className="border p-4 rounded bg-white shadow">
                <h3 className="text-xl font-semibold mb-3">{day}</h3>

                {dayPlan.lunch && (
                  <p><strong>Lunch:</strong> {dayPlan.lunch}</p>
                )}

                {dayPlan.dinner && (
                  <p><strong>Dinner:</strong> {dayPlan.dinner}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
