import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/ui-strings";

export function HomePage() {
  return (
    <>
      {/* Centered Logo and Tagline */}
      <div className="text-center mb-8 shrink-0">
        <h1 className="text-5xl font-bold text-accent m-0 mb-2">
          {SITE.name}
        </h1>
        <p className="text-xl text-muted m-0">
          Your accounts, proven to be{" "}
          <i>
            <b>yours.</b>
          </i>
        </p>
      </div>

      {/* Explanation */}
      <div className="mb-8">
        <h2 className="text-center mb-3 text-lg">{SITE.whatIsThis}</h2>
        <p className="text-center leading-relaxed text-muted text-sm m-0">
          {SITE.name} is a link page for your online accounts, like Linktree,
          but every account listed is{" "}
          <strong className="text-foreground">
            {SITE.cryptographicallyVerified}
          </strong>{" "}
          to actually belong to you. No one can fake or tamper with the
          connections between your identity and your accounts.
        </p>
        <p className="text-center leading-relaxed text-muted text-sm mt-2 m-0">
          {SITE.descriptionCta}
        </p>
        <p className="text-center mt-4 m-0">
          <Link
            to="/faq"
            className="text-xs text-accent hover:text-accent-hover transition-colors"
          >
            {SITE.howItWorks}{" "}
            <ArrowRight className="w-3 h-3 inline" />
          </Link>
        </p>
      </div>
    </>
  );
}
