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

/* ---------------------------------------
   TYPES
----------------------------------------*/
type FoodRecord = {
  id: string
  name: string
  category: string
}

type HouseholdFoodRow = {
  rating: "green" | "amber" | "red"
  confidence_score?: number | null
  foods: FoodRecord[] | null
}

type HouseholdFood = FoodRecord & {
  rating: "green" | "amber" | "red"
  confidence_score?: number | null
}

/* ---------------------------------------
   COMPONENT
----------------------------------------*/
export default function FoodPreferencesPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [foods, setFoods] = useState<HouseholdFood[]>([])
  const [newFood, setNewFood] = useState("")
  const [newCategory, setNewCategory] = useState("veg")
  const [loading, setLoading] = useState(true)

  /* ---------------------------------------
     LOAD HOUSEHOLD + FOODS
  ----------------------------------------*/
  useEffect(() => {
    let mounted = true

    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || !mounted) return

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id || !mounted) return
      const hid = link.household_id
      setHouseholdId(hid)

      const { data } = await supabase
        .from("household_foods")
        .select("rating, confidence_score, foods(id, name, category)")
        .eq("household_id", hid)
        .order("rating")

      if (data && mounted) {
        const normalised: HouseholdFood[] = data
          .map((row: HouseholdFoodRow) => {
            const food = row.foods?.[0]
            if (!food) return null

            return {
              ...food,
              rating: row.rating,
              confidence_score: row.confidence_score ?? null,
            }
          })
          .filter(Boolean) as HouseholdFood[]

        setFoods(normalised)
      }

      setLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  /* ---------------------------------------
     ADD FOOD
  ----------------------------------------*/
  async function addFood() {
    if (!householdId || !newFood.trim()) return

    // 1. Create food
    const { data: food, error } = await supabase
      .from("foods")
      .insert({
        name: newFood.trim(),
        category: newCategory,
      })
      .select()
      .single()

    if (error || !food) {
      console.error("Failed to create food", error)
      return
    }

    // 2. Link to household
    await supabase.from("household_foods").insert({
      household_id: householdId,
      food_id: food.id,
      rating: "green",
    })

    // 3. Update UI
    setFoods((prev) => [
      ...prev,
      {
        ...food,
        rating: "green",
        confidence_score: null,
      },
    ])

    setNewFood("")
  }

  /* ---------------------------------------
     UPDATE RATING
  ----------------------------------------*/
  async function updateRating(
    foodId: string,
    rating: "green" | "amber" | "red"
  ) {
    if (!householdId) return

    await supabase
      .from("household_foods")
      .update({ rating })
      .eq("household_id", householdId)
      .eq("food_id", foodId)

    setFoods((prev) =>
      prev.map((f) =>
        f.id === foodId ? { ...f, rating } : f
      )
    )
  }

  /* ---------------------------------------
     DELETE FOOD
  ----------------------------------------*/
  async function deleteFood(foodId: string) {
    if (!householdId) return

    await supabase
      .from("household_foods")
      .delete()
      .eq("household_id", householdId)
      .eq("food_id", foodId)

    await supabase.from("foods").delete().eq("id", foodId)

    setFoods((prev) => prev.filter((f) => f.id !== foodId))
  }

  /* ---------------------------------------
     UI
  ----------------------------------------*/
  if (loading) return <p className="p-10">Loading foods…</p>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-4xl font-semibold">Food Preferences</h1>

      <p className="text-gray-600">
        Tell us what foods your children enjoy, tolerate, or dislike.
        This helps us create better meal plans.
      </p>

      {/* Add food */}
      <div className="flex gap-3">
        <Input
          placeholder="Add a food (e.g. broccoli, chicken, rice)"
          value={newFood}
          onChange={(e) => setNewFood(e.target.value)}
        />

        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="meat">Meat / Fish</SelectItem>
            <SelectItem value="veg">Vegetable</SelectItem>
            <SelectItem value="carb">Carbohydrate</SelectItem>
            <SelectItem value="dairy">Dairy</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={addFood}>Add</Button>
      </div>

      {/* Food list */}
      <div className="space-y-4">
        {foods.map((food) => (
          <div
            key={food.id}
            className="flex items-center justify-between p-4 bg-white rounded shadow"
          >
            <div>
              <div className="font-medium">{food.name}</div>
              <div className="text-sm text-gray-500 capitalize">
                {food.category}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Select
                value={food.rating}
                onValueChange={(v) =>
                  updateRating(food.id, v as "green" | "amber" | "red")
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                onClick={() => deleteFood(food.id)}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
