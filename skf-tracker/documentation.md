# SKF TRACKER - Project Documentation

**Author:** Simon Kern (aka Battle Programmer Simon)  
**Email:** simon.f.kern@gmail.com  
**Project:** Node.js/TypeScript Stock Tracker for SKF (US ADR & Swedish Listing Conversion)

---

## Overview

**SKF TRACKER** is a command-line stock tracker built with Node.js and TypeScript. It fetches real-time stock data from Twelve Data's API to monitor the price of SKF B using either its US ADR (SKFRY) or the Swedish listing (if available). The tool converts the price into SEK if needed, calculates the percentage change from update to update, and displays a continuously updating terminal table with a running average in SEK at the top.

This lightweight terminal tool is ideal for users who want quick, colored, real-time updates about a specific stock without leaving the command line.

---

## Components

### 1. src/index.ts

This is the core file of the project. It performs the following tasks:

- **Environment Setup**  
  Loads API credentials and stock configuration from a `.env` file using the `dotenv` package.

- **Data Fetching**  
  - **Stock Price:**  
    Fetches the current stock price and its currency using Twelve Data’s `/quote` endpoint.
  - **Conversion Rate:**  
    If the stock price is not in SEK, it fetches the conversion rate (USD/SEK) from Twelve Data’s `/price` endpoint.

- **Data Processing**  
  - Converts the stock price to SEK (if necessary).  
  - Calculates a running average price in SEK.  
  - Computes the absolute and percentage change between the current price and the previous update.

- **User Interface**  
  - Clears and redraws the terminal on each update so that the header (showing the running average in SEK) always remains at the top.  
  - Each new update is appended as a new row below the header.  
  - Uses color coding (green for positive change, red for negative change) for easy viewing.

### 2. .env File

A text file that holds the configuration for your API key and stock symbols. For example:

```env
API_KEY=your_api_key
STOCK_SYMBOL=SKFRY
CONVERSION_SYMBOL=USD/SEK
