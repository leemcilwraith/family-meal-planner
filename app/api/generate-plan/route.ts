import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { householdId } = await req.json()

    if (!householdId) {
      return NextResponse.json({ error: "Missing householdId" }, { status: 400 })
    }

    // -----------------------------------
    // 1. LOAD SETTINGS
    // -----------------------------------
    const { data: settings } = await supabase
      .from("household_settings")
      .select("*")
      .eq("household_id", householdId)
      .single()

    const riskLevel = settings?.risk_level ?? 5
    const prepPref = settings?.prep_time_preference ?? "standard"
    const kidsAppetite = settings?.kids_appetite ?? "medium"

    // -----------------------------------
    // 2. LOAD MEALS + RATINGS
    // -----------------------------------
    const { data: ratings } = await supabase
      .from("household_meals")
      .select("rating, meals(id, name, type)")
      .eq("household_id", householdId)

    // Normalize meals: Supabase sometimes types nested selects as arrays
      const normalisedRatings = ratings?.map((r) => ({
        rating: r.rating,
        meals: Array.isArray(r.meals) ? r.meals[0] : r.meals,
      })) ?? []

      const greenMeals = normalisedRatings
        .filter((r) => r.rating === "green" && r.meals?.type === "meal")
        .map((r) => r.meals.name)

    // -----------------------------------
    // 3. INITIALISE OPENAI CLIENT
    // -----------------------------------
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })

    // -----------------------------------
    // 4. ASK AI TO BUILD A WEEKLY PLAN
    // -----------------------------------
    const systemPrompt = `
You are designing a child-friendly weekly meal plan.

Return ONLY valid JSON.
DO NOT include code fences like \`\`\`json or \`\`\`.
DO NOT include commentary.
The response must be valid for JSON.parse().

Rules:
- Include Monday → Sunday.
- Each day has lunch + dinner.
- Use child-friendly meals.
- Prefer green meals.
- Risk tolerance: ${riskLevel}.
- Prep-time preference: ${prepPref}.
- Kids appetite: ${kidsAppetite}.
`

    const userPrompt = `
Green meals:
${greenMeals.join(", ") || "None"}

Generate a weekly plan.
`

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_output_tokens: 500,
    })

    let raw = response.output_text.trim()
    console.log("RAW AI OUTPUT:", raw)

    // -----------------------------------
    // REMOVE ```json AND ``` FROM OUTPUT
    // -----------------------------------
    raw = raw.replace(/```json/gi, "")
    raw = raw.replace(/```/g, "")
    raw = raw.trim()

    if (raw.startsWith("json")) {
      raw = raw.slice(4).trim()
    }

    // -----------------------------------
    // PARSE JSON SAFELY
    // -----------------------------------
    let plan
    try {
      plan = JSON.parse(raw)
    } catch (e) {
      console.error("JSON PARSE ERROR. RAW OUTPUT:", raw)
      throw e
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error("AI GENERATION ERROR:", err)
    return NextResponse.json(
      { error: "Failed to generate plan", details: String(err) },
      { status: 500 }
    )
  }
}