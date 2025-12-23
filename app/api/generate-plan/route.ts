import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"
import { fullPlanPrompt, slotPrompt } from "@/lib/aiPrompts"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

type JoinedMeal =
  | {
      id: string
      name: string
      type: "meal" | "food"
    }
  | {
      id: string
      name: string
      type: "meal" | "food"
    }[]

type MealSlot = {
  lunch?: string
  dinner?: string
}

type WeeklyPlan = Record<string, MealSlot>

function normaliseDay(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      householdId,
      selectedDays,
      mode = "full",
      day,
      mealType,
      existingMeal,
      riskLevel = 3,
      prepTime = "quick",
      appetite = "medium",
    } = body

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 })
    }

    /* ---------------------------------------------
       1. Fetch meals
    --------------------------------------------- */
    const { data: rows, error } = await supabaseServer
      .from("household_meals")
      .select(
        `
        rating,
        meals (
          id,
          name,
          type
        )
      `
      )
      .eq("household_id", householdId)

    if (error || !rows) {
      console.error("❌ Meal fetch failed", error)
      return NextResponse.json({ error: "Meal fetch failed" }, { status: 500 })
    }

    const greenMeals: string[] = []
    const redMeals: string[] = []
    const foods: string[] = []

    for (const row of rows as { rating: string; meals: JoinedMeal | null }[]) {
      if (!row.meals) continue
      const meal = Array.isArray(row.meals) ? row.meals[0] : row.meals
      if (!meal) continue

      if (meal.type === "meal" && row.rating === "green") greenMeals.push(meal.name)
      if (meal.type === "meal" && row.rating === "red") redMeals.push(meal.name)
      if (meal.type === "food") foods.push(meal.name)
    }

    if (greenMeals.length === 0) {
      return NextResponse.json(
        { error: "No green meals exist for this household" },
        { status: 400 }
      )
    }

    /* =================================================
       SLOT MODE
    ================================================= */
    if (mode === "slot") {
      if (!day || !mealType || !existingMeal) {
        return NextResponse.json(
          { error: "Missing slot data" },
          { status: 400 }
        )
      }

      const prompt = slotPrompt({
  greenMeals,
  redMeals,
  foods,
  riskLevel,
  prepTime,
  appetite,
  existingMeal: String(existingMeal),
})


      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })

      const raw = completion.choices[0].message.content
        ?.replace(/```json|```/g, "")
        .trim()

      const parsed = JSON.parse(raw || "{}")

      return NextResponse.json({
        day,
        mealType,
        meal: parsed.meal,
      })
    }

    /* =================================================
       FULL PLAN MODE
    ================================================= */
    const skeleton: WeeklyPlan = {}

    for (const rawDay of Object.keys(selectedDays || {})) {
      const d = normaliseDay(rawDay)
      const cfg = selectedDays[rawDay]
      skeleton[d] = {}
      if (cfg.lunch) skeleton[d].lunch = ""
      if (cfg.dinner) skeleton[d].dinner = ""
    }

    const prompt = fullPlanPrompt({
  greenMeals,
  redMeals,
  foods,
  riskLevel,
  prepTime,
  appetite,
  skeleton,
})


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    })

    const raw = completion.choices[0].message.content
      ?.replace(/```json|```/g, "")
      .trim()

    const parsed = JSON.parse(typeof raw === "string" && raw.trim() ? raw : "{}")
    const aiPlan: WeeklyPlan = parsed.mealPlan || {}

    const finalPlan: WeeklyPlan = {}

    for (const day of Object.keys(skeleton)) {
      finalPlan[day] = {
        lunch:
          skeleton[day].lunch !== undefined
            ? aiPlan[day]?.lunch || "TBD"
            : undefined,
        dinner:
          skeleton[day].dinner !== undefined
            ? aiPlan[day]?.dinner || "TBD"
            : undefined,
      }
    }

    return NextResponse.json({ plan: finalPlan })
  } catch (err: any) {
    console.error("🔥 GENERATE PLAN ERROR", err)
    return NextResponse.json(
      { error: "Failed to generate plan", details: err.message },
      { status: 500 }
    )
  }
}
