
import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo } from "./types/stockTypes";

// File path for the daily log in the "jsonlol" folder.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");

// Defines the data structure for each stock record in the log.
interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; // Percentage change computed relative to the start price.
}

// Each daily log entry contains a timestamp and an array of stock records.
interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for each update.
  stocks: StockRecord[];
}

// In‑memory daily log (all updates will be appended here).
let dailyLog: DailyLogEntry[] = [];

// List of stocks to track (including added stocks such as Nvidia, ASUS, Hexagon AB, etc.).
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

// A threshold (in percent) under which we will not print updates (except on the very first update).
const THRESHOLD = 0.05;

// Flag to indicate if this is the very first update.
let isFirstUpdate = true;

/**
 * Fetches the latest stock quote for a given symbol using yahoo-finance2.
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
 * Fetches all stock quotes, computes percentage change based on the start price,
 * logs every update, and prints a detailed table with one row per stock.
 * Only stocks with a percent change (absolute value) of at least THRESHOLD (0.05%)
 * are printed on updates after the first.
 */
async function fetchAndPrintStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold each stock record for the log.
  const recordEntries: StockRecord[] = [];
  // Array to hold formatted rows (one per stock) for printing.
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
    let percentChangeStr = "N/A";

    if (quote && quote.regularMarketPrice !== undefined) {
      // Current price fetched from the API.
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // Set the start price if it is not already set.
      if (startPrices[stock.symbol] === undefined) {
        startPrices[stock.symbol] = price;
      }
      // Compute percent change relative to the start price.
      const initialPrice = startPrices[stock.symbol];
      percentChange = ((price - initialPrice) / initialPrice) * 100;
      // Format the percent change with color coding.
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

    // Condition for printing the row:
    // Always print for the first update.
    // On subsequent updates, only print if the absolute percent change is >= THRESHOLD.
    if (
      isFirstUpdate ||
      (percentChange !== null && Math.abs(percentChange) >= THRESHOLD)
    ) {
      // Build a formatted row with all desired data.
      // The row now shows: Company | Symbol | Start Price | Current Price | % Change
      const row =
        chalk.gray(stock.company.padEnd(22)) +
        chalk.yellow(stock.symbol.padEnd(8)) +
        chalk.white(initialPriceString(stock.symbol)) +
        chalk.green(priceStr.padStart(12)) +
        percentChangeStr.padStart(12);
      rowsToPrint.push(row);
    }
  });

  // Append this update to the daily log.
  const logEntry: DailyLogEntry = {
    timestamp: timestampStr,
    stocks: recordEntries
  };
  dailyLog.push(logEntry);
  updateDailyLogFile();

  // Print the table header.
  console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
  // Build header: Company, Symbol, Start Price, Current Price, % Change.
  const header =
    chalk.bold("Company".padEnd(22)) +
    chalk.bold("Symbol".padEnd(8)) +
    chalk.bold("Start Price".padStart(12)) +
    chalk.bold("Current".padStart(12)) +
    chalk.bold("% Change".padStart(12));
  console.log(header);
  console.log(chalk.gray("-".repeat(66)));

  // Print each formatted row.
  if (rowsToPrint.length > 0) {
    rowsToPrint.forEach(row => console.log(row));
  } else {
    console.log(chalk.gray("No significant price changes since last update."));
  }

  // After printing the first update, set the flag to false.
  if (isFirstUpdate) {
    isFirstUpdate = false;
  }
}

/**
 * Helper function to create a formatted string for the start price.
 * Returns the start price for a given stock symbol (or "N/A" if not set),
 * padded to 12 characters.
 * @param symbol - Stock symbol.
 */
function initialPriceString(symbol: string): string {
  const sp = startPrices[symbol];
  return sp !== undefined ? sp.toFixed(2).padStart(12) : "N/A".padStart(12);
}

/**
 * Writes the in‑memory daily log array to a JSON file inside the "jsonlol" folder.
 */
function updateDailyLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(dailyLog, null, 2), err => {
    if (err) {
      console.error(chalk.red("Error writing daily log file:"), err);
    }
  });
}

// Start capturing data immediately.
fetchAndPrintStockData();
// Schedule updates every 5 seconds.
const updateInterval = setInterval(fetchAndPrintStockData, 5000);

/**
 * When the process is terminated (e.g. Ctrl+C), spawn the daily summary script
 * and delete the old daily log file.
 */
process.on("SIGINT", () => {
  console.log(chalk.red("\nTerminating... Spawning dailySummary.ts"));
  clearInterval(updateInterval);
  const { spawn } = require("child_process");
  const summaryProcess = spawn("npx", ["ts-node", "src/dailySummary.ts"], { stdio: "inherit" });
  summaryProcess.on("exit", (code: number) => {
    fs.unlink(dailyLogPath, err => {
      if (err) console.error(chalk.red("Error deleting daily log file:"), err);
      else console.log(chalk.blue("Old daily log file deleted."));
      process.exit(code);
    });
  });
});

