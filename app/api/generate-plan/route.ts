import { NextResponse } from "next/server"
import OpenAI from "openai"
import { supabaseServer } from "@/lib/supabaseServer"

/* ---------------------------------------
   OPENAI
----------------------------------------*/
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

type HouseholdFoodRow = {
  rating: "green" | "amber" | "red"
  confidence_score: number | null
  foods: {
    id: string
    name: string
  } | null
}

/* ---------------------------------------
   HELPERS
----------------------------------------*/
function normaliseDay(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase()
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/* ---------------------------------------
   AUTO-LEARNING: DOWNGRADE FOOD
----------------------------------------*/
async function downgradeFood(
  householdId: string,
  foodName: string
) {
  // Find food
  const { data: food } = await supabaseServer
    .from("foods")
    .select("id")
    .ilike("name", foodName)
    .maybeSingle()

  if (!food) return

  // Fetch household_food row
  const { data: row } = await supabaseServer
    .from("household_foods")
    .select("confidence_score, rating")
    .eq("household_id", householdId)
    .eq("food_id", food.id)
    .maybeSingle()

  if (!row) return

  const newScore = Math.max(0, (row.confidence_score ?? 5) - 1)

  let newRating = row.rating
  if (newScore <= 3) newRating = "red"
  else if (newScore <= 6) newRating = "amber"
  else newRating = "green"

  await supabaseServer
    .from("household_foods")
    .update({
      confidence_score: newScore,
      rating: newRating,
    })
    .eq("household_id", householdId)
    .eq("food_id", food.id)
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
      riskLevel = 5,
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
      .select(`
        rating,
        confidence_score,
        foods (
          id,
          name
        )
      `)
      .eq("household_id", householdId)

    if (error || !rows) {
      console.error("❌ Failed to load foods", error)
      return NextResponse.json(
        { error: "Failed to load food preferences" },
        { status: 500 }
      )
    }

    const greenFoods: string[] = []
    const amberFoods: string[] = []
    const redFoods: string[] = []

    for (const row of rows as HouseholdFoodRow[]) {
      if (!row.foods) continue

      if (row.rating === "green") greenFoods.push(row.foods.name)
      if (row.rating === "amber") amberFoods.push(row.foods.name)
      if (row.rating === "red") redFoods.push(row.foods.name)
    }

    if (greenFoods.length === 0) {
      return NextResponse.json(
        { error: "No green foods exist for this household" },
        { status: 400 }
      )
    }

    /* =================================================
       SLOT MODE — SINGLE MEAL REPLACEMENT
    ================================================= */
    if (mode === "slot") {
      if (!day || !mealType || !existingMeal) {
        return NextResponse.json(
          { error: "Missing slot data" },
          { status: 400 }
        )
      }

      const prompt = `
You are helping parents choose meals children might enjoy.

Green foods (safe):
${greenFoods.map((f) => `- ${f}`).join("\n")}

Amber foods (sometimes ok):
${amberFoods.map((f) => `- ${f}`).join("\n")}

Red foods (avoid):
${redFoods.map((f) => `- ${f}`).join("\n")}

Risk level: ${riskLevel}/10
Prep time preference: ${prepTime}
Appetite: ${appetite}

The previous meal was:
"${existingMeal}"

Choose ONE new meal idea the children are likely to accept.
Use green foods primarily.
Only include amber foods if risk level ≥ 6.
Never include red foods.

Return JSON ONLY:
{ "meal": "Meal name" }
`

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      })

      const raw = completion.choices[0].message.content
        ?.replace(/```json|```/g, "")
        .trim()

      const parsed = safeJsonParse<{ meal: string }>(raw || "")

      if (!parsed?.meal) {
        return NextResponse.json(
          { error: "AI failed to generate replacement" },
          { status: 500 }
        )
      }

      // 🔁 Auto-downgrade one food from rejected meal
      const rejected = [...greenFoods, ...amberFoods].find((f) =>
        existingMeal.toLowerCase().includes(f.toLowerCase())
      )
      if (rejected) {
        await downgradeFood(householdId, rejected)
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
       2. BUILD SKELETON
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
       3. PROMPT AI
    ----------------------------------------*/
    const prompt = `
You are generating a family meal plan.

Green foods (safe):
${greenFoods.map((f) => `- ${f}`).join("\n")}

Amber foods (sometimes ok):
${amberFoods.map((f) => `- ${f}`).join("\n")}

Red foods (avoid):
${redFoods.map((f) => `- ${f}`).join("\n")}

Risk level: ${riskLevel}/10
Prep time preference: ${prepTime}
Appetite size: ${appetite}

Rules:
- Use green foods by default
- Use amber foods only if risk ≥ 6
- Never include red foods
- Fill every empty slot
- Do not add or remove days

Skeleton:
${JSON.stringify(skeleton, null, 2)}

Return JSON ONLY:
{
  "mealPlan": { ...same structure }
}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    })

    const raw = completion.choices[0].message.content
      ?.replace(/```json|```/g, "")
      .trim()

    const parsed = safeJsonParse<{ mealPlan: WeeklyPlan }>(raw || "")

    if (!parsed?.mealPlan) {
      return NextResponse.json(
        { error: "AI failed to generate plan" },
        { status: 500 }
      )
    }

    /* ---------------------------------------
       4. DEFENSIVE MERGE
    ----------------------------------------*/
    const finalPlan: WeeklyPlan = {}

    for (const day of Object.keys(skeleton)) {
      finalPlan[day] = {
        lunch:
          skeleton[day].lunch !== undefined
            ? parsed.mealPlan[day]?.lunch || "TBD"
            : undefined,
        dinner:
          skeleton[day].dinner !== undefined
            ? parsed.mealPlan[day]?.dinner || "TBD"
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
