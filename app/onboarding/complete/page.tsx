"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"

export default function OnboardingComplete() {
  const router = useRouter()

  useEffect(() => {
    async function markComplete() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        router.push("/login")
        return
      }

      // Get household ID
      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .maybeSingle()

      const householdId = link?.household_id
      if (!householdId) {
        console.error("No household found for user — redirecting to step-1")
        router.push("/onboarding/step-1")
        return
      }

      // Update onboarding step
      const { error } = await supabase
        .from("household_settings")
        .update({ onboarding_step: 99 })
        .eq("household_id", householdId)

      if (error) console.error("Failed to update onboarding step", error)
    }

    markComplete()
  }, [router])

  return (
    <div className="text-center space-y-6 pt-20">
      <h1 className="text-4xl font-bold">🎉 Setup Complete!</h1>
      <p className="text-gray-600 text-lg">
        Your household is ready. You can now start planning your weekly meals.
      </p>

      <Button className="text-lg py-6" onClick={() => router.push("/dashboard")}>
        Go to Dashboard →
      </Button>
    </div>
  )
}
