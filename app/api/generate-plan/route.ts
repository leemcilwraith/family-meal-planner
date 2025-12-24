import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"
import { fullPlanPrompt, slotPrompt } from "@/lib/aiPrompts"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/* ---------------------------------------
   TYPES
----------------------------------------*/
type MealSlot = {
  lunch?: string
  dinner?: string
}

type WeeklyPlan = Record<string, MealSlot>

/* ---------------------------------------
   HELPERS
----------------------------------------*/
function normaliseDay(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()
}

function safeParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/* ---------------------------------------
   ROUTE
----------------------------------------*/
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      householdId,
      selectedDays,
      mode = "full", // "full" | "slot"
      day,
      mealType,
      existingMeal,
      riskLevel = 3,
      prepTime = "standard",
      appetite = "medium",
    } = body

    if (!householdId) {
      return NextResponse.json(
        { error: "Missing householdId" },
        { status: 400 }
      )
    }

    /* ---------------------------------------
       1. LOAD FOOD PREFERENCES
    ----------------------------------------*/
    const { data: rows, error } = await supabaseServer
      .from("household_foods")
      .select(
        `
        rating,
        confidence_score,
        foods (
          id,
          name
        )
      `
      )
      .eq("household_id", householdId)

    if (error || !rows) {
      console.error("❌ Failed to load foods:", error)
      return NextResponse.json(
        { error: "Failed to load food preferences" },
        { status: 500 }
      )
    }

    const greenFoods: string[] = []
    const redFoods: string[] = []

    for (const row of rows as any[]) {
      if (!row.foods || row.foods.length === 0) continue

      const food = row.foods[0]
      if (!food?.name) continue

      if (row.rating === "green") greenFoods.push(food.name)
      if (row.rating === "red") redFoods.push(food.name)
    }

    if (greenFoods.length === 0) {
      return NextResponse.json(
        { error: "No green foods exist for this household" },
        { status: 400 }
      )
    }

    /* =================================================
       SLOT MODE — Single meal reshuffle
    ================================================= */
    if (mode === "slot") {
      if (!day || !mealType || !existingMeal) {
        return NextResponse.json(
          { error: "Missing slot data" },
          { status: 400 }
        )
      }

      const prompt = slotPrompt({
        greenFoods,
        redFoods,
        riskLevel,
        prepTime,
        appetite,
        existingMeal,
      })

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })

      const raw = completion.choices[0].message.content
        ?.replace(/```json|```/g, "")
        .trim()

      const parsed = safeParseJSON<{ meal?: string }>(raw || "")

      if (!parsed?.meal) {
        return NextResponse.json(
          { error: "AI failed to generate meal" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        day,
        mealType,
        meal: parsed.meal,
      })
    }

    /* =================================================
       FULL WEEK MODE
    ================================================= */

    /* ---------------------------------------
       2. BUILD PLAN SKELETON
    ----------------------------------------*/
    const skeleton: WeeklyPlan = {}

    for (const rawDay of Object.keys(selectedDays || {})) {
      const d = normaliseDay(rawDay)
      const cfg = selectedDays[rawDay]

      skeleton[d] = {}

      if (cfg.lunch) skeleton[d].lunch = ""
      if (cfg.dinner) skeleton[d].dinner = ""
    }

    /* ---------------------------------------
       3. ASK AI TO FILL PLAN
    ----------------------------------------*/
    const prompt = fullPlanPrompt({
      greenFoods,
      redFoods,
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

    const parsed = safeParseJSON<{ mealPlan?: WeeklyPlan }>(raw || "")

    if (!parsed?.mealPlan) {
      return NextResponse.json(
        { error: "AI did not return a valid plan" },
        { status: 500 }
      )
    }

    /* ---------------------------------------
       4. DEFENSIVE MERGE
    ----------------------------------------*/
    const finalPlan: WeeklyPlan = {}

    for (const dayKey of Object.keys(skeleton)) {
      finalPlan[dayKey] = {
        lunch:
          skeleton[dayKey].lunch !== undefined
            ? parsed.mealPlan[dayKey]?.lunch || "TBD"
            : undefined,
        dinner:
          skeleton[dayKey].dinner !== undefined
            ? parsed.mealPlan[dayKey]?.dinner || "TBD"
            : undefined,
      }
    }

    return NextResponse.json({ plan: finalPlan })
  } catch (err: any) {
    console.error("🔥 GENERATE PLAN ERROR:", err)
    return NextResponse.json(
      { error: "Failed to generate plan", details: err.message },
      { status: 500 }
    )
  }
}
