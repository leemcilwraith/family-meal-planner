import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"
import { fullPlanPrompt, slotPrompt } from "@/lib/aiPrompts"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

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
    } = body

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 })
    }

    /* ---------------------------------------------
       1. Fetch GREEN meals
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

    const greenMeals = rows
      .filter(
        (r: any) => r.rating === "green" && r.meals && r.meals.type === "meal"
      )
      .map((r: any) => r.meals.name)

    if (greenMeals.length === 0) {
      return NextResponse.json(
        { error: "No green meals exist for this household" },
        { status: 400 }
      )
    }

    /* =================================================
       SLOT MODE (single meal reshuffle)
    ================================================= */
    if (mode === "slot") {
      if (!day || !mealType || !existingMeal) {
        return NextResponse.json(
          { error: "Missing slot data" },
          { status: 400 }
        )
      }

      const prompt = slotPrompt(greenMeals, existingMeal)

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
       FULL WEEK MODE
    ================================================= */

    /* Build skeleton */
    const skeleton: WeeklyPlan = {}

    for (const rawDay of Object.keys(selectedDays || {})) {
      const d = normaliseDay(rawDay)
      const cfg = selectedDays[rawDay]

      skeleton[d] = {}
      if (cfg.lunch) skeleton[d].lunch = ""
      if (cfg.dinner) skeleton[d].dinner = ""
    }

    const prompt = fullPlanPrompt(greenMeals, skeleton)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    })

    const raw = completion.choices[0].message.content
      ?.replace(/```json|```/g, "")
      .trim()

    const parsed = JSON.parse(raw || "{}")
    const aiPlan: WeeklyPlan = parsed.mealPlan || {}

    /* Defensive merge */
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

    /* ---------------------------------------------
       5. SAVE weekly_plan (INSIDE FUNCTION ✅)
    --------------------------------------------- */
    const { data: planRow, error: planError } = await supabaseServer
      .from("weekly_plans")
      .insert({
        household_id: householdId,
        week_start: new Date().toISOString().slice(0, 10),
        plan_json: finalPlan,
      })
      .select()
      .single()

    if (planError || !planRow) {
      console.error("❌ Failed to save weekly_plan", planError)
      return NextResponse.json(
        { error: "Failed to save plan" },
        { status: 500 }
      )
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
