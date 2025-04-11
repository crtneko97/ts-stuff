import yahooFinance from "yahoo-finance2"; // For fetching Yahoo Finance data
import chalk from "chalk";                 // For colorized console output

/**
 * Fetch and display raw JSON data from Yahoo Finance.
 * In this example, we fetch the quote for Intel ("INTC").
 */
async function displayRawJSON() {
  try {
    const symbol = "INTC";
    const quote = await yahooFinance.quote(symbol);
    console.log(chalk.blueBright("Raw JSON Data:"));
    // Pretty-print the JSON with 2-space indentation.
    console.log(JSON.stringify(quote, null, 2));
  } catch (error) {
    console.error(chalk.red("Error fetching JSON data:"), error);
  }
}

displayRawJSON();
