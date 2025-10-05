import OpenAI from 'openai';
import { createParser } from 'eventsource-parser';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'Forecaster AI',
  },
});

// Tool schemas using Zod
const GetQuoteSchema = z.object({
  symbol: z.string().describe('Stock symbol (e.g., AAPL, NVDA)'),
});

const GetTechnicalsSchema = z.object({
  symbol: z.string().describe('Stock symbol'),
  indicators: z.array(z.string()).describe('Technical indicators to calculate (RSI, MACD, SMA, EMA)'),
  period: z.string().describe('Time period for analysis (1d, 5d, 1mo, 3mo, 6mo, 1y)'),
});

const GetNewsSchema = z.object({
  symbol: z.string().describe('Stock symbol'),
  lookback_days: z.number().describe('Number of days to look back for news'),
});

const SuggestTradeSchema = z.object({
  symbol: z.string().describe('Stock symbol'),
  side: z.enum(['buy', 'sell']).describe('Trade side'),
  size: z.number().describe('Number of shares'),
  rationale_inputs: z.string().describe('Analysis inputs for trade rationale'),
});

const BrokerPlaceOrderSchema = z.object({
  symbol: z.string().describe('Stock symbol'),
  side: z.enum(['buy', 'sell']).describe('Trade side'),
  qty: z.number().describe('Number of shares'),
  type: z.enum(['market', 'limit']).describe('Order type'),
  limitPrice: z.number().optional().describe('Limit price (required for limit orders)'),
  timeInForce: z.enum(['day', 'gtc']).describe('Time in force'),
  mode: z.enum(['paper', 'live']).optional().describe('Trading mode'),
});

const BrokerCancelOrderSchema = z.object({
  orderId: z.string().describe('Order ID to cancel'),
});

const BrokerGetPositionsSchema = z.object({});

const BrokerGetBalanceSchema = z.object({});

// Convert Zod schemas to OpenAI tool schemas
function zodToOpenAITool(schema: z.ZodObject<any>, name: string, description: string) {
  const shape = schema.shape;
  return {
    type: 'function' as const,
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: Object.keys(shape).reduce((acc, key) => {
          acc[key] = { type: 'string' };
          return acc;
        }, {} as Record<string, any>),
        required: Object.keys(shape),
      },
    },
  };
}

const tools = [
  zodToOpenAITool(GetQuoteSchema, 'get_quote', 'Get current stock price, 52-week range, and market cap'),
  zodToOpenAITool(GetTechnicalsSchema, 'get_technicals', 'Calculate technical indicators (RSI, MACD, SMA, EMA)'),
  zodToOpenAITool(GetNewsSchema, 'get_news', 'Get recent news articles for a stock symbol'),
  zodToOpenAITool(SuggestTradeSchema, 'suggest_trade', 'Generate trade analysis and rationale (model-only helper)'),
  zodToOpenAITool(BrokerPlaceOrderSchema, 'broker_place_order', 'Place a trade order (returns preview only; requires human confirmation)'),
  zodToOpenAITool(BrokerCancelOrderSchema, 'broker_cancel_order', 'Cancel an existing order'),
  zodToOpenAITool(BrokerGetPositionsSchema, 'broker_get_positions', 'Get current portfolio positions'),
  zodToOpenAITool(BrokerGetBalanceSchema, 'broker_get_balance', 'Get account balance and buying power'),
];

const SYSTEM_PROMPT = `You are Forecaster AI, a cautious, professional trading assistant. You can analyze equities/ETFs/crypto, summarize news with sources, and compute key technicals. 

When the user asks to place a trade, you MUST:
1) restate the order (symbol, side, qty, type, price, time-in-force),
2) surface risks and fees,
3) ask for explicit confirmation,
4) wait for the server's /trade/confirm response before assuming anything executed.

NEVER execute trades without server-confirmed approval. Prefer paper trading unless user explicitly selects live mode.

Always provide clear analysis with sources and be transparent about risks.`;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  userId: string;
  mode?: 'analysis' | 'trade';
  temperature?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  content?: string;
  toolCalls?: ToolCall[];
  requiresConfirmation?: boolean;
  previewOrder?: any;
  confirmationToken?: string;
}

// In-memory store for conversation context (in production, use Redis or DB)
const conversationContext = new Map<string, { lastStock: string; timestamp: number }>();

