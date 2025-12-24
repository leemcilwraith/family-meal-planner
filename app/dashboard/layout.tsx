"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { ReactNode } from "react"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6 space-y-6">
        <h2 className="text-2xl font-semibold">Meal Planner</h2>

        <nav className="space-y-4">
          <Link href="/dashboard" className="block text-gray-700 hover:text-black">
            🏠 Dashboard
          </Link>

          <Link href="/dashboard/food-preferences" className="block text-gray-700 hover:text-black">
            🍽 Food Preferences
          </Link>

          <Link href="/dashboard/planner" className="block text-gray-700 hover:text-black">
            📅 Weekly Planner
          </Link>

          <Link href="/dashboard/shopping-list" className="block text-gray-700 hover:text-black">
            📅 Shopping List
          </Link>


          <Link href="/dashboard/settings" className="block text-gray-700 hover:text-black">
            ⚙ Household Settings
          </Link>
        </nav>

        <button
          onClick={logout}
          className="mt-10 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-10">{children}</main>
    </div>
  )
}
