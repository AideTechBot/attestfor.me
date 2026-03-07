import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { MISC, NAV } from "@/lib/ui-strings";

export function NotFoundContent() {
  return (
    <div className="flex-1 w-full flex flex-col items-center text-center">
      <h1 className="text-7xl font-bold text-accent m-0 mb-2">{MISC.notFound}</h1>
      <p className="text-lg text-muted m-0 mb-8">{MISC.pageNotFound}</p>
      <Link
        to="/"
        className="text-accent hover:text-accent-hover transition-colors inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {NAV.backToHome}
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return <NotFoundContent />;
}
