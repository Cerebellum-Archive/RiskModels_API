/**
 * Ticker Aliases — maps common ticker variants to canonical symbols.
 *
 * This aligns with Risk_Models DAL behavior (risk-engine-v3.ts).
 * Aliases are applied BEFORE database lookup.
 */

export const TICKER_ALIASES: Record<string, string> = {
  // Alphabet: GOOGL (Class A) → GOOG (Class C, more liquid)
  GOOGL: "GOOG",
};

/**
 * Resolve a ticker through the alias map.
 * Returns the canonical ticker (uppercase).
 */
export function resolveTickerAlias(ticker: string): string {
  const upper = ticker.toUpperCase();
  return TICKER_ALIASES[upper] ?? upper;
}

/**
 * Resolve an array of tickers through the alias map.
 */
export function resolveTickerAliases(tickers: string[]): string[] {
  return tickers.map(resolveTickerAlias);
}
