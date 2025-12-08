"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

export default function RatingsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [green, setGreen] = useState<any[]>([])
  const [neutral, setNeutral] = useState<any[]>([])
  const [red, setRed] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // ------------------------------------------------------
  // Load household + meals with ratings
  // ------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      // Get household ID
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) return
      setHouseholdId(link.household_id)

      // Get all meals & foods + rating
      const { data: items } = await supabase
        .from("household_meals")
        .select("rating, meals(*)")
        .eq("household_id", link.household_id)

      // Group by rating
      setGreen(items?.filter((i) => i.rating === "green").map((i) => i.meals) || [])
      setNeutral(items?.filter((i) => i.rating === "neutral").map((i) => i.meals) || [])
      setRed(items?.filter((i) => i.rating === "red").map((i) => i.meals) || [])

      setLoading(false)
    }

    load()
  }, [])

  // ------------------------------------------------------
  // Update rating
  // ------------------------------------------------------
  async function updateRating(mealId: string, newRating: string) {
    if (!householdId) return

    await supabase
      .from("household_meals")
      .update({ rating: newRating })
      .eq("household_id", householdId)
      .eq("meal_id", mealId)

    // Refresh groups locally
    setGreen((list) => list.filter((x) => x.id !== mealId))
    setNeutral((list) => list.filter((x) => x.id !== mealId))
    setRed((list) => list.filter((x) => x.id !== mealId))

    const meal = [...green, ...neutral, ...red].find((x) => x.id === mealId)
    if (!meal) return

    if (newRating === "green") setGreen((g) => [...g, meal])
    if (newRating === "neutral") setNeutral((n) => [...n, meal])
    if (newRating === "red") setRed((r) => [...r, meal])
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="space-y-10">
      <h1 className="text-4xl font-bold">Green & Red Lists</h1>
      <p className="text-gray-600">Review and adjust your children's preferences.</p>

      {/* ---------------------- GREEN LIST ---------------------- */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">🍏 Green List</h2>
        <p className="text-sm text-gray-500 mb-4">
          Meals and foods your children always eat. These are used heavily in conservative planning.
        </p>

        {green.length === 0 && <p className="text-gray-500">No green items yet.</p>}

        <div className="space-y-3">
          {green.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white p-4 rounded shadow"
            >
              <div>{item.name}</div>

              <Select value="green" onValueChange={(v) => updateRating(item.id, v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------- NEUTRAL LIST ---------------------- */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">🟡 Neutral</h2>
        <p className="text-sm text-gray-500 mb-4">
          Neither loved nor hated. AI uses these when your risk slider is higher.
        </p>

        {neutral.length === 0 && <p className="text-gray-500">No neutral items.</p>}

        <div className="space-y-3">
          {neutral.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white p-4 rounded shadow"
            >
              <div>{item.name}</div>

              <Select value="neutral" onValueChange={(v) => updateRating(item.id, v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------- RED LIST ---------------------- */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">🔴 Red List</h2>
        <p className="text-sm text-gray-500 mb-4">
          Meals and foods your kids reject. AI avoids these entirely.
        </p>

        {red.length === 0 && <p className="text-gray-500">No red items.</p>}

        <div className="space-y-3">
          {red.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white p-4 rounded shadow"
            >
              <div>{item.name}</div>

              <Select value="red" onValueChange={(v) => updateRating(item.id, v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
