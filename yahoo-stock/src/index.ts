import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
// Import types from the centralized file.
import { StockQuote, StockInfo, StockRecord, DailyLogEntry, StockRow } from "./types/stockTypes";

// File path for the daily log in the "jsonlol" folder.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");

// In‑memory daily log (updates will be appended here).
let dailyLog: DailyLogEntry[] = [];

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

// A threshold (in percent) below which updates (except the first) are not printed.
const THRESHOLD = 0.05;

// Flag to indicate if this is the first update.
let isFirstUpdate = true;

/**
 * Fetches the latest stock quote for a given symbol.
 * @param symbol - The Yahoo Finance stock symbol.
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
 * Helper function that returns a formatted string for a stock's start price.
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
    if (err) console.error(chalk.red("Error writing daily log file:"), err);
  });
}

/**
 * Fetches all stock quotes, calculates the percentage change relative to the start price,
 * logs the update, and prints a two‑line output for each stock.
 * Only stocks with an absolute percentage change of at least THRESHOLD are printed (after the first update).
 */
async function fetchAndPrintStockData() {
  const now = new Date();
  const timestampStr = now.toISOString();

  const recordEntries: StockRecord[] = [];
  const rowsToPrint: StockRow[] = [];

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

    const record: StockRecord = {
      company: stock.company,
      symbol: stock.symbol,
      price,
      currency: curr,
      percentChange
    };
    recordEntries.push(record);

    if (isFirstUpdate || (percentChange !== null && Math.abs(percentChange) >= THRESHOLD)) {
      const line1 =
        chalk.gray(stock.company.padEnd(22)) +
        chalk.yellow(stock.symbol.padEnd(8)) +
        chalk.white(initialPriceString(stock.symbol)) +
        chalk.green(priceStr.padStart(12));
      const indent = " ".repeat(22 + 8 + 12);
      const line2 = indent + chalk.bold("Change:").padStart(8) + percentChangeStr.padStart(12);
      rowsToPrint.push({ firstLine: line1, secondLine: line2 });
    }
  });

  const logEntry: DailyLogEntry = { timestamp: timestampStr, stocks: recordEntries };
  dailyLog.push(logEntry);
  updateDailyLogFile();

  // Print the table header (two lines).
  console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
  const header1 =
    chalk.bold("Company".padEnd(22)) +
    chalk.bold("Symbol".padEnd(8)) +
    chalk.bold("Start Price".padStart(12)) +
    chalk.bold("Current".padStart(12));
  console.log(header1);
  const header2 = " ".repeat(22 + 8 + 12) + chalk.bold("Change".padStart(12));
  console.log(header2);
  console.log(chalk.gray("-".repeat(66)));

  if (rowsToPrint.length > 0) {
    rowsToPrint.forEach(r => {
      console.log(r.firstLine);
      console.log(r.secondLine);
    });
  } else {
    console.log(chalk.gray("No significant price changes since last update."));
  }

  if (isFirstUpdate) isFirstUpdate = false;
}

fetchAndPrintStockData();
const updateInterval = setInterval(fetchAndPrintStockData, 5000);

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

