import axios from "axios";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

console.log("API_KEY:", process.env.API_KEY);
console.log("STOCK_SYMBOL:", process.env.STOCK_SYMBOL);
console.log("CONVERSION_SYMBOL:", process.env.CONVERSION_SYMBOL);
// Load environment variables from .env
dotenv.config();

const API_KEY = process.env.API_KEY || "";
if (!API_KEY) {
  console.error("API_KEY is missing in .env file.");
  process.exit(1);
}

console.log("Loaded STOCK_SYMBOL:", process.env.STOCK_SYMBOL);
/**
 * Set STOCK_SYMBOL in your .env:
 *  - For the Swedish listing, use for example: STOCK_SYMBOL=SKF-B:STO (price expected in SEK)
 *  - For the US listing, use for example: STOCK_SYMBOL=SKFRY  (price expected in USD)
 */
const STOCK_SYMBOL = process.env.STOCK_SYMBOL || "SKFRY"; 

/** 
 * Use CONVERSION_SYMBOL only when the stock price is not in SEK.
 * For example: CONVERSION_SYMBOL=USD/SEK.
 */
const CONVERSION_SYMBOL = process.env.CONVERSION_SYMBOL || "USD/SEK";

const QUOTE_URL = "https://api.twelvedata.com/quote";
const CONVERSION_URL = "https://api.twelvedata.com/price";

// Use header authentication as recommended by Twelve Data:
const headers = {
  Authorization: `apikey ${API_KEY}`,
};

// Running totals for calculating the running average (in SEK)
let totalPriceSek = 0;
let pollCount = 0;
let prevPriceSek: number | null = null;

// Array to store each row of output
const rows: string[] = [];

// Define types for the API responses
interface QuoteResponse {
  symbol: string;
  name: string;
  currency: string;
  close: string; // Price as a string.
}

interface PriceResponse {
  symbol: string;
  price: string; // Conversion rate as a string.
}

interface StockPriceData {
  price: number;
  currency: string;
}

// Fetch the stock price along with its currency
async function fetchStockPrice(): Promise<StockPriceData | null> {
  try {
    const res = await axios.get<QuoteResponse>(QUOTE_URL, {
      params: { symbol: STOCK_SYMBOL },
      headers: headers,
    });
    const price = parseFloat(res.data.close);
    if (isNaN(price)) {
      console.error(chalk.red("Invalid stock price received:"), res.data);
      return null;
    }
    return { price, currency: res.data.currency };
  } catch (error) {
    console.error(chalk.red("Failed to fetch stock price:"), error);
    return null;
  }
}

// Fetch the conversion rate (e.g., USD to SEK)
async function fetchConversionRate(): Promise<number | null> {
  try {
    const res = await axios.get<PriceResponse>(CONVERSION_URL, {
      params: { symbol: CONVERSION_SYMBOL },
      headers: headers,
    });
    const conversionRate = parseFloat(res.data.price);
    if (isNaN(conversionRate)) {
      console.error(chalk.red("Invalid conversion rate received:"), res.data);
      return null;
    }
    return conversionRate;
  } catch (error) {
    console.error(chalk.red("Failed to fetch conversion rate:"), error);
    return null;
  }
}

function getHeader(averageSek: number): string {
  const headerLine =
    chalk.blueBright("📊 Running Average (SEK): ") +
    chalk.magenta(averageSek.toFixed(2));
  const separator = chalk.gray("------------------------------------------------");
  const columns = `${chalk.gray("TIME".padEnd(12))} | ${chalk.gray("PRICE SEK".padEnd(10))} | ${chalk.gray("Δ".padEnd(8))} | ${chalk.gray("% Δ".padEnd(8))}`;
  return `${headerLine}\n${separator}\n${columns}\n${separator}`;
}

function formatRow(nowStr: string, sek: number, change: number, changePercent: number): string {
  let color = chalk.white;
  if (change > 0) color = chalk.green;
  else if (change < 0) color = chalk.red;
  return `${chalk.gray(nowStr.padEnd(12))} | ${chalk.yellow(sek.toFixed(2).padEnd(10))} | ${color(change.toFixed(2).padEnd(8))} | ${color(changePercent.toFixed(2).padEnd(8) + "%")}`;
}

async function trackPrice() {
  const stockData = await fetchStockPrice();
  if (!stockData) {
    console.error(chalk.red("Skipping update due to invalid stock data."));
    return;
  }

  let priceSek = stockData.price; // Assume price is in SEK by default.
  // If the returned currency is not SEK, then convert it.
  if (stockData.currency !== "SEK") {
    const rate = await fetchConversionRate();
    if (rate === null) {
      console.error(chalk.red("Skipping update due to missing conversion rate."));
      return;
    }
    priceSek = stockData.price * rate;
  }

  totalPriceSek += priceSek;
  pollCount++;
  const averageSek = totalPriceSek / pollCount;
  const nowStr = new Date().toLocaleTimeString();

  let change = 0;
  let changePercent = 0;
  if (prevPriceSek !== null) {
    change = priceSek - prevPriceSek;
    changePercent = (change / prevPriceSek) * 100;
  }
  prevPriceSek = priceSek;

  const row = formatRow(nowStr, priceSek, change, changePercent);
  rows.push(row);

  // Clear the screen and print header plus all rows
  console.clear();
  console.log(getHeader(averageSek));
  for (const r of rows) {
    console.log(r);
  }
}

console.clear();
console.log(chalk.blueBright("📈 Tracking SKF B every 15 seconds...\n"));

// Poll every 15 seconds (adjust as needed)
setInterval(trackPrice, 15_000);

