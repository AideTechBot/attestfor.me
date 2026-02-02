import { PageLayout } from "../components/PageLayout";

export function HomePage() {
  return (
    <PageLayout>
      {/* Centered Logo and Tagline */}
      <div className="text-center mb-8 shrink-0">
        <h1 className="text-5xl font-bold text-accent m-0 mb-2">
          ATtest for me!
        </h1>
        <p className="text-xl text-muted m-0">Your tagline goes here</p>
      </div>

      {/* Explanation */}
      <div className="mb-8">
        <h2 className="text-center mb-3 text-lg">What is this?</h2>
        <p className="text-center leading-relaxed text-muted text-sm m-0">
          This is a platform where you can search for and discover amazing
          things. Our service helps you find exactly what you're looking for
          with powerful search capabilities and a clean, modern interface.
        </p>
      </div>
    </PageLayout>
  );
}
