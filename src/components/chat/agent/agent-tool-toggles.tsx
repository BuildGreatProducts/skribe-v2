"use client";

interface AgentToolTogglesProps {
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
  codebaseEnabled: boolean;
  onCodebaseChange: (enabled: boolean) => void;
  githubConnected: boolean;
  repoLinked: boolean;
}

export function AgentToolToggles({
  webSearchEnabled,
  onWebSearchChange,
  codebaseEnabled,
  onCodebaseChange,
  githubConnected,
  repoLinked,
}: AgentToolTogglesProps) {
  const codebaseDisabled = !githubConnected || !repoLinked;
  const codebaseDisabledReason = !githubConnected
    ? "Connect GitHub in settings to enable"
    : !repoLinked
      ? "Link a repository to this project to enable"
      : "";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">AI Tools</p>
      <div className="space-y-2">
        {/* Web Search Toggle */}
        <label className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E8F5FF]">
              <GlobeIcon className="h-3.5 w-3.5 text-[#6BA3C4]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Web Search</p>
              <p className="text-xs text-muted-foreground">
                Search the web for current information
              </p>
            </div>
          </div>
          <Toggle
            enabled={webSearchEnabled}
            onChange={onWebSearchChange}
          />
        </label>

        {/* Codebase Access Toggle */}
        <label
          className={`flex items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors ${
            codebaseDisabled
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EDE8FF]">
              <CodeIcon className="h-3.5 w-3.5 text-[#8B7DC4]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Codebase Access
              </p>
              <p className="text-xs text-muted-foreground">
                {codebaseDisabled
                  ? codebaseDisabledReason
                  : "Read your connected GitHub repository"}
              </p>
            </div>
          </div>
          <Toggle
            enabled={codebaseEnabled}
            onChange={onCodebaseChange}
            disabled={codebaseDisabled}
          />
        </label>
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) {
          onChange(!enabled);
        }
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        disabled
          ? "cursor-not-allowed bg-muted"
          : enabled
            ? "cursor-pointer bg-primary"
            : "cursor-pointer bg-muted-foreground/30"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
