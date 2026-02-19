interface StatusBarProps {
  lastUpdate: string | null;
}

export function StatusBar({ lastUpdate }: StatusBarProps) {
  const formattedDate = lastUpdate
    ? lastUpdate.replace(/-/g, '.').replace(/T.*/g, '')
    : null;

  return (
    <div className="bg-amber-500 px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-semibold tracking-wider uppercase">
          ⚠ OFFLINE MODE ACTIVE
        </span>
      </div>
      {formattedDate && (
        <p className="text-amber-100 text-xs mt-0.5 tracking-wider uppercase">
          LAST UPDATE: {formattedDate}
        </p>
      )}
    </div>
  );
}
