import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { StockRecord, DailyLogEntry, SymbolStats } from "./types/stockTypes";

// Set file paths in the src folder.
const dailyLogPath = path.join(__dirname, "daily_log.json");
const dailySummaryPath = path.join(__dirname, "display_data.json");

// Check if the daily log exists.
if (!fs.existsSync(dailyLogPath)) {
  console.error(chalk.red("Daily log file not found at " + dailyLogPath));
  process.exit(1);
}

fs.readFile(dailyLogPath, "utf8", (err, data) => {
  if (err) {
    console.error(chalk.red("Error reading daily log file:"), err);
    process.exit(1);
  }
  
  try {
    const dailyLog: DailyLogEntry[] = JSON.parse(data);
    console.log(chalk.blue(`Successfully parsed daily log. Total updates: ${dailyLog.length}`));
    
    // Map for accumulating statistics per stock.
    const statsMap: { [symbol: string]: SymbolStats } = {};
    
    dailyLog.forEach(entry => {
      const timestamp = entry.timestamp;
      entry.stocks.forEach(stock => {
        if (stock.price !== null && !isNaN(stock.price)) {
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
          if (stock.price < symbolStats.min) {
            symbolStats.min = stock.price;
            symbolStats.minTime = timestamp;
          }
          if (stock.price > symbolStats.max) {
            symbolStats.max = stock.price;
            symbolStats.maxTime = timestamp;
          }
        }
      });
    });
    
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
    
    fs.writeFile(dailySummaryPath, JSON.stringify(finalSummary, null, 2), err => {
      if (err) {
        console.error(chalk.red("Error writing daily summary file:"), err);
        process.exit(1);
      } else {
        console.log(chalk.blue("Daily summary written to"), dailySummaryPath);
        console.log(chalk.magenta("\n=== Daily Summary ==="));
        finalSummary.forEach(item => {
          console.log(
            chalk.magenta(
              `${item.company} (${item.symbol}):
  - Avg = ${item.averagePrice.toFixed(2)}
  - Min = ${item.minPrice !== null ? item.minPrice.toFixed(2) : "N/A"} at ${item.minTime || "N/A"}
  - Max = ${item.maxPrice !== null ? item.maxPrice.toFixed(2) : "N/A"} at ${item.maxTime || "N/A"}`
            )
          );
        });
        // Remove the daily log file so the next run starts fresh.
        fs.unlink(dailyLogPath, err => {
          if (err)
            console.error(chalk.red("Error deleting daily log file:"), err);
          else
            console.log(chalk.blue("Old daily log file deleted."));
          process.exit(0);
        });
      }
    });
    
  } catch (parseError) {
    console.error(chalk.red("Error parsing daily log JSON:"), parseError);
    process.exit(1);
  }
});

