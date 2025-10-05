/**
 * ML API Service
 * Handles communication with ML prediction endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface MLPrediction {
  symbol: string;
  model: string;
  predictions: number[];
  dates: string[];
  last_price: number;
  final_prediction: number;
  change: number;
  change_percent: number;
  trend: 'bullish' | 'bearish';
  confidence: number;
}

export interface EnsemblePrediction {
  lstm: MLPrediction;
  rnn: MLPrediction;
  ensemble: {
    final_prediction: number;
    change: number;
    change_percent: number;
    trend: 'bullish' | 'bearish';
    confidence: number;
  };
}

export type PredictionData = MLPrediction | EnsemblePrediction;

export interface ModelStatus {
  lstm_loaded: boolean;
  rnn_loaded: boolean;
  models_loaded: boolean;
  available_models: string[];
}

export interface ModelAccuracy {
  lstm: {
    accuracy: number;
    rmse: number;
    mae: number;
    status: string;
  };
  rnn: {
    accuracy: number;
    rmse: number;
    mae: number;
    status: string;
  };
  ensemble: {
    accuracy: number;
    rmse: number;
    mae: number;
    status: string;
  };
}

class MLAPIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/v1/ml`;
  }

  async getModelStatus(): Promise<ModelStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.status;
    } catch (error) {
      console.error('Error fetching model status:', error);
      throw error;
    }
  }

  async predictStock(
    symbol: string, 
    days: number = 30, 
    model?: 'lstm' | 'rnn' | 'ensemble'
  ): Promise<PredictionData> {
    try {
      const params = new URLSearchParams({
        symbol,
        days: days.toString(),
        ...(model && { model })
      });

      const url = `${this.baseUrl}/predict/${symbol}?${params}`;
      console.log('Making API request to:', url);

      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      
      if (!data.success) {
        throw new Error(data.detail || 'Prediction failed');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error predicting stock:', error);
      throw error;
    }
  }

  async predictBatch(
    symbols: string[], 
    days: number = 30, 
    model?: 'lstm' | 'rnn' | 'ensemble'
  ): Promise<PredictionData[]> {
    try {
      const params = new URLSearchParams({
        symbols: symbols.join(','),
        days: days.toString(),
        ...(model && { model })
      });

      const response = await fetch(`${this.baseUrl}/predictions/batch?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.detail || 'Batch prediction failed');
      }
      
      return data.data.filter((pred: PredictionData & { error?: string }) => !pred.error);
    } catch (error) {
      console.error('Error in batch prediction:', error);
      throw error;
    }
  }

  async getModelAccuracy(): Promise<ModelAccuracy> {
    try {
      const response = await fetch(`${this.baseUrl}/models/accuracy`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.detail || 'Failed to get model accuracy');
      }
      
      return data.data;
    } catch (error) {
      console.error('Error fetching model accuracy:', error);
      throw error;
    }
  }
}

export const mlApiService = new MLAPIService();
