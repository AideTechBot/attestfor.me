import { useState } from "react";
import { PenLine, ShieldCheck } from "lucide-react";
import { SignForm } from "@/components/SignVerify/SignForm";
import { VerifyForm } from "@/components/SignVerify/VerifyForm";

type Tab = "sign" | "verify";

export function SignVerifyPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sign");

  return (
    <>
      <div className="text-center mb-6 shrink-0">
        <h1 className="text-3xl font-bold text-accent m-0 mb-2">
          PGP Sign &amp; Verify
        </h1>
        <p className="text-sm text-muted m-0">
          Sign messages and verify signatures entirely in your browser.
          <br />
          Your private key never leaves your device.
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-0 rounded border border-surface-border mb-6 overflow-hidden">
        <button
          onClick={() => setActiveTab("sign")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "sign"
              ? "bg-accent text-white"
              : "text-muted hover:text-white hover:bg-surface"
          }`}
        >
          <PenLine className="h-4 w-4" />
          Sign
        </button>
        <button
          onClick={() => setActiveTab("verify")}
          className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "verify"
              ? "bg-accent text-white"
              : "text-muted hover:text-white hover:bg-surface"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Verify
        </button>
      </div>

      {activeTab === "sign" ? <SignForm /> : <VerifyForm />}
    </>
  );
}
