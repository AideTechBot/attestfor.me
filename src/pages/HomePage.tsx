export function HomePage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      {/* Header with Login */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4rem",
        }}
      >
        <div />
        <button
          style={{
            padding: "0.5rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #646cff",
            background: "transparent",
            color: "#646cff",
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </header>

      {/* Centered Logo and Tagline */}
      <div style={{ textAlign: "center", marginBottom: "4rem" }}>
        <h1 style={{ fontSize: "4rem", margin: "0 0 1rem 0" }}>
          ATtest for me!
        </h1>
        <p style={{ fontSize: "1.5rem", color: "#888", margin: "0 0 2rem 0" }}>
          Your tagline goes here
        </p>
      </div>

      {/* Explanation */}
      <div style={{ maxWidth: "800px", margin: "0 auto 3rem" }}>
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
          What is this?
        </h2>
        <p
          style={{
            textAlign: "center",
            lineHeight: "1.6",
            color: "#bbb",
            marginBottom: "2rem",
          }}
        >
          This is a platform where you can search for and discover amazing
          things. Our service helps you find exactly what you're looking for
          with powerful search capabilities and a clean, modern interface.
        </p>
      </div>

      {/* Search Bar */}
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.5rem",
            border: "1px solid #444",
            borderRadius: "8px",
            background: "#1a1a1a",
          }}
        >
          <input
            type="text"
            placeholder="Search..."
            style={{
              flex: 1,
              padding: "0.75rem",
              background: "transparent",
              border: "none",
              color: "white",
              outline: "none",
              fontSize: "1rem",
            }}
          />
          <button
            style={{
              padding: "0.75rem 2rem",
              background: "#646cff",
              border: "none",
              borderRadius: "6px",
              color: "white",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}
