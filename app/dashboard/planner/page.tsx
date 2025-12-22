"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

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

function addDays(isoDate: string, days: number) {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return getWeekStart(d)
}

function getPreviousWeek(weekStart: string) {
  return addDays(weekStart, -7)
}

/* ---------------------------------------
   COMPONENT
----------------------------------------*/
export default function PlannerPage() {
  const [activeWeek, setActiveWeek] = useState<string>(() => getWeekStart())

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loadingHousehold, setLoadingHousehold] = useState(true)

  // Generation-only config (used only when creating a new plan)
  const [dayConfig, setDayConfig] = useState<DayConfigMap>(() =>
    Object.fromEntries(DAYS.map((d) => [d, { lunch: true, dinner: true }])) as DayConfigMap
  )

  // Persisted plan for the activeWeek
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [error, setError] = useState("")

  const isCurrentWeek = useMemo(() => activeWeek === getWeekStart(), [activeWeek])
  const hasPlan = !!plan

  // Generation controls should be editable only if we are on current week and no plan exists yet
  const generationLocked = !isCurrentWeek || hasPlan

  /* ---------------------------------------
     LOAD HOUSEHOLD + FAVOURITES + PLAN (for activeWeek)
  ----------------------------------------*/
  useEffect(() => {
    let mounted = true

    async function load() {
      setError("")

      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || !mounted) {
        setLoadingHousehold(false)
        return
      }

      const { data: link, error: linkErr } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (linkErr) console.error("Failed to load user_households:", linkErr)

      if (!link?.household_id || !mounted) {
        setLoadingHousehold(false)
        return
      }

      const hid = link.household_id
      setHouseholdId(hid)

      // favourites (for swap dropdown)
      const { data: favRows, error: favErr } = await supabase
        .from("household_meals")
        .select("meals(id, name)")
        .eq("household_id", hid)
        .eq("is_favourite", true)
        .eq("meals.type", "meal")

      if (favErr) console.error("Failed to load favourites:", favErr)

      if (favRows && mounted) {
        setFavourites(
          (favRows as any[])
            .map((r) => r.meals)
            .filter(Boolean)
            .map((m) => ({ id: m.id as string, name: m.name as string }))
        )
      }

      // plan for active week
      const { data: planRow, error: planErr } = await supabase
        .from("weekly_plans")
        .select("plan_json")
        .eq("household_id", hid)
        .eq("week_start", activeWeek)
        .maybeSingle()

      if (planErr) console.error("Failed to load weekly_plan:", planErr)

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
     DB SAVE/DELETE HELPERS
  ----------------------------------------*/
  async function savePlan(nextPlan: WeeklyPlan) {
    if (!householdId) return

    const { error: upsertErr } = await supabase
      .from("weekly_plans")
      .upsert(
        {
          household_id: householdId,
          week_start: activeWeek,
          plan_json: nextPlan,
        },
        { onConflict: "household_id,week_start" }
      )

    if (upsertErr) {
      console.error("❌ Failed to save plan:", upsertErr)
      setError("Failed to save plan")
    }
  }

  async function deletePlanForWeek() {
    if (!householdId) return

    const { error: delErr } = await supabase
      .from("weekly_plans")
      .delete()
      .eq("household_id", householdId)
      .eq("week_start", activeWeek)

    if (delErr) {
      console.error("❌ Failed to delete plan:", delErr)
      setError("Failed to delete plan")
      return
    }

    setPlan(null)
  }

  /* ---------------------------------------
     GENERATION UI HELPERS
  ----------------------------------------*/
  function toggleMeal(day: Day, meal: "lunch" | "dinner") {
    if (generationLocked) return

    setDayConfig((prev) => ({
      ...prev,
      [day]: { ...prev[day], [meal]: !prev[day][meal] },
    }))
  }

  function selectAll() {
    if (generationLocked) return
    setDayConfig(Object.fromEntries(DAYS.map((d) => [d, { lunch: true, dinner: true }])) as DayConfigMap)
  }

  function clearAll() {
    if (generationLocked) return
    setDayConfig(Object.fromEntries(DAYS.map((d) => [d, { lunch: false, dinner: false }])) as DayConfigMap)
  }

  /* ---------------------------------------
     PLAN EDIT HELPERS (current week only)
  ----------------------------------------*/
  function swapMeal(day: Day, mealType: "lunch" | "dinner", newMeal: string) {
    if (!isCurrentWeek || !plan || !newMeal) return

    const updated: WeeklyPlan = {
      ...plan,
      [day]: { ...plan[day], [mealType]: newMeal },
    }

    setPlan(updated)
    savePlan(updated)
  }

  async function reshuffleMeal(day: Day, mealType: "lunch" | "dinner", currentMeal?: string) {
    if (!householdId || !isCurrentWeek || !plan || !currentMeal) return

    try {
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

      if (!res.ok || !data.meal) {
        console.error("Reshuffle failed:", data)
        setError(data?.error || "Reshuffle failed")
        return
      }

      swapMeal(day, mealType, data.meal)
    } catch (e) {
      console.error("Reshuffle error:", e)
      setError("Network error reshuffling meal")
    }
  }

  /* ---------------------------------------
     GENERATE PLAN
  ----------------------------------------*/
  async function generatePlan() {
    if (!householdId) return

    if (!isCurrentWeek) {
      setError("You can only generate plans for the current week.")
      return
    }

    if (hasPlan) {
      setError("This week already has a plan. Use Start over if you want to regenerate.")
      return
    }

    const hasAnySelection = DAYS.some((d) => dayConfig[d].lunch || dayConfig[d].dinner)
    if (!hasAnySelection) {
      setError("Please select at least one meal.")
      return
    }

    setLoadingPlan(true)
    setError("")

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
        return
      }

      const nextPlan = data.plan as WeeklyPlan
      setPlan(nextPlan)
      await savePlan(nextPlan)
    } catch (e) {
      console.error("Generate error:", e)
      setError("Network error while generating plan")
    } finally {
      setLoadingPlan(false)
    }
  }

  async function copyLastWeek() {
    if (!householdId) return

    if (!isCurrentWeek) {
      setError("You can only copy into the current week.")
      return
    }

    if (hasPlan) {
      setError("This week already has a plan. Use Start over first if you want to replace it.")
      return
    }

    const previousWeek = getPreviousWeek(activeWeek)

    const { data, error: loadErr } = await supabase
      .from("weekly_plans")
      .select("plan_json")
      .eq("household_id", householdId)
      .eq("week_start", previousWeek)
      .maybeSingle()

    if (loadErr) {
      console.error("Failed to load last week's plan:", loadErr)
      setError("Failed to load last week's plan")
      return
    }

    if (!data?.plan_json) {
      setError("No plan found for last week")
      return
    }

    const copiedPlan = data.plan_json as WeeklyPlan
    setPlan(copiedPlan)
    await savePlan(copiedPlan)
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
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <h1 className="text-4xl font-semibold">Weekly Meal Planner</h1>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded shadow">
        <Button variant="outline" onClick={() => setActiveWeek(addDays(activeWeek, -7))}>
          ← Previous Week
        </Button>

        <div className="font-semibold">
          Week starting {new Date(activeWeek).toLocaleDateString()}
          {!isCurrentWeek && <span className="ml-2 text-sm text-gray-500">(Read only)</span>}
        </div>

        <Button variant="outline" onClick={() => setActiveWeek(addDays(activeWeek, 7))}>
          Next Week →
        </Button>
      </div>

      {/* Generation controls */}
      <div className="border rounded-lg p-6 bg-white shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Select meals to generate</h2>
          {generationLocked && (
            <span className="text-sm text-gray-500">
              {hasPlan ? "Plan exists for this week" : "Read-only week"}
            </span>
          )}
        </div>

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
              disabled={generationLocked}
              onCheckedChange={() => toggleMeal(day, "lunch")}
            />

            <Checkbox
              checked={dayConfig[day].dinner}
              disabled={generationLocked}
              onCheckedChange={() => toggleMeal(day, "dinner")}
            />
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={selectAll} disabled={generationLocked}>
            Select All
          </Button>
          <Button variant="outline" onClick={clearAll} disabled={generationLocked}>
            Clear All
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button onClick={generatePlan} disabled={loadingPlan || !isCurrentWeek || hasPlan}>
          {loadingPlan ? "Generating…" : "Generate Plan"}
        </Button>

        <Button variant="outline" onClick={copyLastWeek} disabled={!isCurrentWeek || hasPlan}>
          Copy Last Week
        </Button>

        {plan && (
          <Button variant="destructive" onClick={deletePlanForWeek} disabled={!isCurrentWeek}>
            Start over
          </Button>
        )}
      </div>

      {error && <p className="text-red-500">{error}</p>}

      {/* Render Plan */}
      {plan && (
        <div className="space-y-6">
          {DAYS.map((day) => {
            const dayPlan = plan[day]
            if (!dayPlan) return null

            const showLunch = typeof dayPlan.lunch === "string"
            const showDinner = typeof dayPlan.dinner === "string"
            if (!showLunch && !showDinner) return null

            return (
              <div key={day} className="border p-4 rounded bg-white shadow">
                <h3 className="text-xl font-semibold mb-3">{day}</h3>

                {showLunch && (
                  <div className="mb-4 space-y-2">
                    <p className="font-semibold">Lunch</p>
                    <p>{dayPlan.lunch}</p>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isCurrentWeek}
                        onClick={() => reshuffleMeal(day, "lunch", dayPlan.lunch)}
                      >
                        🔄 Re-shuffle
                      </Button>

                      {favourites.length > 0 && (
                        <select
                          className="text-sm border rounded px-2 py-1"
                          disabled={!isCurrentWeek}
                          onChange={(e) => swapMeal(day, "lunch", e.target.value)}
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
                  </div>
                )}

                {showDinner && (
                  <div className="space-y-2">
                    <p className="font-semibold">Dinner</p>
                    <p>{dayPlan.dinner}</p>

                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!isCurrentWeek}
                        onClick={() => reshuffleMeal(day, "dinner", dayPlan.dinner)}
                      >
                        🔄 Re-shuffle
                      </Button>

                      {favourites.length > 0 && (
                        <select
                          className="text-sm border rounded px-2 py-1"
                          disabled={!isCurrentWeek}
                          onChange={(e) => swapMeal(day, "dinner", e.target.value)}
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
