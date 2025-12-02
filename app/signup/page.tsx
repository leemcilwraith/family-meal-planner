export default function SignupPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Sign up</h1>
      <p>Later this will create a Supabase user and household. For now, it is just a placeholder.</p>

      <form
        style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 320 }}
      >
        <label>
          Household name
          <input
            type="text"
            name="household"
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            name="email"
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            style={{ width: "100%", padding: "0.5rem", borderRadius: 4, border: "1px solid #ccc" }}
          />
        </label>

        <button
          type="button"
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: 4,
            border: "none",
            background: "#111827",
            color: "white",
            cursor: "pointer",
          }}
        >
          Sign up (not wired yet)
        </button>
      </form>
    </main>
  );
}