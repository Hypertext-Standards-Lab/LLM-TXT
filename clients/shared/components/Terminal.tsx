/**
 * LLM-TXT Terminal Components
 * US Graphics × Rams × YSL Design System
 */

import { useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes, type FormHTMLAttributes } from "react";

/* ==============================================
   TERMINAL CONTAINER
   ============================================== */

export function Terminal({ children }: { children: ReactNode }) {
  return <div className="terminal">{children}</div>;
}

/* ==============================================
   GENERATIVE HEADER PATTERN
   Vertical lines with random spacing, seeded by timestamp
   ============================================== */

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function generateLines(seed: number): number[] {
  const rand = seededRandom(seed);
  const lines: number[] = [];
  let x = 0;

  while (x < 100) {
    lines.push(x);
    // Random gap between 1 and 4 units
    x += 1 + rand() * 3;
  }

  return lines;
}

// Store seed at module level to persist across re-renders but reset on hard reload
let globalSeed: number | null = null;

export function GenerativePattern() {
  const [lines] = useState(() => {
    if (globalSeed === null) {
      globalSeed = Date.now();
    }
    return generateLines(globalSeed);
  });

  return (
    <div className="terminal-pattern" aria-hidden="true">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none">
        {lines.map((x, i) => (
          <line key={i} x1={x} y1="0" x2={x} y2="24" />
        ))}
      </svg>
    </div>
  );
}

// Keep for backwards compat
export function TerminalBarcode() {
  return <GenerativePattern />;
}

/* ==============================================
   HEADER
   ============================================== */

interface TerminalHeaderProps {
  title: string;
  subtitle: string;
}

export function TerminalHeader({ title, subtitle }: TerminalHeaderProps) {
  return (
    <header className="terminal-header">
      <h1 className="terminal-title">{title}</h1>
      <p className="terminal-subtitle">{subtitle}</p>
    </header>
  );
}

/* ==============================================
   SECTION
   ============================================== */

