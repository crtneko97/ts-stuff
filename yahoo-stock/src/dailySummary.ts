// src/dailySummary.ts

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

const dailyLogPath = path.join(__dirname, "..", "jsonlol", "dailyLog.json");
const dailySummaryPath = path.join(__dirname, "..", "jsonlol", "dailySummary.json");

interface StockRecord {
  company: string;
  symbol: string;
  price: number | null;
  currency: string;
  percentChange: number | null;
}

interface DailyLogEntry {
  timestamp: string; // time of the update
  stocks: StockRecord[];
}

// For collecting stats on each symbol:
interface SymbolStats {
  company: string;
  symbol: string;
  sum: number;
  count: number;
  min: number;
  minTime: string;
  max: number;
  maxTime: string;
}

fs.readFile(dailyLogPath, "utf8", (err, data) => {
  if (err) {
    console.error(chalk.red("Error reading daily log file:"), err);
    process.exit(1);
  }

  try {
    const dailyLog: DailyLogEntry[] = JSON.parse(data);

    // We'll store stats for each symbol here.
    // Start min at Infinity and max at -Infinity to easily compare later.
    const statsMap: { [symbol: string]: SymbolStats } = {};

    // Build or update stats as we parse the log.
    dailyLog.forEach(entry => {
      const timestamp = entry.timestamp; 
      entry.stocks.forEach(stock => {
        if (stock.price !== null) {
          // If not in statsMap yet, initialize:
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

          // Check for a new min price:
          if (stock.price < symbolStats.min) {
            symbolStats.min = stock.price;
            symbolStats.minTime = timestamp;
          }
          // Check for a new max price:
          if (stock.price > symbolStats.max) {
            symbolStats.max = stock.price;
            symbolStats.maxTime = timestamp;
          }
        }
      });
    });

    // Build final summary with average, min, max, etc.
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

    // Write summary to dailySummaryPath
    fs.writeFile(dailySummaryPath, JSON.stringify(finalSummary, null, 2), err => {
      if (err) {
        console.error(chalk.red("Error writing daily summary file:"), err);
        process.exit(1);
      } else {
        console.log(chalk.blue("Daily summary written to"), dailySummaryPath);

        // Print summary to console
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

