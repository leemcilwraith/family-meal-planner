import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export async function POST(req: Request) {
  try {
    const { householdId, selectedDays } = await req.json()

    if (!householdId || !selectedDays) {
      return NextResponse.json({ error: "Missing householdId or selectedDays" }, { status: 400 })
    }

    // Load meal ratings + meals
    const { data: ratings } = await supabase
      .from("household_meals")
      .select(
        `
        meal_id,
        rating,
        meals ( id, name, type )
      `
      )
      .eq("household_id", householdId)

    const greenMeals =
      ratings
        ?.filter((r) => r.rating === "green" && r.meals?.type === "meal")
        .map((r) => r.meals.name) ?? []

    // -----------------------------------
    // Transform selectedDays to a simple structure
    // Example:  { Monday: { lunch: true, dinner: false } }
    // -----------------------------------
    const dayConfig: Record<string, { lunch: boolean; dinner: boolean }> = selectedDays

    // -----------------------------------
    // Build example JSON for model
    // -----------------------------------
    function buildExample() {
      let obj: Record<string, { lunch: string; dinner: string }> = {}

      for (const day of DAYS) {
        const cfg = dayConfig[day] || { lunch: false, dinner: false }
        obj[day] = {
          lunch: cfg.lunch ? "..." : "",
          dinner: cfg.dinner ? "..." : "",
        }
      }

      return JSON.stringify(obj, null, 2)
    }

    const exampleJson = buildExample()

    // -----------------------------------
    // Build the prompt
    // -----------------------------------
    const prompt = `
You are generating a weekly meal plan for a family.

Rules:
- Use ONLY meals from this green list: ${greenMeals.join(", ") || "none"}.
- If a day/meal slot is disabled, return an empty string "".
- Respond ONLY with valid JSON. No code blocks.

The JSON MUST match this exact structure:
\`\`\`
${exampleJson}
\`\`\`

Now generate the plan:
`

    // -----------------------------------
    // Call OpenAI
    // -----------------------------------
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    })

    let raw = response.choices?.[0]?.message?.content?.trim() ?? ""

    // Strip ```json fences if present
    if (raw.startsWith("```")) {
      raw = raw.replace(/```json|```/g, "").trim()
    }

    // Parse JSON
    const parsed = JSON.parse(raw)

    // -----------------------------------
    // Save plan to DB
    // -----------------------------------
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)

    await supabase.from("weekly_plans").insert({
      household_id: householdId,
      week_start: weekStart,
      plan_json: parsed,
    })

    return NextResponse.json({ plan: parsed })
  } catch (err: any) {
    console.error("AI GENERATION ERROR:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}