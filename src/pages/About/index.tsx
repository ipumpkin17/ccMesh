import { AppInfoSection } from "./_components/AppInfoSection";
import { LocalEnvCheck } from "./_components/LocalEnvCheck";

export function About() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-light tracking-tight text-ink-primary">关于</h1>
      </header>
      <AppInfoSection />
      <LocalEnvCheck />
    </div>
  );
}
