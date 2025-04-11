import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";

// Path for the summary JSON file.
const summaryPath = path.join(__dirname, "display_data.json");

// Read the daily summary JSON file.
fs.readFile(summaryPath, "utf8", (err, data) => {
  if (err) {
    console.error(chalk.red("Error reading summary file:"), err);
    process.exit(1);
  }

  try {
    const summary: any[] = JSON.parse(data);
    console.clear();
    console.log(chalk.blueBright("=== Daily Summary Graph ===\n"));

    // Determine the maximum average price to establish a scale.
    const maxAverage = Math.max(...summary.map(item => item.averagePrice));

    // Define a fixed bar width.
    const barWidth = 40;
    const scale = maxAverage > 0 ? barWidth / maxAverage : 1;

    summary.forEach(item => {
      const avg = item.averagePrice;
      // Create a bar for the average price.
      const barLength = Math.round(avg * scale);
      const bar = "█".repeat(barLength);
      console.log(chalk.yellow(`${item.company} (${item.symbol}):`));
      console.log(chalk.white(`  Avg: ${avg.toFixed(2).padEnd(8)} ${bar}`));
      console.log(""); // Empty line for spacing.
    });
    process.exit(0);
  } catch (parseError) {
    console.error(chalk.red("Error parsing summary JSON:"), parseError);
    process.exit(1);
  }
});
