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
  percentChange: number | null; // Percentage change based on the start price
}

// Each daily log entry contains a timestamp and an array of stock records.
interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for each update
  stocks: StockRecord[];
}

// In‑memory daily log (all updates are appended here).
let dailyLog: DailyLogEntry[] = [];

// List of stocks to track—now with additional stocks.
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

// Object to store the **start price** for each stock (set once when the run starts).
const startPrices: { [symbol: string]: number } = {};

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
 * Fetches all stock quotes, computes percentage change based on the start price,
 * logs every update, and prints the data in two columns per row.
 */
async function fetchAndPrintStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  // Array to hold each stock record for the log.
  const recordEntries: StockRecord[] = [];
  // Array to hold formatted rows for printing.
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

    // If valid data is returned, extract the price and currency.
    if (quote && quote.regularMarketPrice !== undefined) {
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      // If the start price has not yet been recorded, record it now.
      if (startPrices[stock.symbol] === undefined) {
        startPrices[stock.symbol] = price;
      }
      // Compute the percentage change relative to the start price.
      const initialPrice = startPrices[stock.symbol];
      percentChange = ((price - initialPrice) / initialPrice) * 100;

      // Format the percentage change with color based on whether it's positive or negative.
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

    // Decide whether to print this row.
    // (You may choose to print on every update or only when there is a notable change.)
    // For this example, we print if the price is defined.
    if (price !== null) {
      const row =
        chalk.gray(stock.company.padEnd(22)) +
        chalk.yellow(stock.symbol.padEnd(8)) +
        chalk.green(priceStr.padStart(12)) +
        chalk.white(curr.padStart(6)) +
        percentChangeStr.padStart(12);
      rowsToPrint.push(row);
    }
  });

  // Append the update to the daily log.
  const logEntry: DailyLogEntry = {
    timestamp: timestampStr,
    stocks: recordEntries
  };
  dailyLog.push(logEntry);
  updateDailyLogFile();

  // Now, print the results in two columns per row.
  if (rowsToPrint.length > 0) {
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
    const singleHeader =
      chalk.bold("Company".padEnd(22)) +
      chalk.bold("Symbol".padEnd(8)) +
      chalk.bold("Price".padStart(12)) +
      chalk.bold("Curr".padStart(6)) +
      chalk.bold("% Change".padStart(12));
    const combinedHeader = singleHeader + "    " + singleHeader;
    console.log(combinedHeader);
    console.log(chalk.gray("-".repeat(combinedHeader.length)));

    // Group rows in pairs to print two columns per row.
    for (let i = 0; i < rowsToPrint.length; i += 2) {
      const left = rowsToPrint[i];
      const right = i + 1 < rowsToPrint.length ? rowsToPrint[i + 1] : "";
      console.log(left + "    " + right);
    }
  } else {
    console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===`));
    console.log(chalk.gray("No price data available."));
  }
}

/**
 * Writes the in‑memory daily log array to a JSON file inside the jsonlol folder.
 */
function updateDailyLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(dailyLog, null, 2), err => {
    if (err) {
      console.error(chalk.red("Error writing daily log file:"), err);
    }
  });
}

// Start immediately.
fetchAndPrintStockData();
// Schedule updates every 5 seconds.
const updateInterval = setInterval(fetchAndPrintStockData, 5000);

/**
 * On termination (Ctrl+C), spawn the dailySummary.ts script and then delete the old log file.
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

