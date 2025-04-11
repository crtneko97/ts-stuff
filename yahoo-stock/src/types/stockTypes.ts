
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

export interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; }

export interface DailyLogEntry {
  timestamp: string;
  stocks: StockRecord[];
}

export interface StockRow {
  firstLine: string;
  secondLine: string;
}

export interface SymbolStats {
  company: string;
  symbol: string;
  sum: number;
  count: number;
  min: number;
  minTime: string;
  max: number;
  maxTime: string;
}

