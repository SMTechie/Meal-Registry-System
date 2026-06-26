import { AppIcon } from "@/components/app-icon";
import { cn } from "@/lib/utils";

export function PageAlert({
  type,
  children
}: {
  type: "success" | "error" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800"
  };
  const icons = {
    success: "solar:check-circle-bold-duotone",
    error: "solar:danger-triangle-bold-duotone",
    info: "solar:info-circle-bold-duotone"
  };

  return (
    <div className={cn("mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm", styles[type])}>
      <AppIcon icon={icons[type]} className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
