import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export async function POST(req: Request) {
  try {
    const { greenMeals, householdSettings } = await req.json()

    // ----------------------------
    // 1. Build prompt
    // ----------------------------
    const prompt = `
Generate a weekly meal plan for a household.

Return ONLY valid JSON with this exact shape:

{
  "Monday": { "lunch": "...", "dinner": "..." },
  "Tuesday": { "lunch": "...", "dinner": "..." },
  "Wednesday": { "lunch": "...", "dinner": "..." },
  "Thursday": { "lunch": "...", "dinner": "..." },
  "Friday": { "lunch": "...", "dinner": "..." },
  "Saturday": { "lunch": "...", "dinner": "..." },
  "Sunday": { "lunch": "...", "dinner": "..." }
}

Green meals (preferred): ${greenMeals.join(", ")}

Kids appetite: ${householdSettings.kids_appetite}
Prep preference: ${householdSettings.prep_time_preference}
Risk level: ${householdSettings.risk_level}

Do NOT include code blocks.
`

    // ----------------------------
    // 2. Call OpenAI
    // ----------------------------
    const completion = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt,
      max_output_tokens: 600,
    })

    let raw = completion.output_text.trim()

    // Remove accidental markdown fences if any
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim()

    let parsed: any

    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error("❌ Failed to parse JSON:", raw)
      throw new Error("Invalid AI JSON output")
    }

    // ----------------------------
    // 3. Normalize output
    // ----------------------------
    const normalized =
      parsed.mealPlan ??  // if the model used "mealPlan"
      parsed.plan ??      // if the model used "plan"
      parsed              // fallback if correct structure

    // Validate the expected structure
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]

    for (const day of days) {
      if (!normalized[day]) normalized[day] = { lunch: "", dinner: "" }
    }

    // ----------------------------
    // 4. Return final JSON
    // ----------------------------
    return NextResponse.json({ plan: normalized })
  } catch (error) {
    console.error("AI GENERATION ERROR:", error)
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    )
  }
}