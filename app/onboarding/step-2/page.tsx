"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Step2() {
  const router = useRouter()

  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Get session
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        router.push("/login")
        return
      }

      // Get household
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

      // Load settings
      const { data: settings } = await supabase
        .from("household_settings")
        .select("*")
        .eq("household_id", householdId)
        .single()

      if (!settings) {
        console.warn("No household settings found — redirecting to step 1")
        router.push("/onboarding/step-1")
        return
      }

      // Resume logic
      if (settings.onboarding_step > 2) {
        router.push(`/onboarding/step-${settings.onboarding_step}`)
        return
      }

      // Populate fields
      setAdults(settings.adults ?? 2)
      setChildren(settings.children ?? 1)

      setLoading(false)
    }

    load()
  }, [router])

  // ❗ Prevent rendering form until settings are loaded
  if (loading) {
    return (
      <div className="pt-20 text-center">
        <h1 className="text-2xl font-semibold">Loading...</h1>
      </div>
    )
  }

  // Submit handler
  async function next() {
    if (!householdId) return

    await supabase
      .from("household_settings")
      .update({ adults, children, onboarding_step: 3 })
      .eq("household_id", householdId)

    router.push("/onboarding/step-3")
  }

  return (
    <div className="pt-10 space-y-10">
      <h1 className="text-4xl font-semibold">Who’s in your household?</h1>
      <p className="text-gray-600">This helps us scale portion sizes.</p>

      <div className="space-y-6 max-w-md mx-auto text-left">
        <div>
          <Label>Number of adults</Label>
          <Input
            type="number"
            min={1}
            max={4}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
          />
        </div>

        <div>
          <Label>Number of children</Label>
          <Input
            type="number"
            min={0}
            max={6}
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
          />
        </div>

        <Button onClick={next} className="w-full text-lg py-6">
          Continue →
        </Button>
      </div>
    </div>
  )
}
