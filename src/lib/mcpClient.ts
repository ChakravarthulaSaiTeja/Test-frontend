import WebSocket from 'ws';

export interface OrderParams {
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: 'market' | 'limit';
  limitPrice?: number;
  timeInForce: 'day' | 'gtc';
  mode?: 'paper' | 'live';
}

export interface Order {
  id: string;
  status: 'submitted' | 'filled' | 'cancelled' | 'rejected';
  symbol: string;
  side: 'buy' | 'sell';
  qty: number;
  type: 'market' | 'limit';
  limitPrice?: number;
  avgPrice?: number;
  submittedAt: string;
  filledAt?: string;
  error?: string;
}

export interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

export interface Balance {
  cash: number;
  buyingPower: number;
  totalValue: number;
  currency: string;
}

class MCPClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      const mcpUrl = process.env.MCP_BROKER_URL || 'ws://localhost:8080/mcp';
      this.ws = new WebSocket(mcpUrl);

      this.ws.on('open', () => {
        console.log('MCP broker connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing MCP message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('MCP broker connection closed');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        console.error('MCP broker connection error:', error);
        this.isConnected = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('Failed to connect to MCP broker:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting to MCP broker in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: any) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.result);
      }
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        reject(new Error('MCP broker not connected'));
        return;
      }

      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  async placeOrder(params: OrderParams): Promise<Order> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.simulateOrder(params);
      }

      const result = await this.sendRequest('place_order', params);
      return result;
    } catch (error) {
      console.error('Error placing order:', error);
      throw new Error(`Failed to place order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return { success: true, message: `Paper order ${orderId} cancelled` };
      }

      const result = await this.sendRequest('cancel_order', { orderId });
      return result;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw new Error(`Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.getSimulatedPositions();
      }

      const result = await this.sendRequest('get_positions', {});
      return result;
    } catch (error) {
      console.error('Error getting positions:', error);
      throw new Error(`Failed to get positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalance(): Promise<Balance> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.getSimulatedBalance();
      }

      const result = await this.sendRequest('get_balance', {});
      return result;
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Paper trading simulation methods
  private simulateOrder(params: OrderParams): Order {
    const order: Order = {
      id: `paper_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      status: 'filled',
      symbol: params.symbol,
      side: params.side,
      qty: params.qty,
      type: params.type,
      limitPrice: params.limitPrice,
      avgPrice: params.type === 'market' ? this.getSimulatedPrice(params.symbol) : params.limitPrice,
      submittedAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    };

    // Store in local storage for persistence
    this.storePaperOrder(order);
    return order;
  }

  private getSimulatedPrice(symbol: string): number {
    // Simple price simulation based on symbol
    const basePrices: { [key: string]: number } = {
      'AAPL': 175.50,
      'NVDA': 450.25,
      'TSLA': 245.80,
      'MSFT': 380.15,
      'GOOGL': 142.30,
    };

    const basePrice = basePrices[symbol] || 100.00;
    const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
    return basePrice * (1 + variation);
  }

  private getSimulatedPositions(): Position[] {
    const stored = localStorage.getItem('paper_positions');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  private getSimulatedBalance(): Balance {
    const stored = localStorage.getItem('paper_balance');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      cash: 100000,
      buyingPower: 100000,
      totalValue: 100000,
      currency: 'USD',
    };
  }

  private storePaperOrder(order: Order) {
    // Update positions
    const positions = this.getSimulatedPositions();
    const existingPosition = positions.find(p => p.symbol === order.symbol);
    
    if (existingPosition) {
      if (order.side === 'buy') {
        const totalCost = existingPosition.qty * existingPosition.avgPrice + order.qty * order.avgPrice!;
        existingPosition.qty += order.qty;
        existingPosition.avgPrice = totalCost / existingPosition.qty;
      } else {
        existingPosition.qty -= order.qty;
        if (existingPosition.qty <= 0) {
          const index = positions.indexOf(existingPosition);
          positions.splice(index, 1);
        }
      }
    } else if (order.side === 'buy') {
      positions.push({
        symbol: order.symbol,
        qty: order.qty,
        avgPrice: order.avgPrice!,
        marketValue: order.qty * order.avgPrice!,
        unrealizedPnL: 0,
        realizedPnL: 0,
      });
    }

    localStorage.setItem('paper_positions', JSON.stringify(positions));

    // Update balance
    const balance = this.getSimulatedBalance();
    const orderValue = order.qty * order.avgPrice!;
    if (order.side === 'buy') {
      balance.cash -= orderValue;
      balance.buyingPower -= orderValue;
    } else {
      balance.cash += orderValue;
      balance.buyingPower += orderValue;
    }
    balance.totalValue = balance.cash + positions.reduce((sum, p) => sum + p.marketValue, 0);

    localStorage.setItem('paper_balance', JSON.stringify(balance));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Singleton instance
let mcpClient: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient();
  }
  return mcpClient;
}

