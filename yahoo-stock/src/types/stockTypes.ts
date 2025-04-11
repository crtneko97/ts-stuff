export interface StockQuote {
  symbol: string;
  longName?: string;
  regularMarketPrice?: number;
  currency?: string;
}

export interface StockInfo {
  company: string;
  symbol: string;
}
