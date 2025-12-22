export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
