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

export default function MealsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [meals, setMeals] = useState<any[]>([])
  const [foods, setFoods] = useState<any[]>([])
  const [newMeal, setNewMeal] = useState("")
  const [newFood, setNewFood] = useState("")
  const [loading, setLoading] = useState(true)

  // ----------------------------------------------------------------
  // Load household + meals + foods
  // ----------------------------------------------------------------
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

      // Load all household meals with rating + meal record
      const { data: mealRatings, error } = await supabase
        .from("household_meals")
        .select("rating, meals(*)")
        .eq("household_id", link.household_id)

      if (error) console.error(error)

      const ratings = mealRatings || []

      // --------------------------
      // Build Meals list safely
      // --------------------------
      const mealList = ratings
        .filter((entry) => entry.meals?.type === "meal")
        .map((entry) => ({
          ...entry.meals,
          rating: entry.rating,
        }))

      // --------------------------
      // Build Foods list safely
      // --------------------------
      const foodList = ratings
        .filter((entry) => entry.meals?.type === "food")
        .map((entry) => ({
          ...entry.meals,
          rating: entry.rating,
        }))

      setMeals(mealList)
      setFoods(foodList)

      setLoading(false)
    }

    load()
  }, [])

  // ----------------------------------------------------------------
  // Add new meal or food
  // ----------------------------------------------------------------
  async function addItem(type: "meal" | "food") {
    if (!householdId) return
    const name = type === "meal" ? newMeal.trim() : newFood.trim()
    if (!name) return

    // Insert into meals table
    const { data: created, error } = await supabase
      .from("meals")
      .insert({
        name,
        type,
      })
      .select()
      .single()

    if (error || !created) {
      console.error("Insert failed:", error)
      return
    }

    // Insert into household_meals with green rating
    await supabase.from("household_meals").insert({
      household_id: householdId,
      meal_id: created.id,
      rating: "green",
    })

    // Update UI
    if (type === "meal") {
      setMeals((m) => [...m, { ...created, rating: "green" }])
      setNewMeal("")
    } else {
      setFoods((f) => [...f, { ...created, rating: "green" }])
      setNewFood("")
    }
  }

  // ----------------------------------------------------------------
  // Update rating
  // ----------------------------------------------------------------
  async function updateRating(mealId: string, newRating: string) {
    if (!householdId) return

    await supabase
      .from("household_meals")
      .update({ rating: newRating })
      .eq("household_id", householdId)
      .eq("meal_id", mealId)

    // Update UI
    setMeals((m) => m.map((x) => (x.id === mealId ? { ...x, rating: newRating } : x)))
    setFoods((f) => f.map((x) => (x.id === mealId ? { ...x, rating: newRating } : x)))
  }

  // ----------------------------------------------------------------
  // Delete meal or food
  // ----------------------------------------------------------------
  async function deleteItem(mealId: string) {
    if (!householdId) return

    await supabase.from("household_meals").delete().eq("meal_id", mealId)
    await supabase.from("meals").delete().eq("id", mealId)

    setMeals((m) => m.filter((x) => x.id !== mealId))
    setFoods((f) => f.filter((x) => x.id !== mealId))
  }

  if (loading) return <p>Loading...</p>

  // ----------------------------------------------------------------
  // UI
  // ----------------------------------------------------------------
  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Meals & Foods</h1>

      <Tabs defaultValue="meals">
        <TabsList className="mb-6">
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="foods">Foods</TabsTrigger>
        </TabsList>

        {/* ---------------- MEALS TAB ---------------- */}
        <TabsContent value="meals">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Input
                placeholder="Add a meal..."
                value={newMeal}
                onChange={(e) => setNewMeal(e.target.value)}
              />
              <Button onClick={() => addItem("meal")}>Add</Button>
            </div>

            <div className="space-y-3">
              {meals.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-white p-4 rounded shadow"
                >
                  <div className="font-medium">{item.name}</div>

                  <div className="flex items-center gap-4">
                    {/* Rating */}
                    <Select
                      value={item.rating}
                      onValueChange={(v) => updateRating(item.id, v)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Delete */}
                    <Button
                      variant="destructive"
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ---------------- FOODS TAB ---------------- */}
        <TabsContent value="foods">
          <div className="space-y-6">
            <div className="flex gap-4">
              <Input
                placeholder="Add a food..."
                value={newFood}
                onChange={(e) => setNewFood(e.target.value)}
              />
              <Button onClick={() => addItem("food")}>Add</Button>
            </div>

            <div className="space-y-3">
              {foods.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-white p-4 rounded shadow"
                >
                  <div className="font-medium">{item.name}</div>

                  <div className="flex items-center gap-4">
                    {/* Rating */}
                    <Select
                      value={item.rating}
                      onValueChange={(v) => updateRating(item.id, v)}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">Green</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Delete */}
                    <Button
                      variant="destructive"
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
