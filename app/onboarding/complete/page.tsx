"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabaseClient"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Complete() {
  const router = useRouter()

  useEffect(() => {
    async function markComplete() {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      const { data: link } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", user.id)
        .single()

      await supabase
        .from("household_settings")
        .update({ onboarding_step: 99 })
        .eq("household_id", link.household_id)
    }

    markComplete()
  }, [])

  return (
    <div className="space-y-10 pt-20 text-center">
      <h1 className="text-4xl font-semibold">Your household is ready 🎉</h1>

      <p className="text-gray-600 max-w-md mx-auto text-lg">
        Your meal preferences and reliable foods are now saved.
        You're ready to generate personalised meal plans!
      </p>

      <Button
        onClick={() => router.push("/dashboard")}
        className="text-lg py-6 px-10 mt-4"
      >
        Go to Dashboard →
      </Button>
    </div>
  )
}
