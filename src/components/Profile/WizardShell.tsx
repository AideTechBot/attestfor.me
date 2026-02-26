interface WizardShellProps {
  title: string;
  titleId?: string;
  onCancel: () => void;
  children: React.ReactNode;
}

/**
 * Shared outer chrome for the Add Proof and Add Key wizards:
 * a header bar with a title + × button, and a padded content area.
 */
export function WizardShell({
  title,
  titleId,
  onCancel,
  children,
}: WizardShellProps) {
  return (
    <div className="border border-surface-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span id={titleId} className="text-sm font-semibold text-accent">
          {title}
        </span>
        <button
          onClick={onCancel}
          className="text-muted hover:text-white transition-colors text-lg leading-none"
          aria-label="Cancel"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="p-4">{children}</div>
    </div>
  );
}
