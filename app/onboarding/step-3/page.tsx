"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

export default function Step3() {
  const router = useRouter()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [kidsAppetite, setKidsAppetite] = useState("medium")
  const [prepPreference, setPrepPreference] = useState("standard")
  const [riskLevel, setRiskLevel] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) {
        router.push("/login")
        return
      }

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!link?.household_id) {
        router.push("/onboarding/step-1")
        return
      }

      const householdId = link.household_id
      setHouseholdId(householdId)

      const { data: settings } = await supabase
        .from("household_settings")
        .select("*")
        .eq("household_id", householdId)
        .single()

      if (!settings) {
        router.push("/onboarding/step-1")
        return
      }

      // Resume logic
      if (settings.onboarding_step > 3) {
        router.push(`/onboarding/step-${settings.onboarding_step}`)
        return
      }

      setKidsAppetite(settings.kids_appetite ?? "medium")
      setPrepPreference(settings.prep_time_preference ?? "standard")
      setRiskLevel(settings.risk_level ?? 5)

      setLoading(false)
    }

    load()
  }, [router])

  async function next() {
    if (!householdId) return

    await supabase
      .from("household_settings")
      .update({
        kids_appetite: kidsAppetite,
        prep_time_preference: prepPreference,
        risk_level: riskLevel,
        onboarding_step: 4,
      })
      .eq("household_id", householdId)

    router.push("/onboarding/step-4")
  }

  // Prevent UI from rendering too early
  if (loading) {
    return (
      <div className="pt-20 text-center">
        <h1 className="text-2xl font-semibold">Loading...</h1>
      </div>
    )
  }

  return (
    <div className="pt-10 space-y-10">
      <h1 className="text-4xl font-semibold">Let’s personalise your meal planning</h1>
      <p className="text-gray-600">Tell us a little about your household’s habits.</p>

      <div className="max-w-md mx-auto space-y-10">

        <div className="text-left space-y-2">
          <Label>Kids’ usual appetite</Label>
          <Select value={kidsAppetite} onValueChange={setKidsAppetite}>
            <SelectTrigger>
              <SelectValue placeholder="Select appetite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-left space-y-2">
          <Label>Prep-time preference</Label>
          <Select value={prepPreference} onValueChange={setPrepPreference}>
            <SelectTrigger>
              <SelectValue placeholder="Select prep time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-left space-y-2">
          <Label>How adventurous should your meal plan be?</Label>
          <Slider
            min={0}
            max={10}
            step={1}
            value={[riskLevel]}
            onValueChange={(v) => setRiskLevel(v[0])}
          />
          <p className="text-center text-lg font-medium">{riskLevel}</p>
        </div>

        <Button onClick={next} className="w-full text-lg py-6">
          Continue →
        </Button>
      </div>
    </div>
  )
}