interface TerminalSectionProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TerminalSection({ title, actions, children, className = "" }: TerminalSectionProps) {
  return (
    <section className={`terminal-section ${className}`}>
      {title && (
        <div className="terminal-section-header">
          <span>{title}</span>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/* ==============================================
   ROW (Label + Value)
   ============================================== */

interface TerminalRowProps {
  label: string;
  children: ReactNode;
}

export function TerminalRow({ label, children }: TerminalRowProps) {
  return (
    <div className="terminal-row">
      <span className="terminal-label">{label}</span>
      <div className="terminal-value">{children}</div>
    </div>
  );
}

/* ==============================================
   VALUE DISPLAYS
   ============================================== */

type ValueVariant = "default" | "mono" | "success" | "warning" | "error" | "processing";

interface TerminalValueProps {
  variant?: ValueVariant;
  children: ReactNode;
}

export function TerminalValue({ variant = "default", children }: TerminalValueProps) {
  const className = variant === "default" ? "" : `terminal-value--${variant}`;
  return <span className={className}>{children}</span>;
}

/* ==============================================
   PROGRESS BAR (Dithered)
   ============================================== */

interface TerminalProgressProps {
  value: number; // 0-100
  loading?: boolean;
  indeterminate?: boolean;
}

export function TerminalProgress({ value, loading = false, indeterminate = false }: TerminalProgressProps) {
  const modifierClass = indeterminate
    ? "terminal-progress--indeterminate"
    : loading
    ? "terminal-progress--loading"
    : "";

  return (
    <div className={`terminal-progress ${modifierClass}`} role="progressbar" aria-valuenow={value}>
      <div
        className="terminal-progress-fill"
        style={{ width: indeterminate ? undefined : `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* ==============================================
   LOADING INDICATOR
   ============================================== */

interface TerminalLoadingProps {
  text?: string;
}

export function TerminalLoading({ text = "Processing..." }: TerminalLoadingProps) {
  return (
    <div className="terminal-loading">
      <div className="terminal-loading-bar" />
      <span>{text}</span>
    </div>
  );
}

/* ==============================================
   FORM
   ============================================== */

export function TerminalForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className="terminal-form" {...props}>
      {children}
    </form>
  );
}

/* ==============================================
   INPUT
   ============================================== */

interface TerminalInputProps extends InputHTMLAttributes<HTMLInputElement> {
  small?: boolean;
}

export function TerminalInput({ small = false, className = "", ...props }: TerminalInputProps) {
  return (
    <input
      className={`terminal-input ${small ? "terminal-input--sm" : ""} ${className}`}
      autoComplete="off"
      spellCheck={false}
      {...props}
    />
  );
}

/* ==============================================
   SELECT
   ============================================== */

interface TerminalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  small?: boolean;
}

export function TerminalSelect({ small = false, className = "", children, ...props }: TerminalSelectProps) {
  return (
    <select
      className={`terminal-input ${small ? "terminal-input--sm" : ""} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

/* ==============================================
   CHECKBOX OPTIONS
   ============================================== */

interface TerminalOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function TerminalOption({ label, checked, onChange, disabled = false }: TerminalOptionProps) {
  return (
    <label className={`terminal-option ${disabled ? "terminal-option--disabled" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}

export function TerminalOptions({ children }: { children: ReactNode }) {
  return <div className="terminal-options">{children}</div>;
}

/* ==============================================
   BUTTONS
   ============================================== */

interface TerminalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "sm" | "ghost";
}

export function TerminalButton({ variant = "default", className = "", children, ...props }: TerminalButtonProps) {
  const variantClass = variant === "default" ? "" : `terminal-btn--${variant}`;
  return (
    <button className={`terminal-btn ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ==============================================
   OUTPUT SECTION
   ============================================== */

interface TerminalOutputProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function TerminalOutput({ title = "OUTPUT", actions, children }: TerminalOutputProps) {
  return (
    <section className="terminal-section terminal-output">
      <div className="terminal-section-header">
        <span>{title}</span>
        {actions && <div className="terminal-output-actions">{actions}</div>}
      </div>
      <div className="terminal-output-window">
        <pre className="terminal-output-content">{children}</pre>
      </div>
    </section>
  );
}

/* ==============================================
   OUTPUT STATE COMPONENTS
   ============================================== */

export function OutputIdle({ children }: { children: ReactNode }) {
  return <span className="terminal-output-idle">{children}</span>;
}

export function OutputLoading({ children }: { children: ReactNode }) {
  return <span className="terminal-output-loading">{children}</span>;
}

export function OutputError({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="terminal-output-error">
      {children}
      {hint && <span className="terminal-output-hint">{hint}</span>}
    </div>
  );
}

export function OutputSuccess({ children }: { children: ReactNode }) {
  return <div className="terminal-output-success">{children}</div>;
}

export function OutputFooter({ children }: { children: ReactNode }) {
  return <div className="terminal-output-footer">{children}</div>;
}

/* ==============================================
   FOOTER
   ============================================== */

interface FooterLink {
  label: string;
  href: string;
}

interface TerminalFooterProps {
  links: FooterLink[];
}

export function TerminalFooter({ links }: TerminalFooterProps) {
  return (
    <footer className="terminal-footer">
      {links.map((link, i) => (
        <span key={link.href}>
          {i > 0 && <span className="terminal-footer-sep">·</span>}
          <a href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        </span>
      ))}
    </footer>
  );
}

/* ==============================================
   WALLET DISPLAY
   ============================================== */

interface WalletDisplayProps {
  address: string;
  onDisconnect: () => void;
}

export function WalletDisplay({ address, onDisconnect }: WalletDisplayProps) {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
  return (
    <>
      <span className="terminal-value--mono">{truncated}</span>
      <TerminalButton variant="ghost" onClick={onDisconnect}>
        DISCONNECT
      </TerminalButton>
    </>
  );
}

/* ==============================================
   STATUS BADGE
   ============================================== */

type StatusType = "ready" | "processing" | "complete" | "error";

interface StatusBadgeProps {
  status: StatusType;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const labels: Record<StatusType, string> = {
    ready: "READY",
    processing: "PROCESSING",
    complete: "COMPLETE",
    error: "ERROR",
  };

  const variant: Record<StatusType, ValueVariant> = {
    ready: "default",
    processing: "processing",
    complete: "success",
    error: "error",
  };

  return <TerminalValue variant={variant[status]}>{labels[status]}</TerminalValue>;
}

/* ==============================================
   COST DISPLAY
   ============================================== */

interface CostDisplayProps {
  loading?: boolean;
  isFree?: boolean;
  price?: string;
}

export function CostDisplay({ loading = false, isFree, price }: CostDisplayProps) {
  if (loading) {
    return <span className="terminal-value--mono">...</span>;
  }

  if (isFree) {
    return <TerminalValue variant="success">FREE</TerminalValue>;
  }

  if (price) {
    return <TerminalValue variant="warning">{price}</TerminalValue>;
  }

  return <span>—</span>;
}
