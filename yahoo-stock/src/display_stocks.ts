// src/displayStocks.ts

import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo, StockRecord, DailyLogEntry } from "./types/stockTypes";

// Set the file path for an optional log file in the "jsonlol" folder.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "displayLog.json");

// Optionally, maintain an in‑memory log.
let displayLog: DailyLogEntry[] = [];

// List of stocks to track.
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

// Object to store the start price for each stock (set once when the run starts).
const startPrices: { [symbol: string]: number } = {};

/**
 * Fetches the latest stock quote for a given symbol.
 * @param symbol - The Yahoo Finance stock symbol.
 * @returns A Promise resolving to a StockQuote or null if an error occurs.
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
 * Helper function that returns the start price as a padded string (12 characters).
 * @param symbol - Stock symbol.
 */
function initialPriceString(symbol: string): string {
  const sp = startPrices[symbol];
  return sp !== undefined ? sp.toFixed(2).padStart(12) : "N/A".padStart(12);
}

/**
 * Writes the display log to a JSON file (optional logging).
 */
function updateDisplayLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(displayLog, null, 2), err => {
    if (err) console.error(chalk.red("Error writing display log file:"), err);
  });
}

/**
 * Fetches all stock quotes and displays all data on every update.
 * The table contains: Company, Symbol, Start Price, Current Price, and % Change.
 * Padding is applied to uncolored strings first, then colors are applied.
 */
async function fetchAndDisplayStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold stock records for logging.
  const recordEntries: StockRecord[] = [];
  // Array to hold formatted rows (one per stock).
  const rowsToPrint: string[] = [];

  // Fetch all stock quotes concurrently.
  const promises = stocks.map(s => fetchStockQuote(s.symbol));
  const results = await Promise.all(promises);

  results.forEach((quote, index) => {
    const stock = stocks[index];
    let price: number | null = null;
    let priceStr = "N/A";
    let curr = "";
    let percentChange: number | null = null;
    let percentChangePlain = "N/A";

    if (quote && quote.regularMarketPrice !== undefined) {
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // Set the start price if not set already.
      if (startPrices[stock.symbol] === undefined) {
        startPrices[stock.symbol] = price;
      }
      const initialPrice = startPrices[stock.symbol];
      percentChange = ((price - initialPrice) / initialPrice) * 100;
      percentChangePlain = percentChange.toFixed(2) + "%";
    }

    // Build a record for the log.
    const record: StockRecord = {
      company: stock.company,
      symbol: stock.symbol,
      price,
      currency: curr,
      percentChange
    };
    recordEntries.push(record);

    // Build uncolored string pieces with padding.
    const companyStr = stock.company.padEnd(22);
    const symbolStr = stock.symbol.padEnd(8);
    const startPriceStr = initialPriceString(stock.symbol); // already padded to 12
    const currentStr = priceStr.padStart(12);
    const percentStr = percentChangePlain.padStart(12);

    // Now apply colors.
    const coloredCompany = chalk.gray(companyStr);
    const coloredSymbol = chalk.yellow(symbolStr);
    const coloredStart = chalk.white(startPriceStr);
    const coloredCurrent = chalk.green(currentStr);
    const coloredPercent =
      percentChange !== null
        ? percentChange > 0
          ? chalk.green(percentStr)
          : percentChange < 0
          ? chalk.red(percentStr)
          : chalk.white(percentStr)
        : chalk.white(percentStr);

    // Build the final line: Company, Symbol, Start Price, Current Price, % Change.
    const row = coloredCompany + coloredSymbol + coloredStart + coloredCurrent + chalk.bold(coloredPercent);
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

  // Print every stock's line.
  rowsToPrint.forEach(row => console.log(row));
}

// Start updating every second.
fetchAndDisplayStockData();
const updateInterval = setInterval(fetchAndDisplayStockData, 1000);

// Handle termination gracefully.
process.on("SIGINT", () => {
  console.log(chalk.red("\nTerminating display..."));
  clearInterval(updateInterval);
  process.exit(0);
});

