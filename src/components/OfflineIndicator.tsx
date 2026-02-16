import { useNetworkStatus } from "../lib/use-network-status";

// Offline indicator component
export function OfflineIndicator() {
  const isOnline = useNetworkStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-indicator">
      <span>⚠️</span>
      <span>No internet connection</span>
    </div>
  );
}
