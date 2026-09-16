import { useId, useState, type ReactNode } from 'react';

import { IconChevron } from './icons';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Section({
  title,
  children,
  aside,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-line-soft last:border-b-0">
      <header className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-semibold tracking-wide text-muted uppercase hover:text-ink"
        >
          <IconChevron width={12} height={12} className={cx('transition-transform', open && 'rotate-90')} />
          {title}
        </button>
        {aside}
      </header>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center gap-3 py-1">
      <span className="w-20 shrink-0 text-[12px] text-muted" title={hint}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cx(
        'flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors',
        checked ? 'text-ink' : 'text-dim hover:text-muted',
      )}
    >
      <span
        className={cx(
          'relative h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-accent/80' : 'bg-raised',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all',
            checked ? 'left-3.5' : 'left-0.5 bg-dim',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12px] hover:bg-elevated">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--color-accent)]"
      />
      <span className={checked ? 'text-ink' : 'text-muted'}>{label}</span>
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-raised accent-[var(--color-accent)]"
      />
      <output htmlFor={id} className="w-14 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums">
        {format ? format(value) : value}
      </output>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-line bg-elevated p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded px-2 py-0.5 text-[11px] transition-colors',
            option.value === value ? 'bg-raised text-ink' : 'text-dim hover:text-muted',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'ok' }) {
  const tones = {
    neutral: 'border-line bg-elevated text-muted',
    accent: 'border-accent/40 bg-accent/10 text-accent',
    warn: 'border-active/40 bg-active/10 text-active',
    ok: 'border-ok/40 bg-ok/10 text-ok',
  } as const;

  return (
    <span className={cx('rounded border px-1.5 py-px font-mono text-[10px] leading-4 whitespace-nowrap', tones[tone])}>
      {children}
    </span>
  );
}

export function ToolButton({
  children,
  onClick,
  title,
  active,
  disabled,
  tone = 'ghost',
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  tone?: 'ghost' | 'solid';
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'solid'
          ? 'bg-accent/15 text-accent hover:bg-accent/25'
          : active
            ? 'bg-raised text-accent'
            : 'text-muted hover:bg-elevated hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-[13px] text-muted">{title}</p>
      {hint ? <p className="max-w-80 text-[12px] text-dim">{hint}</p> : null}
      {action}
    </div>
  );
}

export function KeyValue({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-0.5">
      <span className="w-24 shrink-0 text-[11px] text-dim">{label}</span>
      <span className={cx('min-w-0 flex-1 break-all text-[12px] text-ink', mono && 'font-mono text-[11px]')}>{value}</span>
    </div>
  );
}
