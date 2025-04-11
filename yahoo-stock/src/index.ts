// src/index.ts

import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo } from "./types/stockTypes";

const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");

interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null; // null if no previous price
}

interface DailyLogEntry {
  timestamp: string;  // ISO timestamp for each update
  stocks: StockRecord[];
}

// In-memory daily log array.
let dailyLog: DailyLogEntry[] = [];

// Your stock list, including SKF-B.ST:
const stocks: StockInfo[] = [
  { company: "ATOSS SOFTWARE SE", symbol: "AOF.DE" },
  { company: "ENVAR", symbol: "ENVAR.ST" },
  { company: "Intel", symbol: "INTC" },
  { company: "INVISIO", symbol: "IVSO.ST" },
  { company: "Ovzon", symbol: "OVZON.ST" },
  { company: "Star Vault B", symbol: "STVA-B.ST" },
  { company: "Telenor", symbol: "TEL.OL" },
  { company: "SKF", symbol: "SKF-B.ST" }
];

// Previous prices for % calculation:
const previousPrices: { [symbol: string]: number } = {};

/**
 * Fetches a single stock quote using yahoo-finance2.
 */
async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const quote = await yahooFinance.quote(symbol);
    return quote;
  } catch (error) {
    console.error(chalk.red(`Error fetching ${symbol}:`), error);
    return null;
  }
}

/**
 * Fetches all quotes, prints the table, and appends a log entry to dailyLog.
 */
async function fetchAndPrintStockData() {
  console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${new Date().toLocaleTimeString()}) ===\n`));

  // Adjust padding to shift columns for better alignment.
  const header =
    chalk.bold("Company".padEnd(22)) +
    chalk.bold("Symbol".padEnd(8)) +
    chalk.bold("Price".padStart(12)) +
    chalk.bold("Curr".padStart(6)) +
    chalk.bold("% Change".padStart(12)); 
  // ^ Increased padStart for "% Change" to shift it further right

  console.log(header);
  console.log(chalk.gray("-".repeat(60)));

  const recordEntries: StockRecord[] = [];

  // Fetch all quotes concurrently.
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
      price = quote.regularMarketPrice;
      priceStr = price.toFixed(2);
      curr = quote.currency || "";

      if (previousPrices[stock.symbol] !== undefined) {
        const oldPrice = previousPrices[stock.symbol];
        const change = price - oldPrice;
        percentChange = (change / oldPrice) * 100;
        percentChangeStr =
          percentChange > 0
            ? chalk.green(percentChange.toFixed(2) + "%")
            : percentChange < 0
            ? chalk.red(percentChange.toFixed(2) + "%")
            : chalk.white(percentChange.toFixed(2) + "%");
      }
      previousPrices[stock.symbol] = price;
    }

    // Align each column. Notice the new widths matching the header above.
    const row =
      chalk.gray(stock.company.padEnd(22)) +
      chalk.yellow(stock.symbol.padEnd(8)) +
      chalk.green(priceStr.padStart(12)) +
      chalk.white(curr.padStart(6)) +
      percentChangeStr.padStart(12);

    console.log(row);

    // Build the record for the daily log.
    recordEntries.push({
      company: stock.company,
      symbol: stock.symbol,
      price: price,
      currency: curr,
      percentChange: percentChange
    });
  });

  // Append to dailyLog.
  const logEntry: DailyLogEntry = {
    timestamp: new Date().toISOString(),
    stocks: recordEntries
  };
  dailyLog.push(logEntry);
  updateDailyLogFile();
}

/**
 * Writes the entire dailyLog array to a JSON file inside jsonlol.
 */
function updateDailyLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(dailyLog, null, 2), err => {
    if (err) {
      console.error(chalk.red("Error writing daily log file:"), err);
    }
  });
}

// Start capturing data.
fetchAndPrintStockData();
const updateInterval = setInterval(fetchAndPrintStockData, 5000);

/**
 * On Ctrl+C, spawn dailySummary.ts and remove the old log once summary is done.
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

