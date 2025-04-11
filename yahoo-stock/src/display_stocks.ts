// src/displayStocks.ts

import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo, StockRecord, DailyLogEntry } from "./types/stockTypes";
import { stocks } from "./stock_list";
// Set the file path for the optional display log in the "jsonlol" folder.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "displayLog.json");

// In‑memory display log (if you wish to log updates).
let displayLog: DailyLogEntry[] = [];

// Object to store the start price for each stock (set once when the run starts).
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
 * Helper function to return the start price as a plain padded string (12 characters).
 * @param symbol - The stock symbol.
 */
function initialPriceString(symbol: string): string {
  const sp = startPrices[symbol];
  return sp !== undefined ? sp.toFixed(2).padStart(12) : "N/A".padStart(12);
}

/**
 * Writes the display log to a JSON file (if needed).
 */
function updateDisplayLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(displayLog, null, 2), err => {
    if (err) console.error(chalk.red("Error writing display log file:"), err);
  });
}

/**
 * Fetches all stock quotes and displays all data (regardless of change).
 * The table includes: Company, Symbol, Start Price, Current Price, % Change.
 * Padding is applied to uncolored strings, then colors are applied.
 */
async function fetchAndDisplayStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold stock records for logging.
  const recordEntries: StockRecord[] = [];
  // Array to hold formatted rows (one per stock) for display.
  const rowsToPrint: string[] = [];

  // Fetch all stock quotes concurrently.
  const promises = stocks.map(s => fetchStockQuote(s.symbol));
  const results = await Promise.all(promises);

  // Process each result.
  results.forEach((quote, index) => {
    const stock = stocks[index];
    let price: number | null = null;
    let priceStr = "N/A"; // Current price as string.
    let curr = "";
    let percentChange: number | null = null;
    let percentChangePlain = "N/A";

    if (quote && quote.regularMarketPrice !== undefined) {
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // Record start price if not set.
      if (startPrices[stock.symbol] === undefined) {
        startPrices[stock.symbol] = price;
      }
      const initialPrice = startPrices[stock.symbol];
      percentChange = ((price - initialPrice) / initialPrice) * 100;
      percentChangePlain = percentChange.toFixed(2) + "%";
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

    // Build plain (uncolored) pieces with padding.
    const companyStr = stock.company.padEnd(22);
    const symbolStr = stock.symbol.padEnd(8);
    const startPriceStr = initialPriceString(stock.symbol); // Already padded to 12.
    const currentStr = priceStr.padStart(12);
    const percentStr = percentChangePlain.padStart(12);

    // Now apply chalk coloring to each column.
    const coloredCompany = chalk.gray(companyStr);
    const coloredSymbol = chalk.yellow(symbolStr);
    const coloredStart = chalk.white(startPriceStr);
    const coloredCurrent = chalk.green(currentStr);
    const coloredPercent =
      percentChange !== null
        ? (percentChange > 0
            ? chalk.green(percentStr)
            : percentChange < 0
            ? chalk.red(percentStr)
            : chalk.white(percentStr))
        : chalk.white(percentStr);

    // Concatenate the colored pieces.
    const row = coloredCompany + coloredSymbol + coloredStart + coloredCurrent + chalk.bold(coloredPercent);
    rowsToPrint.push(row);
  });

  // Append this update to the display log.
  const logEntry: DailyLogEntry = { timestamp: timestampStr, stocks: recordEntries };
  displayLog.push(logEntry);
  updateDisplayLogFile();

  // Clear the console and print header.
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

  // Print each row.
  rowsToPrint.forEach(row => console.log(row));
}

// Start updating every second.
fetchAndDisplayStockData();
const updateInterval = setInterval(fetchAndDisplayStockData, 1000);

// Gracefully handle termination.
process.on("SIGINT", () => {
  console.log(chalk.red("\nTerminating display..."));
  clearInterval(updateInterval);
  process.exit(0);
});

