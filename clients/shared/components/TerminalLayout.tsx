/**
 * LLM-TXT Terminal Layout
 * Shared layout component for all frontend apps
 */

import type { ReactNode } from "react";
import {
  Terminal,
  GenerativePattern,
  TerminalHeader,
  TerminalSection,
  TerminalRow,
  TerminalValue,
  TerminalProgress,
  TerminalLoading,
  TerminalButton,
  TerminalOutput,
  TerminalFooter,
  WalletDisplay,
  StatusBadge,
  CostDisplay,
  OutputIdle,
  OutputError,
  OutputSuccess,
  OutputFooter,
} from "./Terminal";

export interface FooterLink {
  label: string;
  href: string;
}

export interface TerminalLayoutConfig {
  title: string;
  subtitle: string;
  footerLinks: FooterLink[];
  idleText?: string;
  loadingText?: string;
}

export interface TerminalLayoutState {
  isLoading: boolean;
  error: string | null;
  fetchedData: string | null;
  paymentRequired: boolean;
  paymentInfo: { amount: string; network: string } | null;
  copied: boolean;
}

export interface TerminalLayoutWallet {
  isConnected: boolean;
  address: string | undefined;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface TerminalLayoutEstimate {
  loading: boolean;
  isFree?: boolean;
  price?: string;
  hasInput: boolean;
}

export interface TerminalLayoutStats {
  label: string;
  value: string | number;
  formatter?: (value: number) => string;
}

export interface TerminalLayoutActions {
  onCopy: () => void;
  onOpenInTab: () => void;
  onDownload: () => void;
}

export interface TerminalLayoutProps {
  config: TerminalLayoutConfig;
  state: TerminalLayoutState;
  wallet: TerminalLayoutWallet;
  estimate: TerminalLayoutEstimate;
  stats?: TerminalLayoutStats[];
  actions: TerminalLayoutActions;
  queryForm: ReactNode;
}

export function TerminalLayout({
  config,
  state,
  wallet,
  estimate,
  stats = [],
  actions,
  queryForm,
}: TerminalLayoutProps) {
  const getStatus = (): "ready" | "processing" | "complete" | "error" => {
    if (state.isLoading) return "processing";
    if (state.fetchedData) return "complete";
    if (state.error) return "error";
    return "ready";
  };

  return (
    <Terminal>
      <GenerativePattern />

      <TerminalHeader title={config.title} subtitle={config.subtitle} />

      {/* Status Section */}
      <TerminalSection>
        <TerminalRow label="STATUS">
          <StatusBadge status={getStatus()} />
          {state.isLoading && <TerminalProgress value={0} indeterminate />}
        </TerminalRow>

        <TerminalRow label="WALLET">
          {wallet.isConnected && wallet.address ? (
            <WalletDisplay address={wallet.address} onDisconnect={wallet.onDisconnect} />
          ) : (
            <TerminalButton variant="sm" onClick={wallet.onConnect} disabled={wallet.isConnecting}>
              {wallet.isConnecting ? "CONNECTING..." : "CONNECT"}
            </TerminalButton>
          )}
        </TerminalRow>

        {stats.map((stat) => (
          <TerminalRow key={stat.label} label={stat.label}>
            <TerminalValue variant="mono">
              {typeof stat.value === "number"
                ? stat.formatter
                  ? stat.formatter(stat.value)
                  : stat.value.toLocaleString()
                : stat.value}
            </TerminalValue>
          </TerminalRow>
        ))}

        {estimate.hasInput && (
          <TerminalRow label="EST. COST">
            <CostDisplay loading={estimate.loading} isFree={estimate.isFree} price={estimate.price} />
          </TerminalRow>
        )}
      </TerminalSection>

      {/* Query Section */}
      <TerminalSection title="QUERY">{queryForm}</TerminalSection>

      {/* Output Section */}
      <TerminalOutput
        actions={
          state.fetchedData && (
            <>
              <TerminalButton variant="ghost" onClick={actions.onCopy}>
                {state.copied ? "COPIED" : "COPY"}
              </TerminalButton>
              <TerminalButton variant="ghost" onClick={actions.onOpenInTab}>
                OPEN
              </TerminalButton>
              <TerminalButton variant="ghost" onClick={actions.onDownload}>
                SAVE
              </TerminalButton>
            </>
          )
        }
      >
        {state.error && (
          <OutputError
            hint={state.paymentRequired && !wallet.isConnected ? "Connect wallet above to enable payments" : undefined}
          >
            {state.error}
          </OutputError>
        )}
        {state.paymentInfo && (
          <OutputSuccess>
            Payment: {state.paymentInfo.amount} @ {state.paymentInfo.network}
          </OutputSuccess>
        )}
        {state.isLoading && <TerminalLoading text={config.loadingText || "Processing..."} />}
        {!state.isLoading && !state.error && !state.fetchedData && (
          <OutputIdle>{config.idleText || "Awaiting input..."}</OutputIdle>
        )}
        {state.fetchedData && !state.isLoading && (
          <>
            {state.fetchedData}
            <OutputFooter>
              {"────────────────────────────────────────\n"}
              SIZE: {state.fetchedData.length.toLocaleString()} bytes
            </OutputFooter>
          </>
        )}
      </TerminalOutput>

      <TerminalFooter links={config.footerLinks} />
    </Terminal>
  );
}
