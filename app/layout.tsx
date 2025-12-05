import type { Metadata } from "next"
import "./globals.css"
import React from "react"

export const metadata: Metadata = {
  title: "Family Meal Planner",
  description: "Smart weekly meal planning for families with young children.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900">
        <header className="w-full bg-white shadow-sm">
          <nav className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <a href="/" className="text-lg font-bold tracking-tight">
              Family Meal Planner
            </a>

            <div className="flex items-center gap-4 text-sm">
              <a href="/dashboard" className="hover:underline">
                Dashboard
              </a>
              <a href="/meals" className="hover:underline">
                Meals
              </a>
              <a href="/settings" className="hover:underline">
                Settings
              </a>
              <a href="/login" className="hover:underline">
                Login
              </a>
            </div>
          </nav>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
