/**
 * API Error Handling Utilities
 * 
 * Centralized error handling and transformation for all API calls
 */

import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/**
 * Standard error response structure
 */
export interface ApiErrorResponse {
  error: string;
  code?: number | string;
  name?: string;
  details?: Record<string, unknown>;
}

/**
 * Categorized error types for better handling
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER = 'SERVER',
  UTXO = 'UTXO',
  NODE_STATE = 'NODE_STATE',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Enhanced error with category and retry information
 */
export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  originalError: unknown;
  isRetryable: boolean;
  statusCode?: number;
  code?: string;
}

/**
 * UTXO-related error patterns
 */
const UTXO_ERROR_PATTERNS = [
  'not enough UTXOs',
  'insufficient UTXOs',
  'no available UTXOs',
  'no uncolored UTXOs',
];

/**
 * Node state change error patterns
 */
const NODE_STATE_PATTERNS = [
  'node is changing state',
  'node is locked',
  'node is unlocking',
];

/**
 * Extract a readable error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An unknown error occurred';
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle object errors
  if (typeof error === 'object') {
    const err = error as any;

    // Common error message fields (in priority order)
    const messageFields = ['error', 'message', 'detail', 'description', 'msg'];
    
    for (const field of messageFields) {
      if (err[field] && typeof err[field] === 'string') {
        return err[field];
      }
    }

    // Check for nested error objects
    if (err.data && typeof err.data === 'object') {
      return extractErrorMessage(err.data);
    }

    // Handle array errors
    if (Array.isArray(err) && err.length > 0) {
      return extractErrorMessage(err[0]);
    }

    // Last resort: stringify
    try {
      const stringified = JSON.stringify(err);
      return stringified.length > 200 
        ? stringified.substring(0, 200) + '...' 
        : stringified;
    } catch {
      return 'Error occurred (cannot stringify)';
    }
  }

  return String(error);
}

/**
 * Categorize an error based on its content and status code
 */
export function categorizeError(error: unknown, statusCode?: number): CategorizedError {
  const message = extractErrorMessage(error);
  
  // Check for UTXO errors
  if (UTXO_ERROR_PATTERNS.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()))) {
    return {
      category: ErrorCategory.UTXO,
      message,
      originalError: error,
      isRetryable: false,
      statusCode,
    };
  }

  // Check for node state errors
  if (NODE_STATE_PATTERNS.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()))) {
    return {
      category: ErrorCategory.NODE_STATE,
      message,
      originalError: error,
      isRetryable: true,
      statusCode,
    };
  }

  // Categorize by status code
  if (statusCode) {
    switch (true) {
      case statusCode === 401:
        return {
          category: ErrorCategory.AUTHENTICATION,
          message,
          originalError: error,
          isRetryable: false,
          statusCode,
        };
      
      case statusCode === 403:
        return {
          category: ErrorCategory.AUTHORIZATION,
          message,
          originalError: error,
          isRetryable: false,
          statusCode,
        };
      
      case statusCode === 404:
        return {
          category: ErrorCategory.NOT_FOUND,
          message,
          originalError: error,
          isRetryable: false,
          statusCode,
        };
      
      case statusCode === 422:
        return {
          category: ErrorCategory.VALIDATION,
          message,
          originalError: error,
          isRetryable: false,
          statusCode,
        };
      
      case statusCode === 429:
        return {
          category: ErrorCategory.RATE_LIMIT,
          message,
          originalError: error,
          isRetryable: true,
          statusCode,
        };
      
      case statusCode >= 500:
        return {
          category: ErrorCategory.SERVER,
          message,
          originalError: error,
          isRetryable: true,
          statusCode,
        };
    }
  }

  // Check for network errors
  const errorStr = String(error).toLowerCase();
  if (
    errorStr.includes('network') ||
    errorStr.includes('fetch') ||
    errorStr.includes('timeout') ||
    errorStr.includes('connection')
  ) {
    return {
      category: ErrorCategory.NETWORK,
      message,
      originalError: error,
      isRetryable: true,
      statusCode,
    };
  }

  // Default: unknown error
  return {
    category: ErrorCategory.UNKNOWN,
    message,
    originalError: error,
    isRetryable: false,
    statusCode,
  };
}

/**
 * Transform SDK errors into RTK Query error format
 */
export function transformSdkError(error: unknown): FetchBaseQueryError {
  const categorized = categorizeError(error);
  
  return {
    status: categorized.statusCode || 500,
    data: {
      error: categorized.message,
      category: categorized.category,
      code: categorized.code,
    } as ApiErrorResponse,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: CategorizedError): boolean {
  return error.isRetryable;
}

/**
 * Check if an error is a UTXO-related error
 */
export function isUtxoError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return UTXO_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
}

/**
 * Check if an error is a node state change error
 */
export function isNodeStateError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return NODE_STATE_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
}
