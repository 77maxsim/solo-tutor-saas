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

interface ApiUsageLog {
  timestamp: Date;
  success: boolean;
}

let cachedRates: CachedRates | null = null;
let apiCallLogs: ApiUsageLog[] = [];

const CACHE_DURATION_HOURS = 24;
const MONTHLY_REQUEST_LIMIT = 1500;
const WARNING_THRESHOLD = 0.8;

/**
 * Get API usage for the current month
 */
function getMonthlyUsage(): { count: number; limit: number; percentage: number } {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const monthlyLogs = apiCallLogs.filter(log => log.timestamp >= firstDayOfMonth);
  const count = monthlyLogs.length;
  const percentage = (count / MONTHLY_REQUEST_LIMIT) * 100;
  
  return { count, limit: MONTHLY_REQUEST_LIMIT, percentage };
}

/**
 * Log an API call
 */
function logApiCall(success: boolean): void {
  apiCallLogs.push({ timestamp: new Date(), success });
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  apiCallLogs = apiCallLogs.filter(log => log.timestamp >= thirtyDaysAgo);
  
  const usage = getMonthlyUsage();
  console.log(`📊 Currency API usage: ${usage.count}/${usage.limit} (${usage.percentage.toFixed(1)}%)`);
  
  if (usage.percentage >= WARNING_THRESHOLD * 100) {
    console.warn(`⚠️ WARNING: Currency API usage at ${usage.percentage.toFixed(1)}% of monthly limit!`);
  }
}

/**
 * Fetch latest exchange rates from ExchangeRate-API
 */
async function fetchExchangeRates(): Promise<ExchangeRates> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  
  if (!apiKey) {
    console.error('⚠️ EXCHANGE_RATE_API_KEY not configured');
    throw new Error('Exchange rate API key not configured');
  }

  let apiCallLogged = false;
  
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

    logApiCall(true);
    apiCallLogged = true;
    console.log('✅ Exchange rates fetched successfully');
    return data.conversion_rates;
  } catch (error) {
    if (!apiCallLogged) {
      logApiCall(false);
    }
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

/**
 * Get API usage statistics
 */
export function getUsageStats() {
  const usage = getMonthlyUsage();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyLogs = apiCallLogs.filter(log => log.timestamp >= firstDayOfMonth);
  
  return {
    monthly: {
      total: usage.count,
      limit: usage.limit,
      percentage: parseFloat(usage.percentage.toFixed(2)),
      remaining: usage.limit - usage.count,
    },
    recent: {
      last30Days: apiCallLogs.length,
      thisMonth: monthlyLogs.length,
      successful: monthlyLogs.filter(log => log.success).length,
      failed: monthlyLogs.filter(log => !log.success).length,
    },
    warnings: usage.percentage >= WARNING_THRESHOLD * 100 ? ['Approaching monthly limit'] : [],
  };
}
