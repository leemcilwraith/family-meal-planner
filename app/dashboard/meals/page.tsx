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

// -------------------------------------------------------------------
// TYPES
// -------------------------------------------------------------------

type MealRecord = {
  id: string
  name: string
  type: "meal" | "food"
}

type MealWithRating = MealRecord & {
  rating: string
  is_favourite: boolean
}

type HouseholdMealRow = {
  rating: string
  is_favourite: boolean
  meals: MealRecord | null
}

export default function MealsPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [meals, setMeals] = useState<MealWithRating[]>([])
  const [foods, setFoods] = useState<MealWithRating[]>([])
  const [newMeal, setNewMeal] = useState("")
  const [newFood, setNewFood] = useState("")
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------------
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

      const { data, error } = await supabase
        .from("household_meals")
        .select("rating, is_favourite, meals(*)") as unknown as {
        data: HouseholdMealRow[] | null
        error: any
      }

      if (error) {
        console.error(error)
        return
      }

      const rows = data ?? []

      const mealList: MealWithRating[] = rows
        .filter((row) => row.meals?.type === "meal")
        .map((row) => ({
          ...(row.meals as MealRecord),
          rating: row.rating,
          is_favourite: row.is_favourite,
        }))

      const foodList: MealWithRating[] = rows
        .filter((row) => row.meals?.type === "food")
        .map((row) => ({
          ...(row.meals as MealRecord),
          rating: row.rating,
          is_favourite: row.is_favourite,
        }))

      setMeals(mealList)
      setFoods(foodList)
      setLoading(false)
    }

    load()
  }, [])

  // -------------------------------------------------------------------
  // ADD MEAL / FOOD
  // -------------------------------------------------------------------
  async function addItem(type: "meal" | "food") {
    if (!householdId) return

    const name = type === "meal" ? newMeal.trim() : newFood.trim()
    if (!name) return

    const { data: created, error } = await supabase
      .from("meals")
      .insert({ name, type })
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
      is_favourite: false,
    })

    const entry: MealWithRating = {
      ...created,
      rating: "green",
      is_favourite: false,
    }

    if (type === "meal") {
      setMeals((m) => [...m, entry])
      setNewMeal("")
    } else {
      setFoods((f) => [...f, entry])
      setNewFood("")
    }
  }

  // -------------------------------------------------------------------
  // UPDATE RATING
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // TOGGLE FAVOURITE ⭐
  // -------------------------------------------------------------------
  async function toggleFavourite(mealId: string, current: boolean) {
    if (!householdId) return

    const { error } = await supabase
      .from("household_meals")
      .update({ is_favourite: !current })
      .eq("household_id", householdId)
      .eq("meal_id", mealId)

    if (error) {
      console.error("Failed to update favourite:", error)
      return
    }

    setMeals((m) =>
      m.map((x) =>
        x.id === mealId ? { ...x, is_favourite: !current } : x
      )
    )

    setFoods((f) =>
      f.map((x) =>
        x.id === mealId ? { ...x, is_favourite: !current } : x
      )
    )
  }

  // -------------------------------------------------------------------
  // DELETE ITEM
  // -------------------------------------------------------------------
  async function deleteItem(mealId: string) {
    if (!householdId) return

    await supabase.from("household_meals").delete().eq("meal_id", mealId)
    await supabase.from("meals").delete().eq("id", mealId)

    setMeals((m) => m.filter((x) => x.id !== mealId))
    setFoods((f) => f.filter((x) => x.id !== mealId))
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  if (loading) return <p>Loading…</p>

  function renderList(items: MealWithRating[]) {
    const favourites = items.filter((i) => i.is_favourite)
    const others = items.filter((i) => !i.is_favourite)

    return (
      <div className="space-y-6">
        {[...favourites, ...others].map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 bg-white rounded shadow"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleFavourite(item.id, item.is_favourite)}
              >
                {item.is_favourite ? "⭐" : "☆"}
              </Button>

              <span className="font-medium">{item.name}</span>
            </div>

            <div className="flex items-center gap-4">
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
    )
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Meals & Foods</h1>

      <Tabs defaultValue="meals">
        <TabsList className="mb-6">
          <TabsTrigger value="meals">Meals</TabsTrigger>
          <TabsTrigger value="foods">Foods</TabsTrigger>
        </TabsList>

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

            {renderList(meals)}
          </div>
        </TabsContent>

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

            {renderList(foods)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
