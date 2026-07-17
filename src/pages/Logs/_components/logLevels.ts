/** 视图级日志等级（与后端 tracing Level 文本一致，大写）。 */
export const LOG_LEVELS = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** 捕获等级（后端 set_log_level 接受的小写值）。 */
export const CAPTURE_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

type LevelTone = {
  /** 列表小标签 */
  badge: string;
  /** 行前圆点 */
  dot: string;
  /** 工具栏 chip：未选 / 选中 */
  chipIdle: string;
  chipActive: string;
};

/**
 * 各级视觉色板：ERROR/WARN/INFO 用语义色；
 * DEBUG=sky、TRACE=violet，避免与灰色 muted 混淆。
 */
const LEVEL_TONE: Record<LogLevel, LevelTone> = {
  ERROR: {
    badge: "border-transparent bg-destructive/12 text-destructive",
    dot: "bg-destructive",
    chipIdle: "border-destructive/25 text-destructive/80 hover:bg-destructive/10",
    chipActive: "border-destructive/50 bg-destructive/12 text-destructive",
  },
  WARN: {
    badge: "border-transparent bg-warning/12 text-warning",
    dot: "bg-warning",
    chipIdle: "border-warning/30 text-warning/90 hover:bg-warning/10",
    chipActive: "border-warning/50 bg-warning/12 text-warning",
  },
  INFO: {
    badge: "border-transparent bg-info/12 text-info",
    dot: "bg-info",
    chipIdle: "border-info/30 text-info/90 hover:bg-info/10",
    chipActive: "border-info/50 bg-info/12 text-info",
  },
  DEBUG: {
    badge: "border-transparent bg-sky-500/12 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    chipIdle:
      "border-sky-500/30 text-sky-700/90 hover:bg-sky-500/10 dark:text-sky-300/90",
    chipActive: "border-sky-500/50 bg-sky-500/12 text-sky-700 dark:text-sky-300",
  },
  TRACE: {
    badge:
      "border-transparent bg-violet-500/12 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    chipIdle:
      "border-violet-500/30 text-violet-700/90 hover:bg-violet-500/10 dark:text-violet-300/90",
    chipActive:
      "border-violet-500/50 bg-violet-500/12 text-violet-700 dark:text-violet-300",
  },
};

const FALLBACK_TONE: LevelTone = {
  badge: "border-transparent bg-accent text-muted-foreground",
  dot: "bg-ink-mute",
  chipIdle: "border-edge text-ink-secondary hover:bg-surface-hover",
  chipActive: "border-primary bg-primary/10 text-foreground",
};

function toneOf(level: string): LevelTone {
  return (LEVEL_TONE as Record<string, LevelTone>)[level] ?? FALLBACK_TONE;
}

export function levelBadgeClass(level: string): string {
  return toneOf(level).badge;
}

export function levelDotClass(level: string): string {
  return toneOf(level).dot;
}

export function levelChipClass(level: string, active: boolean): string {
  const tone = toneOf(level);
  return active ? tone.chipActive : tone.chipIdle;
}

/** ALL 筛选 chip（非具体等级）。 */
export function allChipClass(active: boolean): string {
  return active
    ? "border-primary bg-primary/10 text-foreground"
    : "border-edge text-ink-secondary hover:bg-surface-hover";
}
