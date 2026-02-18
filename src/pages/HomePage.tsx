import { Link } from "react-router";

export function HomePage() {
  return (
    <>
      {/* Centered Logo and Tagline */}
      <div className="text-center mb-8 shrink-0">
        <h1 className="text-5xl font-bold text-accent m-0 mb-2">
          ATtestfor.me
        </h1>
        <p className="text-xl text-muted m-0">
          Where we attest for{" "}
          <i>
            <b>you!</b>
          </i>
        </p>
      </div>

      {/* Explanation */}
      <div className="mb-8">
        <h2 className="text-center mb-3 text-lg">What is this?</h2>
        <p className="text-center leading-relaxed text-muted text-sm m-0">
          A way to prove ownership of your various online accounts and share
          your cryptographic keys in a decentralized way using the AT protocol.
        </p>
        <p className="text-center mt-3 m-0">
          <Link
            to="/faq"
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            How does it work? →
          </Link>
        </p>
      </div>
    </>
  );
}
