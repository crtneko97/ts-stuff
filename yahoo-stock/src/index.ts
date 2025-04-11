// src/index.ts

import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo } from "./types/stockTypes";

// File path for the daily log in the "jsonlol" folder.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");

// Define the structure of each stock record saved in the log.
interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; // null if no previous price exists
}

// Each log entry holds a timestamp and an array of stock records.
interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for each update
  stocks: StockRecord[];
}

// In-memory daily log array.
let dailyLog: DailyLogEntry[] = [];

// List of stocks to track.
// Note: "NASDAQ| Bitcoin Depot A" is added with ticker "BTC-USD" (commonly used for Bitcoin price in USD).
const stocks: StockInfo[] = [
  { company: "ATOSS SOFTWARE SE", symbol: "AOF.DE" },
  { company: "ENVAR", symbol: "ENVAR.ST" },
  { company: "Intel", symbol: "INTC" },
  { company: "INVISIO", symbol: "IVSO.ST" },
  { company: "Ovzon", symbol: "OVZON.ST" },
  { company: "Star Vault B", symbol: "STVA-B.ST" },
  { company: "Telenor", symbol: "TEL.OL" },
  { company: "SKF", symbol: "SKF-B.ST" },
  { company: "NASDAQ| Bitcoin Depot A", symbol: "BTC-USD" }
];

// Object to store the previous market price for each stock (for computing changes).
const previousPrices: { [symbol: string]: number } = {};

/**
 * Fetches a single stock quote using yahoo-finance2.
 * @param symbol - The Yahoo Finance stock symbol.
 * @returns A Promise that resolves to a StockQuote or null if an error occurs.
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
 * Fetches all stock quotes, logs the update, and prints only changed records.
 */
async function fetchAndPrintStockData() {
  // Get current timestamp.
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold stock records for the current update (for logging).
  const recordEntries: StockRecord[] = [];

  // Array to collect rows that will be printed (only if there's a change).
  const rowsToPrint: string[] = [];

  // Fetch all stock quotes concurrently.
  const promises = stocks.map(s => fetchStockQuote(s.symbol));
  const results = await Promise.all(promises);

  // Process each stock's result.
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

      // Calculate percent change if a previous price exists.
      if (previousPrices[stock.symbol] !== undefined) {
        const oldPrice = previousPrices[stock.symbol];
        // Only calculate change if there is any difference.
        if (price !== oldPrice) {
          const change = price - oldPrice;
          percentChange = (change / oldPrice) * 100;
        } else {
          percentChange = 0;
        }
      }
      // Save or update the previous price.
      previousPrices[stock.symbol] = price;
    }

    // Build the record for logging.
    const record: StockRecord = {
      company: stock.company,
      symbol: stock.symbol,
      price,
      currency: curr,
      percentChange
    };
    recordEntries.push(record);

    // Build the formatted row for console output.
    // We'll include the row only if this is the first update or if the price has changed.
    const shouldPrint = (previousPrices[stock.symbol] === price) ? (percentChange === 0 && previousPrices[stock.symbol] !== undefined ? false : true) : true;
    // For first update, previous price is undefined so shouldPrint will be true.
    if (shouldPrint) {
      const row =
        chalk.gray(stock.company.padEnd(22)) +
        chalk.yellow(stock.symbol.padEnd(8)) +
        chalk.green(priceStr.padStart(12)) +
        chalk.white(curr.padStart(6)) +
        (percentChange !== null
          ? (percentChange > 0
              ? chalk.green(percentChange.toFixed(2) + "%")
              : percentChange < 0
              ? chalk.red(percentChange.toFixed(2) + "%")
              : chalk.white(percentChange.toFixed(2) + "%")).padStart(12)
          : "N/A".padStart(12));
      rowsToPrint.push(row);
    }
  });

  // Append the update (regardless of printing) to the daily log.
  const logEntry: DailyLogEntry = {
    timestamp: timestampStr,
    stocks: recordEntries
  };
  dailyLog.push(logEntry);
  updateDailyLogFile();

  // Only print if we have any changed rows.
  if (rowsToPrint.length > 0) {
    // Print header.
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
    const header =
      chalk.bold("Company".padEnd(22)) +
      chalk.bold("Symbol".padEnd(8)) +
      chalk.bold("Price".padStart(12)) +
      chalk.bold("Curr".padStart(6)) +
      chalk.bold("% Change".padStart(12));
    console.log(header);
    console.log(chalk.gray("-".repeat(60)));
    // Print each changed row.
    rowsToPrint.forEach(r => console.log(r));
  } else {
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===`));
    console.log(chalk.gray("No price changes since last update."));
  }
}

/**
 * Writes the current dailyLog array to a JSON file inside the "jsonlol" folder.
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
 * On termination (Ctrl+C), spawn dailySummary.ts and delete the old log afterward.
 */
process.on("SIGINT", () => {
  console.log(chalk.red("\nTerminating... Spawning dailySummary.ts"));
  clearInterval(updateInterval);
  const { spawn } = require("child_process");
  const summaryProcess = spawn("npx", ["ts-node", "src/dailySummary.ts"], {
    stdio: "inherit"
  });
  summaryProcess.on("exit", (code: number) => {
    fs.unlink(dailyLogPath, err => {
      if (err) console.error(chalk.red("Error deleting daily log file:"), err);
      else console.log(chalk.blue("Old daily log file deleted."));
      process.exit(code);
    });
  });
});
