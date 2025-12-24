/* ---------------------------------------
   TYPES
----------------------------------------*/
type FoodPreferences = {
  greenFoods: string[]
  amberFoods: string[]
  redFoods: string[]
  riskLevel: number // 0–10
  prepTime: "quick" | "standard" | "any"
  appetite: "small" | "medium" | "large"
}

type FullPlanPromptInput = FoodPreferences & {
  skeleton: Record<string, { lunch?: string; dinner?: string }>
}

type SlotPromptInput = FoodPreferences & {
  existingMeal: string
}

/* ---------------------------------------
   HELPERS
----------------------------------------*/
function riskExplanation(risk: number) {
  if (risk <= 2)
    return "Stick almost entirely to familiar foods the children already like."
  if (risk <= 5)
    return "Mostly familiar foods, with very small variations."
  if (risk <= 7)
    return "Mix familiar foods with a few gentle new ideas."
  return "Actively introduce new meals using familiar ingredients."
}

/* ---------------------------------------
   FULL WEEK PROMPT
----------------------------------------*/
export function fullPlanPrompt(input: FullPlanPromptInput) {
  const {
    greenFoods,
    amberFoods,
    redFoods,
    riskLevel,
    prepTime,
    appetite,
    skeleton,
  } = input

  return `
You are a family meal planner for young children.

Your job is to CREATE meals using foods the family already likes,
while gently encouraging variety depending on the risk level.

IMPORTANT RULES:
- Think in INGREDIENTS, not predefined meals
- Combine foods into sensible family meals
- Avoid red foods unless risk level is high
- Never include foods the family strongly dislikes unless risk >= 8
- Prefer green foods as a base
- Amber foods are allowed depending on risk
- Meals should feel realistic and child-friendly

RISK GUIDANCE:
${riskExplanation(riskLevel)}

FAMILY FOOD PREFERENCES:

GREEN (very comfortable):
${greenFoods.map((f) => `- ${f}`).join("\n")}

AMBER (sometimes okay):
${amberFoods.map((f) => `- ${f}`).join("\n")}

RED (generally disliked):
${redFoods.map((f) => `- ${f}`).join("\n")}

COOKING CONSTRAINTS:
- Prep time preference: ${prepTime}
- Appetite size: ${appetite}

MEAL STRUCTURE:
- Each meal should usually include:
  - 1 protein
  - 1 carb
  - 1–2 vegetables
- Meals should sound like something a parent would actually cook

HERE IS THE PLAN YOU MUST FILL:
${JSON.stringify(skeleton, null, 2)}

OUTPUT RULES:
- Return VALID JSON ONLY
- Do not add or remove days
- Do not include commentary
- Use this exact format:

{
  "mealPlan": {
    "Monday": {
      "lunch": "Meal name",
      "dinner": "Meal name"
    }
  }
}
`
}

/* ---------------------------------------
   SLOT (RESHUFFLE) PROMPT
----------------------------------------*/
export function slotPrompt(input: SlotPromptInput) {
  const {
    greenFoods,
    amberFoods,
    redFoods,
    riskLevel,
    prepTime,
    appetite,
    existingMeal,
  } = input

  return `
You are helping reshuffle ONE meal in a weekly plan.

CURRENT MEAL (do not repeat this):
"${existingMeal}"

GOAL:
Suggest ONE alternative meal that fits the family's preferences,
without repeating the same idea.

FOOD PREFERENCES:

GREEN:
${greenFoods.map((f) => `- ${f}`).join("\n")}

AMBER:
${amberFoods.map((f) => `- ${f}`).join("\n")}

RED:
${redFoods.map((f) => `- ${f}`).join("\n")}

RISK LEVEL:
${riskExplanation(riskLevel)}

COOKING CONSTRAINTS:
- Prep time: ${prepTime}
- Appetite: ${appetite}

RULES:
- Create a meal from ingredients
- Prefer green foods
- Use amber foods only if appropriate
- Avoid red foods unless risk >= 8
- Meal must be realistic and child-friendly
- Do NOT repeat the existing meal

OUTPUT FORMAT (JSON ONLY):
{ "meal": "Meal name" }
`
}
