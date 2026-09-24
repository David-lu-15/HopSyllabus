import { EVENT_TYPE_CHIP, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, type EventType } from "@/lib/types";

export function TypeChip({ type, className = "" }: { type: EventType; className?: string }) {
  return (
    <span className={`chip ${EVENT_TYPE_CHIP[type]} ${className}`}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: EVENT_TYPE_COLORS[type] }}
        aria-hidden="true"
      />
      {EVENT_TYPE_LABELS[type]}
    </span>
  );
}

export function TypeDot({ type, className = "" }: { type: EventType; className?: string }) {
  return (
    <span
      className={`size-2 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: EVENT_TYPE_COLORS[type] }}
      title={EVENT_TYPE_LABELS[type]}
      aria-hidden="true"
    />
  );
}
