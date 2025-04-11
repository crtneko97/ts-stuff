// src/dailySummary.ts

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { StockRecord, DailyLogEntry, SymbolStats } from "./types/stockTypes";

// Define paths for the log and summary files.
const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");
const dailySummaryPath = path.join(__dirname, "..", "jsonlol", "dailySummary.json");

// Read the daily log file.
fs.readFile(dailyLogPath, "utf8", (err, data) => {
  if (err) {
    console.error(chalk.red("Error reading daily log file:"), err);
    process.exit(1);
  }
  
  try {
    const dailyLog: DailyLogEntry[] = JSON.parse(data);

    // Create a map for collecting stats per stock.
    const statsMap: { [symbol: string]: SymbolStats } = {};

    // Process each log entry.
    dailyLog.forEach(entry => {
      const timestamp = entry.timestamp;
      entry.stocks.forEach(stock => {
        if (stock.price !== null) {
          // Initialize stats for this stock if not already present.
          if (!statsMap[stock.symbol]) {
            statsMap[stock.symbol] = {
              company: stock.company,
              symbol: stock.symbol,
              sum: 0,
              count: 0,
              min: Infinity,
              minTime: "",
              max: -Infinity,
              maxTime: ""
            };
          }
          const symbolStats = statsMap[stock.symbol];
          symbolStats.sum += stock.price;
          symbolStats.count += 1;

          // Update minimum price and timestamp if this is a new minimum.
          if (stock.price < symbolStats.min) {
            symbolStats.min = stock.price;
            symbolStats.minTime = timestamp;
          }
          // Update maximum price and timestamp if this is a new maximum.
          if (stock.price > symbolStats.max) {
            symbolStats.max = stock.price;
            symbolStats.maxTime = timestamp;
          }
        }
      });
    });

    // Build the final summary array.
    const finalSummary = Object.values(statsMap).map(s => {
      const averagePrice = s.count > 0 ? s.sum / s.count : 0;
      return {
        company: s.company,
        symbol: s.symbol,
        averagePrice,
        minPrice: s.min === Infinity ? null : s.min,
        minTime: s.minTime,
        maxPrice: s.max === -Infinity ? null : s.max,
        maxTime: s.maxTime
      };
    });

    // Write the final summary to a JSON file.
    fs.writeFile(dailySummaryPath, JSON.stringify(finalSummary, null, 2), err => {
      if (err) {
        console.error(chalk.red("Error writing daily summary file:"), err);
        process.exit(1);
      } else {
        console.log(chalk.blue("Daily summary written to"), dailySummaryPath);
        // Print the summary to the console.
        console.log(chalk.magenta("\n=== Daily Summary ==="));
        finalSummary.forEach(item => {
          console.log(
            chalk.magenta(
              `${item.company} (${item.symbol}):
  - Avg = ${item.averagePrice.toFixed(2)}
  - Min = ${item.minPrice?.toFixed(2)} at ${item.minTime}
  - Max = ${item.maxPrice?.toFixed(2)} at ${item.maxTime}
`
            )
          );
        });
        process.exit(0);
      }
    });
  } catch (parseError) {
    console.error(chalk.red("Error parsing daily log JSON:"), parseError);
    process.exit(1);
  }
});

