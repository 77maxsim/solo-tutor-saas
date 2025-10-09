/**
 * Currency Conversion Service
 * Fetches and caches exchange rates from ExchangeRate-API
 * Used exclusively for admin dashboard to convert all currencies to USD
 */

interface ExchangeRates {
  [currency: string]: number;
}

interface CachedRates {
  rates: ExchangeRates;
  lastUpdated: Date;
}

let cachedRates: CachedRates | null = null;
const CACHE_DURATION_HOURS = 24;

/**
 * Fetch latest exchange rates from ExchangeRate-API
 */
async function fetchExchangeRates(): Promise<ExchangeRates> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  
  if (!apiKey) {
    console.error('⚠️ EXCHANGE_RATE_API_KEY not configured');
    throw new Error('Exchange rate API key not configured');
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result !== 'success') {
      throw new Error(`Exchange rate API returned: ${data.result}`);
    }

    console.log('✅ Exchange rates fetched successfully');
    return data.conversion_rates;
  } catch (error) {
    console.error('❌ Error fetching exchange rates:', error);
    throw error;
  }
}

/**
 * Get exchange rates (from cache if fresh, otherwise fetch new)
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  const now = new Date();
  
  // Check if cache is valid
  if (cachedRates) {
    const hoursSinceUpdate = (now.getTime() - cachedRates.lastUpdated.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceUpdate < CACHE_DURATION_HOURS) {
      console.log(`💾 Using cached exchange rates (${hoursSinceUpdate.toFixed(1)}h old)`);
      return cachedRates.rates;
    }
  }

  // Fetch new rates
  console.log('🔄 Fetching fresh exchange rates...');
  const rates = await fetchExchangeRates();
  
  cachedRates = {
    rates,
    lastUpdated: now,
  };

  return rates;
}

/**
 * Convert amount from source currency to USD
 * @param amount - Amount in source currency
 * @param sourceCurrency - Source currency code (e.g., 'UAH', 'CNY', 'USD')
 * @returns Amount converted to USD
 */
export async function convertToUSD(amount: number, sourceCurrency: string): Promise<number> {
  if (sourceCurrency === 'USD') {
    return amount;
  }

  const rates = await getExchangeRates();
  const rate = rates[sourceCurrency];

  if (!rate) {
    console.warn(`⚠️ Exchange rate not found for ${sourceCurrency}, using 1:1`);
    return amount;
  }

  // ExchangeRate-API returns rates as "1 USD = X [currency]"
  // To convert from [currency] to USD: amount / rate
  const usdAmount = amount / rate;
  
  return usdAmount;
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  if (!cachedRates) {
    return { cached: false };
  }

  const hoursSinceUpdate = (new Date().getTime() - cachedRates.lastUpdated.getTime()) / (1000 * 60 * 60);
  
  return {
    cached: true,
    lastUpdated: cachedRates.lastUpdated.toISOString(),
    hoursOld: hoursSinceUpdate.toFixed(2),
    currencies: Object.keys(cachedRates.rates).length,
  };
}
