// Represents a quote from the Yahoo Finance API.
export interface StockQuote {
  symbol: string;
  longName?: string;
  regularMarketPrice?: number;
  currency?: string;
}

// Basic information about a stock that you want to track.
export interface StockInfo {
  company: string;
  symbol: string;
}

// A record for one update of stock data.
export interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; // Computed relative to the start price.
}

// A daily log entry which contains a timestamp and a list of stock records.
export interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for each update.
  stocks: StockRecord[];
}

// Used for printing two lines per stock (if desired).
export interface StockRow {
  firstLine: string;
  secondLine: string;
}

