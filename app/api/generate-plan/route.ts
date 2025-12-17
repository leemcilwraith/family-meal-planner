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
      type: string
    }
  | {
      id: string
      name: string
      type: string
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
      mode = "full", // "full" | "slot"
      day,
      mealType,
      existingMeal,
    } = body

    if (!householdId) {
      return NextResponse.json(
        { error: "Missing householdId" },
        { status: 400 }
      )
    }

    /* -------------------------------------------------
       1. Fetch GREEN meals for household
    ---------------------------------------------------*/
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

    if (error) {
      console.error("❌ Supabase error:", error)
      return NextResponse.json({ error: "DB query failed" }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No meals linked to household" },
        { status: 400 }
      )
    }

    const greenMeals: string[] = []

    for (const row of rows as { rating: string; meals: JoinedMeal | null }[]) {
      if (row.rating !== "green" || !row.meals) continue

      const meal = Array.isArray(row.meals) ? row.meals[0] : row.meals
      if (!meal || meal.type !== "meal") continue

      greenMeals.push(meal.name)
    }

    if (greenMeals.length === 0) {
      return NextResponse.json(
        { error: "No green meals exist for this household" },
        { status: 400 }
      )
    }

    /* =================================================
       SLOT MODE — C3 (single-meal reshuffle)
    ===================================================*/
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

      let raw = completion.choices[0].message.content || ""
      raw = raw.replace(/```json|```/g, "").trim()

      console.log("🔄 SLOT AI OUTPUT:", raw)

      const parsed = JSON.parse(raw)

      return NextResponse.json({
        day,
        mealType,
        meal: parsed.meal,
      })
    }

    /* =================================================
       FULL WEEK MODE
    ===================================================*/

    /* -------------------------------------------------
       2. Build PLAN SKELETON (source of truth)
    ---------------------------------------------------*/
    const skeleton: WeeklyPlan = {}

    for (const rawDay of Object.keys(selectedDays || {})) {
      const cfg = selectedDays[rawDay]
      const day = normaliseDay(rawDay)

      skeleton[day] = {}

      if (cfg.lunch) skeleton[day].lunch = ""
      if (cfg.dinner) skeleton[day].dinner = ""
    }

    console.log("🧱 PLAN SKELETON:", skeleton)

    /* -------------------------------------------------
       3. Ask OpenAI to fill skeleton ONLY
    ---------------------------------------------------*/
    const prompt = fullPlanPrompt(greenMeals, skeleton)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    })

    let raw = completion.choices[0].message.content || ""
    raw = raw.replace(/```json|```/g, "").trim()

    console.log("🧠 RAW AI OUTPUT:", raw)

    const parsed = JSON.parse(raw)
    const aiPlan: WeeklyPlan = parsed.mealPlan || {}

    /* -------------------------------------------------
       4. DEFENSIVE MERGE (guarantees no blanks)
    ---------------------------------------------------*/
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

    console.log("✅ FINAL PLAN:", finalPlan)

    return NextResponse.json({ plan: finalPlan })
  } catch (err: any) {
    console.error("🔥 AI GENERATION ERROR:", err)
    return NextResponse.json(
      { error: "Failed to generate plan", details: err.message },
      { status: 500 }
    )
  }
}
