"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

/* ---------------------------------------
   CONSTANTS
----------------------------------------*/
const CATEGORIES = [
  { key: "protein", label: "Meat & Fish" },
  { key: "carb", label: "Carbs" },
  { key: "veg", label: "Veg" },
  { key: "dairy", label: "Dairy" },
  { key: "other", label: "Other" },
]

/* ---------------------------------------
   TYPES
----------------------------------------*/
type FoodRow = {
  id: string
  name: string
  category: string
  rating: "green" | "amber" | "red"
  confidence_score: number
}

/* ---------------------------------------
   COMPONENT
----------------------------------------*/
export default function FoodPreferencesPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [foods, setFoods] = useState<FoodRow[]>([])
  const [newFood, setNewFood] = useState("")
  const [newCategory, setNewCategory] = useState("protein")
  const [loading, setLoading] = useState(true)

  /* ---------------------------------------
     LOAD DATA
  ----------------------------------------*/
  useEffect(() => {
    let active = true

    async function load() {
      const { data: session } = await supabase.auth.getSession()
      const user = session.session?.user
      if (!user || !active) {
        setLoading(false)
        return
      }

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id || !active) {
        setLoading(false)
        return
      }

      setHouseholdId(link.household_id)

      const { data } = await supabase
        .from("household_foods")
        .select(`
          rating,
          confidence_score,
          foods (
            id,
            name,
            category
          )
        `)
        .eq("household_id", link.household_id)

      if (data && active) {
        setFoods(
          data.map((r: any) => ({
            id: r.foods.id,
            name: r.foods.name,
            category: r.foods.category,
            rating: r.rating,
            confidence_score: r.confidence_score ?? 5,
          }))
        )
      }

      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  /* ---------------------------------------
     ADD FOOD
  ----------------------------------------*/
  async function addFood() {
    if (!newFood.trim() || !householdId) return

    const { data: food } = await supabase
      .from("foods")
      .insert({ name: newFood.trim(), category: newCategory })
      .select()
      .single()

    if (!food) return

    await supabase.from("household_foods").insert({
      household_id: householdId,
      food_id: food.id,
      rating: "green",
      confidence_score: 7,
    })

    setFoods((prev) => [
      ...prev,
      {
        id: food.id,
        name: food.name,
        category: food.category,
        rating: "green",
        confidence_score: 7,
      },
    ])

    setNewFood("")
  }

  /* ---------------------------------------
     UPDATE FOOD
  ----------------------------------------*/
  async function updateFood(
    foodId: string,
    updates: Partial<Pick<FoodRow, "rating" | "confidence_score">>
  ) {
    if (!householdId) return

    await supabase
      .from("household_foods")
      .update(updates)
      .eq("household_id", householdId)
      .eq("food_id", foodId)

    setFoods((prev) =>
      prev.map((f) =>
        f.id === foodId ? { ...f, ...updates } : f
      )
    )
  }

  /* ---------------------------------------
     UI
  ----------------------------------------*/
  if (loading) return <p className="p-6">Loading food preferences…</p>

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      <h1 className="text-4xl font-semibold">Food Preferences</h1>

      {/* Add food */}
      <div className="flex gap-3">
        <Input
          placeholder="Add a food…"
          value={newFood}
          onChange={(e) => setNewFood(e.target.value)}
        />

        <Select value={newCategory} onValueChange={setNewCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={addFood}>Add</Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="protein">
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((c) => (
          <TabsContent key={c.key} value={c.key}>
            <div className="space-y-4">
              {foods
                .filter((f) => f.category === c.key)
                .map((food) => (
                  <div
                    key={food.id}
                    className="flex justify-between items-center bg-white p-4 rounded shadow"
                  >
                    <div>
                      <p className="font-semibold">{food.name}</p>
                      <p className="text-sm text-gray-500">
                        Confidence: {food.confidence_score}/10
                      </p>
                    </div>

                    <div className="flex gap-4 items-center">
                      <Select
                        value={food.rating}
                        onValueChange={(v) =>
                          updateFood(food.id, { rating: v as any })
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

                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={food.confidence_score}
                        onChange={(e) =>
                          updateFood(food.id, {
                            confidence_score: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
