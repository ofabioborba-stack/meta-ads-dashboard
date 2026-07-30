import { AlertTriangle } from "lucide-react";

export default function AlertBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger">
      <AlertTriangle size={12} />
      Saldo baixo
    </span>
  );
}
