
import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo, StockRecord, DailyLogEntry } from "./types/stockTypes";

// File path for the daily log (if you wish to log as well; optional).
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "displayLog.json");

// You can maintain an in‑memory log or simply display without logging.
let displayLog: DailyLogEntry[] = [];

// List of stocks to track. (Same as before, but you can also add extra ones if desired.)
const stocks: StockInfo[] = [
  { company: "ATOSS SOFTWARE SE", symbol: "AOF.DE" },
  { company: "ENVAR", symbol: "ENVAR.ST" },
  { company: "Intel", symbol: "INTC" },
  { company: "INVISIO", symbol: "IVSO.ST" },
  { company: "Ovzon", symbol: "OVZON.ST" },
  { company: "Star Vault B", symbol: "STVA-B.ST" },
  { company: "Telenor", symbol: "TEL.OL" },
  { company: "SKF", symbol: "SKF-B.ST" },
  { company: "NASDAQ| Bitcoin Depot A", symbol: "BTC-USD" },
  { company: "Nvidia", symbol: "NVDA" },
  { company: "ASUS", symbol: "2357.TW" },
  { company: "Hexagon AB", symbol: "HEXA.ST" }
];

// Object to store the start price for each stock (once set at the first update).
const startPrices: { [symbol: string]: number } = {};

/**
 * Fetches the latest stock quote for a given symbol.
 * @param symbol - The Yahoo Finance stock symbol.
 * @returns A Promise that resolves to a StockQuote, or null if an error occurs.
 */
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const quote: StockQuote = await yahooFinance.quote(symbol);
    return quote;
  } catch (error) {
    console.error(chalk.red(`Error fetching ${symbol}:`), error);
    return null;
  }
}

/**
 * Helper function to return a formatted string for the start price.
 * @param symbol - Stock symbol.
 */
function initialPriceString(symbol: string): string {
  const sp = startPrices[symbol];
  return sp !== undefined ? sp.toFixed(2).padStart(12) : "N/A".padStart(12);
}

/**
 * Writes the display log to a JSON file.
 */
function updateDisplayLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(displayLog, null, 2), err => {
    if (err) console.error(chalk.red("Error writing display log file:"), err);
  });
}

/**
 * Fetches all stock quotes and displays all data even if there’s no change.
 * This version prints every stock’s data on every update.
 */
async function fetchAndDisplayStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold stock records for logging.
  const recordEntries: StockRecord[] = [];

  // Array to hold formatted rows (one per stock) for printing.
  const rowsToPrint: string[] = [];

  // Fetch all stock quotes concurrently.
  const promises = stocks.map(s => fetchStockQuote(s.symbol));
  const results = await Promise.all(promises);

  // Process the results.
  results.forEach((quote, index) => {
    const stock = stocks[index];
    let price: number | null = null;
    let priceStr = "N/A";
    let curr = "";
    let percentChange: number | null = null;
    let percentChangeStr = "N/A";

    if (quote && quote.regularMarketPrice !== undefined) {
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // Set and/or record the start price.
      if (startPrices[stock.symbol] === undefined) {
        startPrices[stock.symbol] = price;
      }
      const initialPrice = startPrices[stock.symbol];
      percentChange = ((price - initialPrice) / initialPrice) * 100;
      percentChangeStr =
        percentChange > 0
          ? chalk.green(percentChange.toFixed(2) + "%")
          : percentChange < 0
          ? chalk.red(percentChange.toFixed(2) + "%")
          : chalk.white(percentChange.toFixed(2) + "%");
    }

    // Build a record for logging.
    const record: StockRecord = {
      company: stock.company,
      symbol: stock.symbol,
      price,
      currency: curr,
      percentChange
    };
    recordEntries.push(record);

    // Build a formatted row (single row for each stock).
    const row =
      chalk.gray(stock.company.padEnd(22)) +
      chalk.yellow(stock.symbol.padEnd(8)) +
      chalk.white(initialPriceString(stock.symbol)) +
      chalk.green(priceStr.padStart(12)) +
      chalk.bold(percentChangeStr.padStart(12));
    rowsToPrint.push(row);
  });

  // Append this update to the display log.
  const logEntry: DailyLogEntry = { timestamp: timestampStr, stocks: recordEntries };
  displayLog.push(logEntry);
  updateDisplayLogFile();

  // Print the header.
  console.clear();
  console.log(chalk.blueBright(`\n=== All Stock Data (Updated ${now.toLocaleTimeString()}) ===\n`));
  const header =
    chalk.bold("Company".padEnd(22)) +
    chalk.bold("Symbol".padEnd(8)) +
    chalk.bold("Start Price".padStart(12)) +
    chalk.bold("Current".padStart(12)) +
    chalk.bold("% Change".padStart(12));
  console.log(header);
  console.log(chalk.gray("-".repeat(66)));

  // Print every stock's data.
  rowsToPrint.forEach(row => console.log(row));
}

// Update every 5 seconds (or as desired).
fetchAndDisplayStockData();
const updateInterval = setInterval(fetchAndDisplayStockData, 5000);

// To handle termination gracefully:
process.on("SIGINT", () => {
  console.log(chalk.red("\nTerminating display..."));
  clearInterval(updateInterval);
  process.exit(0);
});
