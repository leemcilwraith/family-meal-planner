import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// ----------------------
// Type definitions
// ----------------------

type MealRecord = {
  id: string
  name: string
  type: string
}

type HouseholdMealRow = {
  rating: string
  meals: MealRecord | null
}

type GeneratePlanBody = {
  householdId: string
  selectedDays: {
    [day: string]: {
      lunch: boolean
      dinner: boolean
    }
  }
}

// ----------------------
// API Route
// ----------------------

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GeneratePlanBody
    const { householdId, selectedDays } = body

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 })
    }

    // ------------------------------
    // Fetch household meal ratings
    // ------------------------------
    const { data: rawRatings, error: ratingsError } = await supabase
      .from("household_meals")
      .select(`
        rating,
        meals ( id, name, type )
      `)
      .eq("household_id", householdId)

    if (ratingsError) {
      console.error("Supabase rating error:", ratingsError)
      return NextResponse.json(
        { error: "Failed to load meal ratings" },
        { status: 500 }
      )
    }

    // rawRatings.meals may be an array → convert
    const ratings: HouseholdMealRow[] = (rawRatings ?? []).map((row: any) => {
      let meal: MealRecord | null = null

      // meals may be null OR an array OR an object
      if (Array.isArray(row.meals) && row.meals.length > 0) {
        meal = row.meals[0] // take the first related meal
      } else if (row.meals && typeof row.meals === "object") {
        meal = row.meals
      }

      return {
        rating: row.rating,
        meals: meal,
      }
    })

    // Filter only green MEALS (not foods)
    const greenMeals =
      ratings
        .filter((r) => r.rating === "green" && r.meals?.type === "meal")
        .map((r) => r.meals!.name) ?? []

    if (greenMeals.length === 0) {
      return NextResponse.json(
        { error: "No green meals exist for this household." },
        { status: 400 }
      )
    }

    // ------------------------------
    // Validate selected days
    // ------------------------------

    const requestedRows: string[] = []
    for (const day in selectedDays) {
      const opts = selectedDays[day]
      if (opts.lunch || opts.dinner) {
        requestedRows.push(day)
      }
    }

    if (requestedRows.length === 0) {
      return NextResponse.json(
        { error: "No days or meals selected" },
        { status: 400 }
      )
    }

    // ------------------------------
    // Build AI prompt
    // ------------------------------
    const aiPrompt = `
Generate a meal plan using ONLY the following green meals:

${greenMeals.map((m) => `- ${m}`).join("\n")}

The user has selected these days and meals:

${requestedRows
  .map(
    (day) =>
      `${day}: lunch=${selectedDays[day].lunch}, dinner=${selectedDays[day].dinner}`
  )
  .join("\n")}

Return ONLY valid JSON in this format:

{
  "plan": {
    "Monday": { "lunch": "", "dinner": "" },
    "Tuesday": { "lunch": "", "dinner": "" }
  }
}

Return empty string for any meal they did not select.
`

    const response = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: aiPrompt,
    })

    let raw = response.output_text?.trim() ?? ""

    raw = raw
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim()

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error("Invalid AI JSON:", raw)
      return NextResponse.json(
        { error: "AI returned invalid JSON", raw },
        { status: 500 }
      )
    }

    const plan = parsed.plan
    if (!plan) {
      return NextResponse.json(
        { error: "Missing plan in AI response", parsed },
        { status: 500 }
      )
    }

    // Save to DB
    const { error: saveErr } = await supabase.from("weekly_plans").insert({
      household_id: householdId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: plan,
    })

    if (saveErr) {
      console.error("Failed to save plan:", saveErr)
      return NextResponse.json({ error: "Could not save" }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error("Unexpected error:", err)
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    )
  }
}