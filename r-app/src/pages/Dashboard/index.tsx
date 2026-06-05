import { HealthOverview } from "./_components/HealthOverview";
import { ProxyControl } from "./_components/ProxyControl";

export function Dashboard() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] font-medium tracking-[0.06em] text-ink-secondary uppercase">
          Dashboard
        </span>
        <h1 className="text-2xl font-light tracking-tight">仪表盘</h1>
      </header>

      <ProxyControl />
      <HealthOverview />
    </div>
  );
}
