"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type Settings = {
  id: string
  household_id: string
  risk_level: number
  prep_time_preference: string
  kids_appetite: string
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      setError(null)
      setMessage(null)

      // 1. Get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        setError("You must be logged in to view settings.")
        setLoading(false)
        return
      }

      const userId = sessionData.session.user.id

      // 2. Get the user's household_id
      const { data: linkData, error: linkError } = await supabase
        .from("user_households")
        .select("household_id")
        .eq("user_id", userId)
        .single()

      if (linkError || !linkData) {
        setError("Could not find your household.")
        setLoading(false)
        return
      }

      const householdId = linkData.household_id

      // 3. Try to load existing household_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("household_settings")
        .select("*")
        .eq("household_id", householdId)
        .single()

      if (settingsError && settingsError.code !== "PGRST116") {
        // PGRST116 = no rows found
        console.error(settingsError)
      }

      if (!settingsData) {
        // 4. If no settings exist yet, create default
        const { data: inserted, error: insertError } = await supabase
          .from("household_settings")
          .insert([
            {
              household_id: householdId,
              risk_level: 5,
              prep_time_preference: "standard",
              kids_appetite: "medium",
            },
          ])
          .select()
          .single()

        if (insertError || !inserted) {
          setError("Could not create default settings.")
          setLoading(false)
          return
        }

        setSettings(inserted as Settings)
      } else {
        setSettings(settingsData as Settings)
      }

      setLoading(false)
    }

    loadSettings()
  }, [])

  async function handleSave() {
    if (!settings) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const { error: updateError } = await supabase
      .from("household_settings")
      .update({
        risk_level: settings.risk_level,
        prep_time_preference: settings.prep_time_preference,
        kids_appetite: settings.kids_appetite,
      })
      .eq("id", settings.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage("Settings saved.")
  }

  if (loading) {
    return <main className="py-10">Loading settings...</main>
  }

  if (error) {
    return (
      <main className="py-10">
        <p className="text-red-600">{error}</p>
      </main>
    )
  }

  if (!settings) {
    return (
      <main className="py-10">
        <p>No settings found.</p>
      </main>
    )
  }

  return (
    <div className="flex justify-center py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Household Settings</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tune how adventurous your family is and how complex the meals should be.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Risk level slider */}
          <div className="space-y-2">
            <Label>Risk level (meal adventurousness)</Label>
            <Slider
              min={0}
              max={10}
              step={1}
              value={[settings.risk_level]}
              onValueChange={(value) =>
                setSettings((prev) => (prev ? { ...prev, risk_level: value[0] } : prev))
              }
            />
            <p className="text-sm text-muted-foreground">
              0 = always stick to safe, green meals. 10 = often introduce new and adventurous meals.
            </p>
            <p className="text-sm font-medium">Current: {settings.risk_level}</p>
          </div>

          {/* Prep time preference */}
          <div className="space-y-2">
            <Label>Prep and cooking time preference</Label>
            <Select
              value={settings.prep_time_preference}
              onValueChange={(value) =>
                setSettings((prev) => (prev ? { ...prev, prep_time_preference: value } : prev))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">Quick meals (busy evenings)</SelectItem>
                <SelectItem value="standard">Standard cooking time</SelectItem>
                <SelectItem value="any">Happy with any</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This helps the planner choose between quick and more involved recipes.
            </p>
          </div>

          {/* Kids appetite size */}
          <div className="space-y-2">
            <Label>Kids appetite size</Label>
            <Select
              value={settings.kids_appetite}
              onValueChange={(value) =>
                setSettings((prev) => (prev ? { ...prev, kids_appetite: value } : prev))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select appetite size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Used later to scale ingredient quantities in shopping lists.
            </p>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
