"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Entry = {
  id: string
  name: string
}

export default function Step4() {
  const router = useRouter()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [meals, setMeals] = useState<Entry[]>([])
  const [foods, setFoods] = useState<Entry[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  // -----------------------------
  // Load household + onboarding state
  // -----------------------------
  useEffect(() => {
    async function loadHousehold() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        router.push("/login")
        return
      }

      // Household link
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) {
        router.push("/onboarding/step-1")
        return
      }

      const householdId = link.household_id
      setHouseholdId(householdId)

      // Load settings
      const { data: settings } = await supabase
        .from("household_settings")
        .select("onboarding_step")
        .eq("household_id", householdId)
        .single()

      if (!settings) {
        router.push("/onboarding/step-1")
        return
      }

      // Resume forward
      if (settings.onboarding_step > 4) {
        router.push(`/onboarding/step-${settings.onboarding_step}`)
        return
      }

      setLoading(false)
    }

    loadHousehold()
  }, [router])

  // -----------------------------
  // Dynamic list handlers
  // -----------------------------
  function addMeal() {
    setMeals((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])
  }

  function addFood() {
    setFoods((prev) => [...prev, { id: crypto.randomUUID(), name: "" }])
  }

  function updateMeal(id: string, value: string) {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, name: value } : m)))
  }

  function updateFood(id: string, value: string) {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, name: value } : f)))
  }

  // -----------------------------
  // Continue → Save meals & foods
  // -----------------------------
  async function next() {
    if (!householdId) return

    const allItems = [
      ...meals.filter((m) => m.name.trim().length > 0),
      ...foods.filter((f) => f.name.trim().length > 0),
    ]

    if (allItems.length < 3) {
      setError("Please add at least 3 meals or foods before continuing.")
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    if (!user) return

    // Insert Meals
    for (const item of meals) {
      if (!item.name.trim()) continue

      const { data: newMeal, error } = await supabase
        .from("meals")
        .insert({
          name: item.name.trim(),
          type: "meal",
          created_by: user.id,
        })
        .select()
        .single()

      if (newMeal) {
        await supabase
          .from("household_meals")
          .insert({
            household_id: householdId,
            meal_id: newMeal.id,
            rating: "green",
          })
      }

      if (error) console.error(error)
    }

    // Insert Foods
    for (const item of foods) {
      if (!item.name.trim()) continue

      const { data: newFood, error } = await supabase
        .from("meals")
        .insert({
          name: item.name.trim(),
          type: "food",
          created_by: user.id,
        })
        .select()
        .single()

      if (newFood) {
        await supabase
          .from("household_meals")
          .insert({
            household_id: householdId,
            meal_id: newFood.id,
            rating: "green",
          })
      }

      if (error) console.error(error)
    }

    // Update onboarding progress
    await supabase
      .from("household_settings")
      .update({ onboarding_step: 5 })
      .eq("household_id", householdId)

    router.push("/onboarding/complete")
  }

  // -----------------------------
  // Prevent rendering before ready
  // -----------------------------
  if (loading) {
    return (
      <div className="pt-20 text-center">
        <h1 className="text-2xl font-semibold">Loading…</h1>
      </div>
    )
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="space-y-10 pt-10">
      <h1 className="text-4xl font-semibold">Tell us what your children always eat</h1>
      <p className="text-gray-600">
        Add reliable meals and foods. This builds your Green List.
      </p>

      <div className="w-full max-w-xl mx-auto space-y-12">

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Meals your children reliably eat</h2>
          {meals.map((m) => (
            <Input
              key={m.id}
              placeholder="Enter a meal"
              value={m.name}
              onChange={(e) => updateMeal(m.id, e.target.value)}
              className="mt-2"
            />
          ))}
          <Button variant="outline" onClick={addMeal}>
            + Add Meal
          </Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Foods your children reliably eat</h2>
          {foods.map((f) => (
            <Input
              key={f.id}
              placeholder="Enter a food"
              value={f.name}
              onChange={(e) => updateFood(f.id, e.target.value)}
              className="mt-2"
            />
          ))}
          <Button variant="outline" onClick={addFood}>
            + Add Food
          </Button>
        </section>

        {error && <p className="text-red-500 font-medium">{error}</p>}

        <Button onClick={next} className="w-full text-lg py-6">
          Continue →
        </Button>
      </div>
    </div>
  )
}
