import { AppIcon } from "@/components/app-icon";

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-white px-8 py-7 shadow-sm">
        <AppIcon icon="svg-spinners:180-ring" className="size-8 text-primary" />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
