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
  type: "meal" | "food" | string
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
    const { data: ratings, error: ratingsError } = await supabase
      .from("household_meals")
      .select(`
        rating,
        meals ( id, name, type )
      `)

    if (ratingsError) {
      console.error("Supabase rating error:", ratingsError)
      return NextResponse.json(
        { error: "Failed to load meal ratings" },
        { status: 500 }
      )
    }

    const typedRatings = (ratings ?? []) as HouseholdMealRow[]

    // Only green meals + only MEALS (not foods)
    const greenMeals =
      typedRatings
        .filter((r) => r.rating === "green" && r.meals?.type === "meal")
        .map((r) => r.meals!.name) ?? []

    // If no green meals exist, AI cannot build anything
    if (greenMeals.length === 0) {
      return NextResponse.json(
        { error: "No green meals exist for this household." },
        { status: 400 }
      )
    }

    // ------------------------------
    // Build selected-days object
    // ------------------------------
    const requestedRows: string[] = []
    for (const day in selectedDays) {
      const opts = selectedDays[day]
      if (opts.lunch || opts.dinner) {
        requestedRows.push(day)
      }
    }

    // Edge case
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
You are generating a weekly meal plan.

Only choose meals from this GREEN LIST:
${greenMeals.map((m) => `- ${m}`).join("\n")}

User has selected these meals to generate:
${requestedRows
  .map(
    (day) =>
      `${day}: lunch = ${selectedDays[day].lunch}, dinner = ${
        selectedDays[day].dinner
      }`
  )
  .join("\n")}

Return ONLY a JSON object in the following format, and nothing else:

{
  "plan": {
    "Monday": { "lunch": "", "dinner": "" },
    "Tuesday": { "lunch": "", "dinner": "" },
    ...
  }
}

If a meal was not selected (lunch/dinner = false), return an empty string for it.
`

    // ------------------------------
    // OpenAI call
    // ------------------------------
    const response = await client.responses.create({
      model: "gpt-4.1",
      reasoning: { effort: "medium" },
      input: aiPrompt,
    })

    const raw = response.output_text?.trim()

    if (!raw) {
      return NextResponse.json(
        { error: "AI returned no text" },
        { status: 500 }
      )
    }

    // Remove code fences if present
    const cleaned = raw
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim()

    let aiJson: any = null
    try {
      aiJson = JSON.parse(cleaned)
    } catch (err) {
      console.error("BAD JSON FROM AI:", cleaned)
      return NextResponse.json(
        { error: "Invalid JSON from AI" },
        { status: 500 }
      )
    }

    const plan = aiJson.plan
    if (!plan) {
      return NextResponse.json(
        { error: "AI did not return a valid plan" },
        { status: 500 }
      )
    }

    // ------------------------------
    // Save generated plan
    // ------------------------------
    const { error: saveErr } = await supabase.from("weekly_plans").insert({
      household_id: householdId,
      week_start: new Date().toISOString().slice(0, 10),
      plan_json: plan,
    })

    if (saveErr) {
      console.error("Failed to save plan:", saveErr)
      return NextResponse.json(
        { error: "Could not save plan to database" },
        { status: 500 }
      )
    }

    // Return the generated plan
    return NextResponse.json({ plan })
  } catch (err) {
    console.error("UNEXPECTED ERROR:", err)
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    )
  }
}