// HTTP fallback for environments without WebSocket support
export class HTTPMCPClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MCP_BROKER_HTTP_URL || 'http://localhost:8080/api';
  }

  async placeOrder(params: OrderParams): Promise<Order> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.simulateOrder(params);
      }

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error placing order via HTTP:', error);
      throw new Error(`Failed to place order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return { success: true, message: `Paper order ${orderId} cancelled` };
      }

      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error cancelling order via HTTP:', error);
      throw new Error(`Failed to cancel order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.getSimulatedPositions();
      }

      const response = await fetch(`${this.baseUrl}/positions`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting positions via HTTP:', error);
      throw new Error(`Failed to get positions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getBalance(): Promise<Balance> {
    try {
      if (process.env.BROKER_ENV === 'paper') {
        return this.getSimulatedBalance();
      }

      const response = await fetch(`${this.baseUrl}/balance`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting balance via HTTP:', error);
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Paper trading simulation methods (same as WebSocket version)
  private simulateOrder(params: OrderParams): Order {
    const order: Order = {
      id: `paper_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      status: 'filled',
      symbol: params.symbol,
      side: params.side,
      qty: params.qty,
      type: params.type,
      limitPrice: params.limitPrice,
      avgPrice: params.type === 'market' ? this.getSimulatedPrice(params.symbol) : params.limitPrice,
      submittedAt: new Date().toISOString(),
      filledAt: new Date().toISOString(),
    };

    this.storePaperOrder(order);
    return order;
  }

  private getSimulatedPrice(symbol: string): number {
    const basePrices: { [key: string]: number } = {
      'AAPL': 175.50,
      'NVDA': 450.25,
      'TSLA': 245.80,
      'MSFT': 380.15,
      'GOOGL': 142.30,
    };

    const basePrice = basePrices[symbol] || 100.00;
    const variation = (Math.random() - 0.5) * 0.02;
    return basePrice * (1 + variation);
  }

  private getSimulatedPositions(): Position[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('paper_positions');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    return [];
  }

  private getSimulatedBalance(): Balance {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('paper_balance');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    return {
      cash: 100000,
      buyingPower: 100000,
      totalValue: 100000,
      currency: 'USD',
    };
  }

  private storePaperOrder(order: Order) {
    if (typeof window === 'undefined') return;

    const positions = this.getSimulatedPositions();
    const existingPosition = positions.find(p => p.symbol === order.symbol);
    
    if (existingPosition) {
      if (order.side === 'buy') {
        const totalCost = existingPosition.qty * existingPosition.avgPrice + order.qty * order.avgPrice!;
        existingPosition.qty += order.qty;
        existingPosition.avgPrice = totalCost / existingPosition.qty;
      } else {
        existingPosition.qty -= order.qty;
        if (existingPosition.qty <= 0) {
          const index = positions.indexOf(existingPosition);
          positions.splice(index, 1);
        }
      }
    } else if (order.side === 'buy') {
      positions.push({
        symbol: order.symbol,
        qty: order.qty,
        avgPrice: order.avgPrice!,
        marketValue: order.qty * order.avgPrice!,
        unrealizedPnL: 0,
        realizedPnL: 0,
      });
    }

    localStorage.setItem('paper_positions', JSON.stringify(positions));

    const balance = this.getSimulatedBalance();
    const orderValue = order.qty * order.avgPrice!;
    if (order.side === 'buy') {
      balance.cash -= orderValue;
      balance.buyingPower -= orderValue;
    } else {
      balance.cash += orderValue;
      balance.buyingPower += orderValue;
    }
    balance.totalValue = balance.cash + positions.reduce((sum, p) => sum + p.marketValue, 0);

    localStorage.setItem('paper_balance', JSON.stringify(balance));
  }
}

// Export the appropriate client based on environment
export function createMCPClient() {
  if (typeof window !== 'undefined' && typeof WebSocket !== 'undefined') {
    return getMCPClient();
  } else {
    return new HTTPMCPClient();
  }
}
