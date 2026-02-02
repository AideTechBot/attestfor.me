import "./HomePage.css";

export function HomePage() {
  return (
    <div className="home-page">
      {/* Header with Login */}
      <header className="home-header">
        <div />
        <button className="login-button">Login</button>
      </header>

      {/* Centered Logo and Tagline */}
      <div className="home-hero">
        <h1 className="home-title">ATtest for me!</h1>
        <p className="home-tagline">Your tagline goes here</p>
      </div>

      {/* Explanation */}
      <div className="home-explanation">
        <h2>What is this?</h2>
        <p>
          This is a platform where you can search for and discover amazing
          things. Our service helps you find exactly what you're looking for
          with powerful search capabilities and a clean, modern interface.
        </p>
      </div>

      {/* Search Bar */}
      <div className="search-wrapper">
        <div className="search-bar">
          <input type="text" placeholder="Search..." className="search-input" />
          <button className="search-button">Search</button>
        </div>
      </div>
    </div>
  );
}