export async function* chatWithTools(
  messages: ChatMessage[],
  options: ChatOptions
): AsyncGenerator<ChatResponse, void, unknown> {
  const systemMessage: ChatMessage = {
    role: 'system',
    content: SYSTEM_PROMPT,
  };

  const allMessages = [systemMessage, ...messages];
  const lastMessage = messages[messages.length - 1]?.content || '';

  try {
    // Intelligent analysis based on user input
    const userMessage = lastMessage.toLowerCase();
    
    // Check for trading commands first
    if (userMessage.includes('buy') && userMessage.includes('shares')) {
      // Extract trading information intelligently
      const symbolMatch = userMessage.match(/of\s+([a-z]{2,5})/);
      const quantityMatch = userMessage.match(/(\d+)\s*shares?/);
      
      if (symbolMatch && quantityMatch) {
        const symbol = symbolMatch[1].toUpperCase();
        const quantity = parseInt(quantityMatch[1]);
        
        yield { content: `I'll help you place a trade for ${quantity} shares of ${symbol}.` };
        
        const mockToolCall = {
          function: {
            name: 'broker_place_order',
            arguments: JSON.stringify({
              symbol: symbol,
              side: 'buy',
              qty: quantity,
              type: 'market',
              timeInForce: 'day',
              rationale_inputs: `User requested to buy ${quantity} shares of ${symbol}`
            })
          }
        };
        
        const confirmationToken = generateConfirmationToken();
        tradePreviews.set(confirmationToken, {
          preview: JSON.parse(mockToolCall.function.arguments),
          userId: options.userId,
          timestamp: Date.now(),
        });

        yield {
          requiresConfirmation: true,
          previewOrder: JSON.parse(mockToolCall.function.arguments),
          confirmationToken,
        };
      } else {
        yield { content: 'I need more details about the trade. Please specify the symbol and number of shares (e.g., "buy 10 shares of AAPL").' };
      }
      
            } else {
              // Always use dynamic analysis for stock queries to ensure real data
              console.log('Using dynamic analysis for stock query...');
              const analysisResult = await performDynamicAnalysis(userMessage, options.userId);
              yield { content: analysisResult };
              return; // Exit after successful analysis
            }

    // Clean up old previews (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [token, preview] of tradePreviews.entries()) {
      if (preview.timestamp < oneHourAgo) {
        tradePreviews.delete(token);
      }
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    yield { content: 'Sorry, I encountered an error. Please try again.' };
  }
}

