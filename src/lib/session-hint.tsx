import { createContext, useContext, type ReactNode } from "react";

const SessionHintContext = createContext(false);

export function SessionHintProvider({
  hasSession,
  children,
}: {
  hasSession: boolean;
  children: ReactNode;
}) {
  return (
    <SessionHintContext.Provider value={hasSession}>
      {children}
    </SessionHintContext.Provider>
  );
}

/** Returns true if the user likely has an active session (before the session API responds). */
// eslint-disable-next-line react-refresh/only-export-components
export function useSessionHint(): boolean {
  return useContext(SessionHintContext);
}
