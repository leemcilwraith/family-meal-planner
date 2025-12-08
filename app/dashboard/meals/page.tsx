"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

// -------------------------------
// FIX: Explicit Supabase typing
// -------------------------------
type MealRecord = {
  id: string
  name: string
  type: "meal" | "food"
  created_by?: string | null
}

type HouseholdMeal = {
  rating: string
  meals: MealRecord | null    // ← CRITICAL FIX
}

export default function MealsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [meals, setMeals] = useState<MealRecord[]>([])
  const [foods, setFoods] = useState<MealRecord[]>([])
  const [newMeal, setNewMeal] = useState("")
  const [newFood, setNewFood] = useState("")
  const [loading, setLoading] = useState(true)

  // ---------------------------------------
  // Load household + all meals/foods
  // ---------------------------------------
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) return
      setHouseholdId(link.household_id)

      // ---------------------------
      // FIX: Use typed Supabase call
      // ---------------------------
      const { data: rows, error } = await supabase
        .from("household_meals")
        .select("rating, meals(*)") as unknown as {
        data: HouseholdMeal[] | null
        error: any
      }

      if (error) console.error(error)

      const ratings = rows ?? []

      const mealList = ratings
        .filter((entry) => entry.meals?.type === "meal")
        .map((entry) => ({
          ...entry.meals!,
          rating: entry.rating,
        }))

      const foodList = ratings
        .filter((entry) => entry.meals?.type === "food")
        .map((entry) => ({
          ...entry.meals!,
          rating: entry.rating,
        }))

      setMeals(mealList)
      setFoods(foodList)
      setLoading(false)
    }

    load()
  }, [])

  // ---------------------------------------
  // Add Meal / Food
  // ---------------------------------------
  async function addItem(type: "meal" | "food") {
    if (!householdId) return

    const name = type === "meal" ? newMeal.trim() : newFood.trim()
    if (!name) return

    const { data: created, error } = await supabase
      .from("meals")
      .insert({
        name,
        type,
      })
      .select()
      .single()

    if (error || !created) {
      console.error(error)
      return
    }

    await supabase.from("household_meals").insert({
      household_id: householdId,
      meal_id: created.id,
      rating: "green",
    })

    if (type === "meal") {
      setMeals((m) => [...m, { ...created, rating: "green" }])
      setNewMeal("")
    } else {
      setFoods((f) => [...f, { ...created, rating: "green" }])
      setNewFood("")
    }
  }

  // ---------------------------------------
  // Update Rating
  // ---------------------------------------
  async function updateRating(mealId: string, rating: string) {
    if (!householdId) return

    await supabase
      .from("household_meals")
      .update({ rating })
      .eq("household_id", householdId)
      .eq("meal_id", mealId)

    setMeals((m) => m.map((x) => (x.id === mealId ? { ...x, rating } : x)))
    setFoods((f) => f.map((x) => (x.id === mealId ? { ...x, rating } : x)))
  }

  // ---------------------------------------
  // Delete Item
  // ---------------------------------------
  async function deleteItem(mealId: string) {
    if (!householdId) return

    await supabase.from("household_meals").delete().eq("meal_id", mealId)
    await supabase.from("meals").delete().eq("id", mealId)

    setMeals((m) => m.filter((x) => x.id !== mealId))
    setFoods((f) => f.filter((x) => x.id !== mealId))
  }

  if (loading) return <p>Loading…</p>

  // ---------------------------------------
  // UI
  // ---------------------------------------
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Meals & Foods</h1>

      <Tabs defaultValue="meals">
        <TabsList className="mb-6">
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="foods">Foods</TabsTrigger>
        </TabsList>

        {/* Meals Tab */}
        <TabsContent value="meals">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Input
                placeholder="Add a meal…"
                value={newMeal}
                onChange={(e) => setNewMeal(e.target.value)}
              />
              <Button onClick={() => addItem("meal")}>Add</Button>
            </div>

            {meals.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded shadow">
                <div className="font-medium">{item.name}</div>

                <div className="flex items-center gap-4">
                  <Select value={item.rating} onValueChange={(v) => updateRating(item.id, v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="destructive" onClick={() => deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Foods Tab */}
        <TabsContent value="foods">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Input
                placeholder="Add a food…"
                value={newFood}
                onChange={(e) => setNewFood(e.target.value)}
              />
              <Button onClick={() => addItem("food")}>Add</Button>
            </div>

            {foods.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded shadow">
                <div className="font-medium">{item.name}</div>

                <div className="flex items-center gap-4">
                  <Select value={item.rating} onValueChange={(v) => updateRating(item.id, v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="red">Red</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="destructive" onClick={() => deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
