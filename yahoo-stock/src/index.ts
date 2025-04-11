// src/index.ts

import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo } from "./types/stockTypes";

// The JSON log file will be created in the "jsonlol" folder (assumed to be in the project root).
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");

// Defines the data structure for each stock record in the log.
interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; // null if no previous price for comparison
}

// Each daily log entry contains a timestamp and an array of stock records.
interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for the update
  stocks: StockRecord[];
}

// In‑memory daily log (all updates are appended here).
let dailyLog: DailyLogEntry[] = [];

// List of stocks to track—now with additional stocks for Nvidia, ASUS, and Hexagon AB.
// You can adjust the ticker symbols as needed.
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

// Object to store the previous prices for each stock (for calculating percent change).
const previousPrices: { [symbol: string]: number } = {};

/**
 * Fetches the latest stock quote for a given symbol using yahoo-finance2.
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
 * Fetches all stock quotes, creates formatted rows for stocks with a price change,
 * logs every update, and prints the data in two columns per row.
 */
async function fetchAndPrintStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold each stock record for the log.
  const recordEntries: StockRecord[] = [];
  // Array to hold formatted string rows to be printed.
  const rowsToPrint: string[] = [];

  // Fetch all stock quotes concurrently.
  const promises = stocks.map(s => fetchStockQuote(s.symbol));
  const results = await Promise.all(promises);

  // Process each stock result.
  results.forEach((quote, index) => {
    const stock = stocks[index];
    let price: number | null = null;
    let priceStr = "N/A";
    let curr = "";
    let percentChange: number | null = null;
    let percentChangeStr = "N/A";

    // If valid data was returned:
    if (quote && quote.regularMarketPrice !== undefined) {
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // If there is a previous price, calculate the percent change.
      if (previousPrices[stock.symbol] !== undefined) {
        const oldPrice = previousPrices[stock.symbol];
        // Only if the price differs from the previous update.
        if (price !== oldPrice) {
          const change = price - oldPrice;
          percentChange = (change / oldPrice) * 100;
        } else {
          percentChange = 0;
        }
      }
      // Update previous price for next calculation.
      previousPrices[stock.symbol] = price;
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

    // Decide whether to print this stock’s row:
    // Print if this is the first update (no prior price) or if there's a nonzero percent change.
    const shouldPrint = (previousPrices[stock.symbol] === price && (percentChange === null || percentChange !== 0))
      || (percentChange !== null && percentChange !== 0);
    // (On first update, previousPrices[stock.symbol] is set just now, so it always prints.)

    if (shouldPrint) {
      // Build the formatted row.
      // Adjust the padding widths as needed:
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

  // Append this update to the daily log.
  const logEntry: DailyLogEntry = {
    timestamp: timestampStr,
    stocks: recordEntries
  };
  dailyLog.push(logEntry);
  updateDailyLogFile();

  // Now, print the results in two columns per row.
  if (rowsToPrint.length > 0) {
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
    // Build a combined header for two columns.
    const singleHeader =
      chalk.bold("Company".padEnd(22)) +
      chalk.bold("Symbol".padEnd(8)) +
      chalk.bold("Price".padStart(12)) +
      chalk.bold("Curr".padStart(6)) +
      chalk.bold("% Change".padStart(12));
    // Combine two headers separated by extra space.
    const combinedHeader = singleHeader + "    " + singleHeader;
    console.log(combinedHeader);
    console.log(chalk.gray("-".repeat(combinedHeader.length)));

    // Group rows two by two.
    for (let i = 0; i < rowsToPrint.length; i += 2) {
      const left = rowsToPrint[i];
      // If there is a second row, use it; otherwise, leave it blank.
      const right = i + 1 < rowsToPrint.length ? rowsToPrint[i + 1] : "";
      // Join the two formatted rows with a separator (adjust space as needed).
      console.log(left + "    " + right);
    }
  } else {
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===`));
    console.log(chalk.gray("No price changes since last update."));
  }
}

/**
 * Writes the entire dailyLog array to a JSON file inside the jsonlol folder.
 */
function updateDailyLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(dailyLog, null, 2), err => {
    if (err) {
      console.error(chalk.red("Error writing daily log file:"), err);
    }
  });
}

// Start by capturing data immediately.
fetchAndPrintStockData();
// Schedule updates every 5 seconds.
const updateInterval = setInterval(fetchAndPrintStockData, 5000);

/**
 * On termination (Ctrl+C), spawn dailySummary.ts and delete the daily log file.
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

