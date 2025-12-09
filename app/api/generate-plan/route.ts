import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

export async function POST(req: Request) {
  try {
    const {
      dayConfig,
      greenMeals,
      householdSettings,
    } = await req.json()

    /*
      dayConfig example:

      {
        "Monday":    { lunch: true,  dinner: false },
        "Tuesday":   { lunch: false, dinner: true },
        "Wednesday": { lunch: true,  dinner: true },
        ...
      }
    */

    // ---------------------------------------------------------
    // Build dynamic JSON example for prompt
    // ---------------------------------------------------------
    function buildExample() {
      let obj = {}

      for (const day of DAYS) {
        const cfg = dayConfig[day]
        obj[day] = {
          lunch: cfg.lunch ? "..." : "",
          dinner: cfg.dinner ? "..." : "",
        }
      }

      return JSON.stringify(obj, null, 2)
    }

    const exampleJson = buildExample()

    // ---------------------------------------------------------
    // Build AI Prompt
    // ---------------------------------------------------------
    const prompt = `
Generate a weekly family meal plan.

Return ONLY valid JSON. No backticks. No extra text.

Follow this exact shape:

${exampleJson}

Rules:
- Only generate meals in fields that are non-empty in the example above.
- If a meal (lunch/dinner) is marked "" in the example, ALWAYS return "".
- If a day has both meals marked "", return both as "" (do not invent meals).
- Use kid-friendly meals.
- Prefer these meals/foods: ${greenMeals.join(", ")}
- Kids appetite: ${householdSettings.kids_appetite}
- Prep preference: ${householdSettings.prep_time_preference}
- Risk level: ${householdSettings.risk_level}

IMPORTANT:
- The output MUST strictly follow the JSON example's shape.
- DAYS MUST be in this order: ${DAYS.join(", ")}
- If unsure, keep meals simple.
`

    // ---------------------------------------------------------
    // Call OpenAI
    // ---------------------------------------------------------
    const completion = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt,
      max_output_tokens: 600,
    })

    let raw = completion.output_text.trim()
    raw = raw.replace(/```json/g, "")
             .replace(/```/g, "")
             .trim()

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      console.error("❌ JSON PARSE ERROR — RAW OUTPUT:", raw)
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------
    // Normalize output to guarantee UI safety
    // ---------------------------------------------------------
    const normalized: Record<string, { lunch: string; dinner: string }> = {}

    for (const day of DAYS) {
      const cfg = dayConfig[day]
      const aiDay = parsed[day] ?? {}

      normalized[day] = {
        lunch: cfg.lunch ? aiDay.lunch || "" : "",
        dinner: cfg.dinner ? aiDay.dinner || "" : "",
      }
    }

    // ---------------------------------------------------------
    // Return final plan
    // ---------------------------------------------------------
    return NextResponse.json({ plan: normalized })

  } catch (error) {
    console.error("AI ROUTE ERROR:", error)
    return NextResponse.json(
      { error: "Failed to generate plan" },
      { status: 500 }
    )
  }
}