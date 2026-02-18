import { createContext, useContext, useReducer, type ReactNode } from "react";
import type { VerificationResult } from "@/lib/verifiers/base-verifier";

export type VerifyStatus = "idle" | "loading" | "verified" | "failed";

export interface VerificationStep {
  step: string;
  status: "success" | "error" | "pending";
  message: string;
}

export interface ProofVerifyState {
  status: VerifyStatus;
  result: VerificationResult | null;
  steps: VerificationStep[];
}

type VerificationStore = Record<string, ProofVerifyState>;

export type VerificationAction =
  | { type: "VERIFY_START"; uri: string }
  | { type: "VERIFY_STEP"; uri: string; step: VerificationStep }
  | {
      type: "VERIFY_DONE";
      uri: string;
      result: VerificationResult;
      steps: VerificationStep[];
    }
  | { type: "VERIFY_RESET"; uri: string };

const DEFAULT_STATE: ProofVerifyState = {
  status: "idle",
  result: null,
  steps: [],
};

function verificationReducer(
  state: VerificationStore,
  action: VerificationAction,
): VerificationStore {
  switch (action.type) {
    case "VERIFY_START": {
      const prev = state[action.uri] ?? { ...DEFAULT_STATE };
      return {
        ...state,
        [action.uri]: { status: "loading", result: prev.result, steps: [] },
      };
    }
    case "VERIFY_STEP": {
      const current = state[action.uri] ?? { ...DEFAULT_STATE };
      return {
        ...state,
        [action.uri]: {
          ...current,
          steps: [...current.steps, action.step],
        },
      };
    }
    case "VERIFY_DONE":
      return {
        ...state,
        [action.uri]: {
          status: action.result.success ? "verified" : "failed",
          result: action.result,
          steps: action.steps,
        },
      };
    case "VERIFY_RESET":
      return { ...state, [action.uri]: { ...DEFAULT_STATE } };
    default:
      return state;
  }
}

interface VerificationContextValue {
  store: VerificationStore;
  dispatch: React.Dispatch<VerificationAction>;
}

const VerificationContext = createContext<VerificationContextValue | null>(
  null,
);

export function VerificationProvider({ children }: { children: ReactNode }) {
  const [store, dispatch] = useReducer(verificationReducer, {});
  return (
    <VerificationContext.Provider value={{ store, dispatch }}>
      {children}
    </VerificationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVerification(uri: string): ProofVerifyState & {
  dispatch: React.Dispatch<VerificationAction>;
} {
  const ctx = useContext(VerificationContext);
  if (!ctx) {
    throw new Error(
      "useVerification must be used within a VerificationProvider",
    );
  }
  const state = ctx.store[uri] ?? DEFAULT_STATE;
  return { ...state, dispatch: ctx.dispatch };
}

/** Read the VerifyStatus for a list of proof URIs in a single hook call. */
// eslint-disable-next-line react-refresh/only-export-components
export function useVerificationStatuses(uris: string[]): VerifyStatus[] {
  const ctx = useContext(VerificationContext);
  if (!ctx) {
    throw new Error(
      "useVerificationStatuses must be used within a VerificationProvider",
    );
  }
  return uris.map((uri) => ctx.store[uri]?.status ?? "idle");
}