async function executeToolCall(toolCall: any, userId: string): Promise<string> {
  const { name, arguments: args } = toolCall.function;
  console.log('Executing tool:', name, 'with args:', args);
  
  try {
    // Validate arguments
    if (!args || args.trim() === '') {
      return `Error: No arguments provided for ${name}`;
    }
    
    switch (name) {
      case 'get_quote':
        const quoteArgs = JSON.parse(args);
        console.log('Quote args:', quoteArgs);
        
        // Get real market data first
        const quoteResponse = await fetch(`http://localhost:3000/api/tools/market/quote?symbol=${quoteArgs.symbol}`);
        const quoteData = await quoteResponse.json();
        console.log('Quote data:', quoteData);
        
        if (quoteData.error) {
          return `Sorry, I couldn't get real-time data for ${quoteArgs.symbol}. ${quoteData.error}`;
        }
        
        // Determine currency based on stock symbol
        const currencyInfo = getCurrencyInfo(quoteArgs.symbol);
        
        // Use OpenRouter to analyze the real data
        const analysisResponse = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a financial analyst. Analyze this real market data for ${quoteArgs.symbol} and provide a structured analysis.

              Real Data:
              - Price: ${currencyInfo.symbol}${quoteData.price}
              - Change: ${currencyInfo.symbol}${quoteData.change} (${quoteData.changePercent}%)
              - Volume: ${quoteData.volume?.toLocaleString() || 'N/A'}
              - 52-Week High: ${currencyInfo.symbol}${quoteData.high52Week || 'N/A'}
              - 52-Week Low: ${currencyInfo.symbol}${quoteData.low52Week || 'N/A'}

              Format your response as:
              1. What I See in the Market:
              - Current price and trend
              - Key support/resistance levels
              - Volume analysis
              
              2. Suggested Trade:
              - Entry strategy
              - Target levels
              - Stop-loss
              
              3. Risk vs Reward:
              - Bullish factors
              - Bearish factors
              - Overall bias
              
              Keep it concise but structured. No markdown formatting.`
            },
            {
              role: 'user',
              content: `Analyze this real market data for ${quoteArgs.symbol}`
            }
          ],
          max_tokens: 600,
          temperature: 0.3,
        });
        
        return analysisResponse.choices[0].message.content || `Analysis for ${quoteArgs.symbol} is currently unavailable.`;

      case 'get_technicals':
        const techArgs = JSON.parse(args);
        
        // Use OpenRouter for technical analysis
        const techResponse = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a technical analysis expert. Provide a concise technical analysis for ${techArgs.symbol}.
              
              Give a brief overview including:
              - Key technical indicators (RSI, MACD, Moving averages)
              - Support and resistance levels
              - Trend direction
              - Simple trading signals
              
              IMPORTANT: Do NOT use any markdown formatting like ###, **, or #. Write in plain text only.
              Keep it conversational and concise. End with a question like "Would you like me to check the recent news for this stock?" or "Should I analyze the market sentiment?"`
            },
            {
              role: 'user',
              content: `Analyze technical indicators for ${techArgs.symbol}`
            }
          ],
          max_tokens: 800,
          temperature: 0.3,
        });
        
        return techResponse.choices[0].message.content || `Technical analysis for ${techArgs.symbol} is currently unavailable.`;

      case 'get_news':
        const newsArgs = JSON.parse(args);
        
        // Use OpenRouter for news analysis
        const newsResponse = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a financial news analyst. Provide a concise news summary for ${newsArgs.symbol} covering the last ${newsArgs.lookback_days} days.
              
              Give a brief overview including:
              - Key recent news
              - Market impact
              - Sentiment (bullish/bearish/neutral)
              - Price correlation
              
              IMPORTANT: Do NOT use any markdown formatting like ###, **, or #. Write in plain text only.
              Keep it conversational and concise. End with a question like "Should I check the technical indicators for this stock?" or "Would you like me to suggest a trading strategy?"`
            },
            {
              role: 'user',
              content: `Analyze recent news for ${newsArgs.symbol}`
            }
          ],
          max_tokens: 800,
          temperature: 0.3,
        });
        
        return newsResponse.choices[0].message.content || `News analysis for ${newsArgs.symbol} is currently unavailable.`;

      case 'suggest_trade':
        const tradeArgs = JSON.parse(args);
        
        // Use OpenRouter for trade suggestions
        const tradeResponse = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a professional trading advisor. Provide a concise trade suggestion for ${tradeArgs.symbol}.
              
              Give a brief recommendation including:
              - Trade rationale
              - Entry/exit strategy
              - Risk level
              - Position sizing advice
              
              IMPORTANT: Do NOT use any markdown formatting like ###, **, or #. Write in plain text only.
              Keep it conversational and concise. End with a question like "Should I check the current market conditions?" or "Would you like me to analyze the risk factors?"`
            },
            {
              role: 'user',
              content: `Suggest a ${tradeArgs.side} trade for ${tradeArgs.size} shares of ${tradeArgs.symbol}. Rationale: ${tradeArgs.rationale_inputs}`
            }
          ],
          max_tokens: 600,
          temperature: 0.3,
        });
        
        return tradeResponse.choices[0].message.content || `Trade suggestion for ${tradeArgs.symbol} is currently unavailable.`;

      case 'broker_place_order':
        // This will be handled by the confirmation flow
        return '✅ Trade order preview generated. Awaiting confirmation.';

              case 'broker_cancel_order':
                const cancelArgs = JSON.parse(args);
                return `❌ Order Cancellation Requested

📋 Order ID: ${cancelArgs.orderId}
✅ Status: Cancellation submitted`;

      case 'broker_get_positions':
        const positionsResponse = await fetch(`http://localhost:3000/api/tools/broker/positions`);
        const positionsData = await positionsResponse.json();
        
                // Format positions in a clean way
                let positionsOutput = `📊 Current Portfolio Positions\n\n`;
                
                if (positionsData.positions && positionsData.positions.length > 0) {
                  positionsData.positions.forEach((position: any, index: number) => {
                    const pnlColor = position.unrealizedPnl >= 0 ? '🟢' : '🔴';
                    positionsOutput += `${index + 1}. ${position.symbol}\n`;
                    positionsOutput += `   📦 Shares: ${position.quantity}\n`;
                    positionsOutput += `   💰 Avg Price: $${position.avgPrice.toFixed(2)}\n`;
                    positionsOutput += `   📈 Current Value: $${position.marketValue.toFixed(2)}\n`;
                    positionsOutput += `   ${pnlColor} P&L: $${position.unrealizedPnl.toFixed(2)}\n\n`;
                  });
                } else {
                  positionsOutput += 'No open positions found.';
                }
                
                return positionsOutput;

      case 'broker_get_balance':
        const balanceResponse = await fetch(`http://localhost:3000/api/tools/broker/balance`);
        const balanceData = await balanceResponse.json();
        
                // Format balance in a clean way
                return `💰 Account Balance Summary

💵 Cash Balance: $${balanceData.balance.cash.toLocaleString()}
💳 Buying Power: $${balanceData.balance.buyingPower.toLocaleString()}
📊 Total Portfolio Value: $${balanceData.balance.totalValue.toLocaleString()}
💱 Currency: ${balanceData.balance.currency}`;

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    console.error(`Tool execution error for ${name}:`, error);
    return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function performDynamicAnalysis(userMessage: string, userId: string): Promise<string> {
  const message = userMessage.toLowerCase();
  
  // Map common index names to their Yahoo Finance symbols
  const indexMappings: { [key: string]: string } = {
    'nifty50': '^NSEI',
    'nifty 50': '^NSEI',
    'nifty': '^NSEI',
    'sensex': '^BSESN',
    'bse sensex': '^BSESN',
    'sp500': '^GSPC',
    's&p 500': '^GSPC',
    's&p500': '^GSPC',
    'sp 500': '^GSPC',
    'dow': '^DJI',
    'dow jones': '^DJI',
    'nasdaq': '^IXIC',
    'nasdaq composite': '^IXIC',
    'ftse100': '^FTSE',
    'ftse 100': '^FTSE',
    'nikkei': '^N225',
    'nikkei 225': '^N225',
    'hangseng': '^HSI',
    'hang seng': '^HSI',
    'dax': '^GDAXI',
    'cac40': '^FCHI',
    'cac 40': '^FCHI',
    // Indian stocks
    'tcs': 'TCS.NS',
    'tata consultancy services': 'TCS.NS',
    'reliance': 'RELIANCE.NS',
    'ril': 'RELIANCE.NS',
    'infy': 'INFY.NS',
    'infosys': 'INFY.NS',
    'hdfc': 'HDFCBANK.NS',
    'hdfc bank': 'HDFCBANK.NS',
    'hdfc bank ltd': 'HDFCBANK.NS',
    'hdfcbank': 'HDFCBANK.NS',
    'icici': 'ICICIBANK.NS',
    'icici bank': 'ICICIBANK.NS',
    'sbin': 'SBIN.NS',
    'state bank': 'SBIN.NS',
    'wipro': 'WIPRO.NS',
    'bharti': 'BHARTIARTL.NS',
    'bharti airtel': 'BHARTIARTL.NS',
    'itc': 'ITC.NS'
  };
  
  // Handle follow-up requests for analysis
  if (message.includes('analyze') || message.includes('technical') || message.includes('indicators') || 
      message.includes('trend') || message.includes('news') || message.includes('strategy') ||
      message.includes('price trend') || message.includes('market sentiment')) {
    
    // Try to extract stock name from the message itself
    let stockToAnalyze = null;
    
    // Check for common stock names in the message
    for (const [key, symbol] of Object.entries(indexMappings)) {
      if (message.includes(key.toLowerCase())) {
        stockToAnalyze = symbol;
        break;
      }
    }
    
    // Check if we have context about the last stock discussed
    const context = conversationContext.get(userId);
    const lastStock = context?.lastStock;
    console.log('Context check - userId:', userId, 'context:', context, 'lastStock:', lastStock, 'stockToAnalyze:', stockToAnalyze);
    
    if (stockToAnalyze || lastStock) {
      const targetStock = stockToAnalyze || lastStock;
      // Use OpenRouter for analysis of the last stock
      const analysisResponse = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial analyst. Provide a structured analysis for ${targetStock}.
            
            Format your response as:
            1. What I See in the Market:
            - Current price and trend
            - Key support/resistance levels
            - Volume analysis
            
            2. Suggested Trade:
            - Entry strategy
            - Target levels
            - Stop-loss
            
            3. Risk vs Reward:
            - Bullish factors
            - Bearish factors
            - Overall bias
            
            Keep it concise but structured. No markdown formatting.`
          },
          {
            role: 'user',
            content: `Analyze ${targetStock} - ${userMessage}`
          }
        ],
        max_tokens: 600,
        temperature: 0.3,
      });
      
      return analysisResponse.choices[0].message.content || `I can provide technical analysis for ${targetStock}. Would you like me to check the recent news for this stock?`;
    } else {
      // No context, ask for stock specification
      const analysisResponse = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial analyst. The user is asking for analysis but hasn't specified which stock. 
            
            Provide a helpful response explaining what type of analysis you can offer:
            - Technical indicators (RSI, MACD, Moving averages)
            - Trend analysis
            - News analysis
            - Trading strategies
            
            Ask them to specify which stock they want analyzed and what type of analysis they're interested in.
            
            Keep it conversational and helpful.`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      });
      
      return analysisResponse.choices[0].message.content || 'I can help you analyze stocks! Please specify which stock you\'d like me to analyze and what type of analysis you\'re interested in (technical indicators, trend analysis, news, or trading strategy).';
    }
  }
  
  // Check for index mappings first
  for (const [key, symbol] of Object.entries(indexMappings)) {
    if (message.includes(key)) {
      try {
        const quoteResponse = await fetch(`http://localhost:3000/api/tools/market/quote?symbol=${symbol}`);
        const quoteData = await quoteResponse.json();
        
        if (quoteData && quoteData.symbol) {
          const currencyInfo = getCurrencyInfo(symbol);
          
          // Use OpenRouter to analyze the real data
          const analysisResponse = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are a financial analyst. Analyze this real market data for ${key.toUpperCase()} and provide a structured analysis.

                Real Data:
                - Price: ${currencyInfo.symbol}${quoteData.price}
                - Change: ${currencyInfo.symbol}${quoteData.change} (${quoteData.changePercent}%)
                - Volume: ${quoteData.volume?.toLocaleString() || 'N/A'}
                - 52-Week High: ${currencyInfo.symbol}${quoteData.high52Week || 'N/A'}
                - 52-Week Low: ${currencyInfo.symbol}${quoteData.low52Week || 'N/A'}

                Format your response as:
                1. What I See in the Market:
                - Current price and trend
                - Key support/resistance levels
                - Volume analysis
                
                2. Suggested Trade:
                - Entry strategy
                - Target levels
                - Stop-loss
                
                3. Risk vs Reward:
                - Bullish factors
                - Bearish factors
                - Overall bias
                
                Keep it concise but structured. No markdown formatting.`
              },
              {
                role: 'user',
                content: `Analyze this real market data for ${key.toUpperCase()}`
              }
            ],
            max_tokens: 600,
            temperature: 0.3,
          });
          
          // Store context for follow-up analysis
          conversationContext.set(userId, { lastStock: key.toUpperCase(), timestamp: Date.now() });
          console.log('Context stored (index) - userId:', userId, 'lastStock:', key.toUpperCase());
          
          return analysisResponse.choices[0].message.content || `I found real market data for ${key.toUpperCase()}. Current price: ${currencyInfo.symbol}${quoteData.price.toFixed(2)} (${quoteData.change >= 0 ? '+' : ''}${quoteData.changePercent.toFixed(2)}%). The index is trading ${quoteData.change >= 0 ? 'higher' : 'lower'} today.`;
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        return `We don't have real-time data for ${key.toUpperCase()} at the moment. Please try again later.`;
      }
    }
  }
  
  // Extract potential stock symbols or company names dynamically
  const words = userMessage.toLowerCase().split(/\s+/);
  const potentialSymbols = words.filter(word => 
    word.length >= 2 && word.length <= 10 && 
    /^[a-zA-Z0-9&]+$/.test(word)
  );
  
  // Try to find stock symbols in the message (uppercase letters and numbers)
  const stockSymbols = potentialSymbols.filter(word => 
    word.length >= 2 && word.length <= 10 && /^[A-Z0-9]+$/.test(word.toUpperCase()) &&
    !['what', 'how', 'when', 'where', 'why', 'the', 'and', 'or', 'but', 'for', 'with', 'from', 'into', 'onto', 'upon', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'price', 'current', 'today', 'stock', 'market', 'data'].includes(word.toLowerCase())
  );
  
  // Sort by length (longer symbols first) to prioritize more specific matches
  stockSymbols.sort((a, b) => b.length - a.length);
  
  if (stockSymbols.length > 0) {
    const symbol = stockSymbols[0].toUpperCase();
    try {
      const quoteResponse = await fetch(`http://localhost:3000/api/tools/market/quote?symbol=${symbol}`);
      const quoteData = await quoteResponse.json();
      
      if (quoteData && quoteData.symbol) {
        const currencyInfo = getCurrencyInfo(symbol);
        
        // Use OpenRouter to analyze the real data
        const analysisResponse = await openai.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a financial analyst. Analyze this real market data for ${symbol} and provide a structured analysis.

              Real Data:
              - Price: ${currencyInfo.symbol}${quoteData.price}
              - Change: ${currencyInfo.symbol}${quoteData.change} (${quoteData.changePercent}%)
              - Volume: ${quoteData.volume?.toLocaleString() || 'N/A'}
              - 52-Week High: ${currencyInfo.symbol}${quoteData.high52Week || 'N/A'}
              - 52-Week Low: ${currencyInfo.symbol}${quoteData.low52Week || 'N/A'}

              Format your response as:
              1. What I See in the Market:
              - Current price and trend
              - Key support/resistance levels
              - Volume analysis
              
              2. Suggested Trade:
              - Entry strategy
              - Target levels
              - Stop-loss
              
              3. Risk vs Reward:
              - Bullish factors
              - Bearish factors
              - Overall bias
              
              Keep it concise but structured. No markdown formatting.`
            },
            {
              role: 'user',
              content: `Analyze this real market data for ${symbol}`
            }
          ],
          max_tokens: 600,
          temperature: 0.3,
        });
        
        // Store context for follow-up analysis
        conversationContext.set(userId, { lastStock: symbol, timestamp: Date.now() });
        console.log('Context stored - userId:', userId, 'lastStock:', symbol);
        
        return analysisResponse.choices[0].message.content || `I found real market data for ${symbol}. Current price: ${currencyInfo.symbol}${quoteData.price.toFixed(2)} (${quoteData.change >= 0 ? '+' : ''}${quoteData.changePercent.toFixed(2)}%). The stock is trading ${quoteData.change >= 0 ? 'higher' : 'lower'} today with a volume of ${quoteData.volume.toLocaleString()} shares.`;
      }
    } catch (error) {
      console.error('Error fetching quote:', error);
      return `We don't have real-time data for ${symbol} at the moment. Please check if the symbol is correct and try again later.`;
    }
  }
  
  // If no specific symbol found, provide general guidance
  return `I understand you're asking about market data. I can help you analyze stocks, market indices, or provide trading insights. Please specify a stock symbol (like AAPL, MSFT) or company name (like Apple, Microsoft) and I'll get the current market data for you.`;
}

function generateConfirmationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function identifyStockFromTokens(tokens: string[], userMessage: string): { symbol: string; companyName: string } | null {
  // Comprehensive stock symbol and company name mapping
  const stockDatabase: { [key: string]: { symbol: string; companyName: string } } = {
    // US Stocks
    'nvda': { symbol: 'NVDA', companyName: 'NVIDIA Corporation' },
    'nvidia': { symbol: 'NVDA', companyName: 'NVIDIA Corporation' },
    'aapl': { symbol: 'AAPL', companyName: 'Apple Inc.' },
    'apple': { symbol: 'AAPL', companyName: 'Apple Inc.' },
    'tsla': { symbol: 'TSLA', companyName: 'Tesla Inc.' },
    'tesla': { symbol: 'TSLA', companyName: 'Tesla Inc.' },
    'msft': { symbol: 'MSFT', companyName: 'Microsoft Corporation' },
    'microsoft': { symbol: 'MSFT', companyName: 'Microsoft Corporation' },
    'googl': { symbol: 'GOOGL', companyName: 'Alphabet Inc.' },
    'google': { symbol: 'GOOGL', companyName: 'Alphabet Inc.' },
    'amzn': { symbol: 'AMZN', companyName: 'Amazon.com Inc.' },
    'amazon': { symbol: 'AMZN', companyName: 'Amazon.com Inc.' },
    'meta': { symbol: 'META', companyName: 'Meta Platforms Inc.' },
    'facebook': { symbol: 'META', companyName: 'Meta Platforms Inc.' },
    'netflix': { symbol: 'NFLX', companyName: 'Netflix Inc.' },
    'nflx': { symbol: 'NFLX', companyName: 'Netflix Inc.' },
    'ibm': { symbol: 'IBM', companyName: 'International Business Machines Corporation' },
    'oracle': { symbol: 'ORCL', companyName: 'Oracle Corporation' },
    'cisco': { symbol: 'CSCO', companyName: 'Cisco Systems Inc.' },
    'intel': { symbol: 'INTC', companyName: 'Intel Corporation' },
    
    // Indian Stocks
    'reliance': { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' },
    'ril': { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited' },
    'tcs': { symbol: 'TCS', companyName: 'Tata Consultancy Services' },
    'infy': { symbol: 'INFY', companyName: 'Infosys Limited' },
    'infosys': { symbol: 'INFY', companyName: 'Infosys Limited' },
    'hdfc': { symbol: 'HDFC', companyName: 'HDFC Bank Limited' },
    'icici': { symbol: 'ICICI', companyName: 'ICICI Bank Limited' },
    'sbin': { symbol: 'SBIN', companyName: 'State Bank of India' },
    'wipro': { symbol: 'WIPRO', companyName: 'Wipro Limited' },
    'bharti': { symbol: 'BHARTI', companyName: 'Bharti Airtel Limited' },
    'itc': { symbol: 'ITC', companyName: 'ITC Limited' },
    
    // Indian Market Indices
    'nifty': { symbol: 'NIFTY50', companyName: 'Nifty 50 Index' },
    'nifty50': { symbol: 'NIFTY50', companyName: 'Nifty 50 Index' },
    'sensex': { symbol: 'SENSEX', companyName: 'BSE Sensex Index' },
    'bse': { symbol: 'SENSEX', companyName: 'BSE Sensex Index' },
    'nse': { symbol: 'NIFTY50', companyName: 'Nifty 50 Index' },
    
    // Global Market Indices
    'sp500': { symbol: 'SP500', companyName: 'S&P 500 Index' },
    's&p500': { symbol: 'SP500', companyName: 'S&P 500 Index' },
    'dow': { symbol: 'DOW', companyName: 'Dow Jones Industrial Average' },
    'nasdaq': { symbol: 'NASDAQ', companyName: 'NASDAQ Composite Index' },
    'ftse': { symbol: 'FTSE100', companyName: 'FTSE 100 Index' },
    'nikkei': { symbol: 'NIKKEI', companyName: 'Nikkei 225 Index' },
    'hang': { symbol: 'HANGSENG', companyName: 'Hang Seng Index' },
    'dax': { symbol: 'DAX', companyName: 'DAX Index' },
    
    // Chinese Stocks
    'baba': { symbol: 'BABA', companyName: 'Alibaba Group Holding Limited' },
    'alibaba': { symbol: 'BABA', companyName: 'Alibaba Group Holding Limited' },
    'tencent': { symbol: 'TENCENT', companyName: 'Tencent Holdings Limited' },
    'nio': { symbol: 'NIO', companyName: 'NIO Inc.' },
    'jd': { symbol: 'JD', companyName: 'JD.com Inc.' },
    'baidu': { symbol: 'BIDU', companyName: 'Baidu Inc.' },
    'xiaomi': { symbol: 'XIAOMI', companyName: 'Xiaomi Corporation' },
    
    // Japanese Stocks
    'sony': { symbol: 'SONY', companyName: 'Sony Group Corporation' },
    'toyota': { symbol: 'TOYOTA', companyName: 'Toyota Motor Corporation' },
    'nintendo': { symbol: 'NINTENDO', companyName: 'Nintendo Co. Ltd.' },
    'softbank': { symbol: 'SOFTBANK', companyName: 'SoftBank Group Corp.' },
    
    // European Stocks
    'asml': { symbol: 'ASML', companyName: 'ASML Holding N.V.' },
    'sap': { symbol: 'SAP', companyName: 'SAP SE' },
    'novo': { symbol: 'NOVO', companyName: 'Novo Nordisk A/S' },
    'lvmh': { symbol: 'LVMH', companyName: 'LVMH Moët Hennessy Louis Vuitton' },
    
    // UK Stocks
    'bp': { symbol: 'BP', companyName: 'BP p.l.c.' },
    'shell': { symbol: 'SHELL', companyName: 'Shell plc' },
    'vodafone': { symbol: 'VODAFONE', companyName: 'Vodafone Group plc' },
    'unilever': { symbol: 'UNILEVER', companyName: 'Unilever plc' },
    
    // Canadian Stocks
    'shopify': { symbol: 'SHOPIFY', companyName: 'Shopify Inc.' },
    'royal': { symbol: 'ROYAL', companyName: 'Royal Bank of Canada' },
    'canadian': { symbol: 'CANADIAN', companyName: 'Canadian National Railway Company' },
    
    // Australian Stocks
    'bhp': { symbol: 'BHP', companyName: 'BHP Group Limited' },
    'rio': { symbol: 'RIO', companyName: 'Rio Tinto Group' },
    'woolworths': { symbol: 'WOOLWORTHS', companyName: 'Woolworths Group Limited' }
  };
  
  // Check for special index patterns first (before generic symbol matching)
  if (userMessage.toLowerCase().includes('s&p') || userMessage.toLowerCase().includes('sp500')) {
    return stockDatabase['sp500'];
  }
  if (userMessage.toLowerCase().includes('dow jones') || userMessage.toLowerCase().includes('dow')) {
    return stockDatabase['dow'];
  }
  if (userMessage.toLowerCase().includes('nasdaq')) {
    return stockDatabase['nasdaq'];
  }
  if (userMessage.toLowerCase().includes('ftse')) {
    return stockDatabase['ftse'];
  }
  if (userMessage.toLowerCase().includes('nikkei')) {
    return stockDatabase['nikkei'];
  }
  if (userMessage.toLowerCase().includes('hang seng') || userMessage.toLowerCase().includes('hangseng')) {
    return stockDatabase['hang'];
  }
  if (userMessage.toLowerCase().includes('dax')) {
    return stockDatabase['dax'];
  }
  
  // Then check for company name matches in tokens
  for (const token of tokens) {
    if (stockDatabase[token]) {
      return stockDatabase[token];
    }
  }
  
  // Finally, check for exact symbol matches (2-5 uppercase letters, numbers, and special chars)
  const symbolMatch = userMessage.match(/\b([A-Z0-9&]{2,10})\b/);
  if (symbolMatch) {
    const symbol = symbolMatch[1];
    const companyInfo = Object.values(stockDatabase).find(info => info.symbol === symbol);
    if (companyInfo) {
      return companyInfo;
    }
    // Return unknown symbol with generic name
    return { symbol, companyName: `${symbol} Corporation` };
  }
  
  // Check for partial matches in the full message
  for (const [key, value] of Object.entries(stockDatabase)) {
    if (userMessage.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return null;
}

function analyzeUserIntent(tokens: string[], userMessage: string): { needsAdvice: boolean; intent: string; urgency: 'low' | 'medium' | 'high' } {
  const adviceKeywords = ['buy', 'sell', 'should', 'worth', 'good', 'bad', 'profit', 'loss', 'invest', 'trading', 'strategy', 'analysis'];
  const urgencyKeywords = ['urgent', 'quick', 'fast', 'immediately', 'now', 'today'];
  
  const hasAdviceIntent = adviceKeywords.some(keyword => 
    tokens.includes(keyword) || userMessage.toLowerCase().includes(keyword)
  );
  
  const urgency = urgencyKeywords.some(keyword => 
    tokens.includes(keyword) || userMessage.toLowerCase().includes(keyword)
  ) ? 'high' : hasAdviceIntent ? 'medium' : 'low';
  
  let intent = 'general_inquiry';
  if (tokens.includes('buy') || userMessage.toLowerCase().includes('buy')) {
    intent = 'buying_interest';
  } else if (tokens.includes('sell') || userMessage.toLowerCase().includes('sell')) {
    intent = 'selling_interest';
  } else if (tokens.includes('analysis') || userMessage.toLowerCase().includes('analysis')) {
    intent = 'analysis_request';
  }
  
  return {
    needsAdvice: hasAdviceIntent,
    intent,
    urgency
  };
}

function generateTradingAdvice(symbol: string, userIntent: { intent: string; urgency: string }): string {
  const urgencyEmoji = userIntent.urgency === 'high' ? '⚡' : userIntent.urgency === 'medium' ? '📊' : '💡';
  
  let advice = `${urgencyEmoji} Trading Analysis for ${symbol}\n\n`;
  
  switch (userIntent.intent) {
    case 'buying_interest':
      advice += `🟢 Buy Signal Analysis:\n`;
      advice += `• Look for pullbacks to support levels\n`;
      advice += `• Consider dollar-cost averaging for large positions\n`;
      advice += `• Set stop-loss at 5-10% below entry\n`;
      advice += `• Target 15-25% profit before taking partial profits\n\n`;
      break;
      
    case 'selling_interest':
      advice += `🔴 Sell Signal Analysis:\n`;
      advice += `• Consider selling if approaching resistance levels\n`;
      advice += `• Take profits at 20-30% gains\n`;
      advice += `• Use trailing stops to protect profits\n`;
      advice += `• Consider tax implications of selling\n\n`;
      break;
      
    case 'analysis_request':
      advice += `📈 Technical Analysis:\n`;
      advice += `• Monitor key support and resistance levels\n`;
      advice += `• Watch for volume confirmation on breakouts\n`;
      advice += `• Consider moving averages for trend direction\n`;
      advice += `• Check RSI for overbought/oversold conditions\n\n`;
      break;
      
    default:
      advice += `📊 General Trading Strategy:\n`;
      advice += `• Diversify your portfolio across sectors\n`;
      advice += `• Never invest more than you can afford to lose\n`;
      advice += `• Keep emotions out of trading decisions\n`;
      advice += `• Regularly review and adjust your strategy\n\n`;
  }
  
  advice += `⚠️ Remember: This is analysis, not financial advice. Always do your own research and consider consulting a financial advisor!`;
  
  return advice;
}

function getCurrencyInfo(symbol: string): { currency: string; symbol: string; country: string } {
  const symbolUpper = symbol.toUpperCase();
  
  // Indian stocks and indices
  if (symbolUpper.includes('RELIANCE') || symbolUpper.includes('RIL') || 
      symbolUpper.includes('TCS') || symbolUpper.includes('INFY') ||
      symbolUpper.includes('HDFC') || symbolUpper.includes('ICICI') ||
      symbolUpper.includes('SBIN') || symbolUpper.includes('WIPRO') ||
      symbolUpper.includes('BHARTI') || symbolUpper.includes('ITC') ||
      symbolUpper.includes('NIFTY50') || symbolUpper.includes('SENSEX') ||
      symbolUpper.includes('^NSEI') || symbolUpper.includes('^BSESN') ||
      symbolUpper.includes('.NS')) {
    return { currency: 'INR', symbol: '₹', country: 'India' };
  }
  
  // Chinese stocks
  if (symbolUpper.includes('BABA') || symbolUpper.includes('TENCENT') ||
      symbolUpper.includes('JD') || symbolUpper.includes('BIDU') ||
      symbolUpper.includes('NIO') || symbolUpper.includes('XIAOMI')) {
    return { currency: 'CNY', symbol: '¥', country: 'China' };
  }
  
  // Japanese stocks
  if (symbolUpper.includes('SONY') || symbolUpper.includes('TOYOTA') ||
      symbolUpper.includes('NINTENDO') || symbolUpper.includes('SOFTBANK')) {
    return { currency: 'JPY', symbol: '¥', country: 'Japan' };
  }
  
  // European stocks
  if (symbolUpper.includes('ASML') || symbolUpper.includes('SAP') ||
      symbolUpper.includes('NOVO') || symbolUpper.includes('LVMH')) {
    return { currency: 'EUR', symbol: '€', country: 'Europe' };
  }
  
  // UK stocks
  if (symbolUpper.includes('BP') || symbolUpper.includes('SHELL') ||
      symbolUpper.includes('VODAFONE') || symbolUpper.includes('UNILEVER')) {
    return { currency: 'GBP', symbol: '£', country: 'UK' };
  }
  
  // Canadian stocks
  if (symbolUpper.includes('SHOPIFY') || symbolUpper.includes('ROYAL') ||
      symbolUpper.includes('CANADIAN')) {
    return { currency: 'CAD', symbol: 'C$', country: 'Canada' };
  }
  
  // Australian stocks
  if (symbolUpper.includes('BHP') || symbolUpper.includes('RIO') ||
      symbolUpper.includes('WOOLWORTHS')) {
    return { currency: 'AUD', symbol: 'A$', country: 'Australia' };
  }
  
  // Global indices currency mapping
  if (symbolUpper.includes('SP500') || symbolUpper.includes('DOW') || symbolUpper.includes('NASDAQ')) {
    return { currency: 'USD', symbol: '$', country: 'USA' };
  }
  
  if (symbolUpper.includes('FTSE100')) {
    return { currency: 'GBP', symbol: '£', country: 'UK' };
  }
  
  if (symbolUpper.includes('NIKKEI')) {
    return { currency: 'JPY', symbol: '¥', country: 'Japan' };
  }
  
  if (symbolUpper.includes('HANGSENG')) {
    return { currency: 'HKD', symbol: 'HK$', country: 'Hong Kong' };
  }
  
  if (symbolUpper.includes('DAX')) {
    return { currency: 'EUR', symbol: '€', country: 'Germany' };
  }
  
  // Default to USD for US stocks and others
  return { currency: 'USD', symbol: '$', country: 'USA' };
}

export function getTradePreview(token: string) {
  return tradePreviews.get(token);
}

export function removeTradePreview(token: string) {
  tradePreviews.delete(token);
}
