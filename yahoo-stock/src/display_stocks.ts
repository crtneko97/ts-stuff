
import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output
import * as fs from "fs";
import * as path from "path";
import { StockQuote, StockInfo, StockRecord, DailyLogEntry, StockRow } from "./types/stockTypes";
import { stocks } from "./stock_list";
import { stockDescriptions } from "./stockDescriptions";

// File path for the log in the src folder.
const dailyLogPath = path.join(__dirname, "daily_log.json");

// In‑memory daily log.
let dailyLog: DailyLogEntry[] = [];

// Object to store the start price for each stock.
const startPrices: { [symbol: string]: number } = {};

// Threshold for printing updates (in percent).
const THRESHOLD = 0.05;

// Flag indicating the first update.
let isFirstUpdate = true;

/**
 * Fetches the latest stock quote for a given symbol.
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
 * Returns the start price as a padded string (12 characters).
 */
function initialPriceString(symbol: string): string {
  const sp = startPrices[symbol];
  return sp !== undefined ? sp.toFixed(2).padStart(12) : "N/A".padStart(12);
}

/**
 * Writes the in-memory daily log to a JSON file in the src folder.
 */
function updateDailyLogFile() {
  fs.writeFile(dailyLogPath, JSON.stringify(dailyLog, null, 2), err => {
    if (err) console.error(chalk.red("Error writing daily log file:"), err);
  });
}

/**
 * Fetches all stock quotes, calculates the % change relative to the start price,
 * logs the update, and prints a two-line output for each stock.
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
      const fetchedPrice = Number(quote.regularMarketPrice);
      if (!isNaN(fetchedPrice)) {
        price = fetchedPrice;
        priceStr = price.toFixed(2);
        curr = quote.currency || "";
  
        if (startPrices[stock.symbol] === undefined) {
          startPrices[stock.symbol] = price;
        }
        const initialPrice = startPrices[stock.symbol];
        if (!isNaN(initialPrice) && initialPrice !== 0) {
          percentChange = ((price - initialPrice) / initialPrice) * 100;
          percentChangeStr = percentChange.toFixed(2) + "%";
        } else {
          percentChange = null;
          percentChangeStr = "N/A";
        }
      } else {
        console.warn(chalk.yellow(`Warning: Invalid price for ${stock.company} (${stock.symbol}).`));
      }
    }
  
    const record: StockRecord = {
      company: stock.company,
      symbol: stock.symbol,
      price,
      currency: curr,
      percentChange
    };
    recordEntries.push(record);
  
    // Build plain text pieces with padding.
    const companyStr = stock.company.padEnd(22);
    const symbolStr = stock.symbol.padEnd(8);
    const startPriceStr = initialPriceString(stock.symbol); // Already padded.
    // Combine current price and currency; width 18 to allow extra characters.
    const currentCombined = (priceStr + " " + curr).padStart(18);
    const percentStr = percentChangeStr.padStart(12);
  
    // Apply colors.
    const coloredCompany = chalk.gray(companyStr);
    const coloredSymbol = chalk.yellow(symbolStr);
    const coloredStart = chalk.white(startPriceStr);
    const coloredCurrent = chalk.green(currentCombined);
    const coloredPercent =
      percentChange !== null
        ? (percentChange > 0
            ? chalk.green(percentStr)
            : percentChange < 0
            ? chalk.red(percentStr)
            : chalk.white(percentStr))
        : chalk.white(percentStr);
  
    // Build the row.
    const rowLine =
      coloredCompany +
      coloredSymbol +
      coloredStart +
      coloredCurrent +
      chalk.bold(coloredPercent);
    const rowObj: StockRow = {
      firstLine: rowLine,
      secondLine: ""
    };
  
    // Append description if available.
    const description = stockDescriptions[stock.symbol];
    if (description) {
      rowObj.secondLine = "    " + chalk.cyan(description);
    }
    rowsToPrint.push(rowObj);
  });
  
  const logEntry: DailyLogEntry = { timestamp: timestampStr, stocks: recordEntries };
  dailyLog.push(logEntry);
  updateDailyLogFile();
  
  // Print header.
  console.clear();
  console.log(chalk.blueBright(`\n=== Stock Prices (Updated ${now.toLocaleTimeString()}) ===\n`));
  const header1 =
    chalk.bold("Company".padEnd(22)) +
    chalk.bold("Symbol".padEnd(8)) +
    chalk.bold("Start Price".padStart(12)) +
    chalk.bold("Current".padStart(18)) +
    chalk.bold("% Change".padStart(12));
  console.log(header1);
  console.log(chalk.gray("-".repeat(72)));
  
  if (rowsToPrint.length > 0) {
    rowsToPrint.forEach(r => {
      console.log(r.firstLine);
      if (r.secondLine) console.log(r.secondLine);
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

