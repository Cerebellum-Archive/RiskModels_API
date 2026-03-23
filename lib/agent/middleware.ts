/**
 * Agent API Middleware
 *
 * Wrapper functions that add agent-specific functionality to API routes:
 * - Pricing headers (X-API-Cost-USD)
 * - Latency tracking
 * - Confidence scores
 * - Request IDs
 * - Telemetry logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCapability, calculateEstimatedCost, Capability } from './capabilities';
import { logTelemetry, generateRequestId, getConfidenceScore } from './telemetry';

export interface AgentMetadata {
  cost_usd: number;
  cost_currency: string;
  latency_ms: number;
  request_id: string;
  confidence?: {
    overall: number;
    factors: Record<string, number>;
  };
  data_freshness?: string;
  billing_code?: string;
}

export interface AgentResponseOptions {
  capabilityId: string;
  itemCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  includeConfidence?: boolean;
  dataFreshness?: Date;
}

/**
 * Wrap an API handler with agent-friendly features
 *
 * Usage:
 * ```typescript
 * export const GET = withAgentFeatures(
 *   async (req) => {
 *     // Your handler logic
 *     return NextResponse.json(data);
 *   },
 *   { capabilityId: 'ticker-returns' }
 * );
 * ```
 */
export function withAgentFeatures(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: AgentResponseOptions
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    // Get capability info
    const capability = getCapability(options.capabilityId);

    try {
      // Execute the handler
      const response = await handler(req);
      const latencyMs = Date.now() - startTime;

      // Calculate cost
      const costUsd = capability
        ? calculateEstimatedCost(options.capabilityId, {
            itemCount: options.itemCount,
            inputTokens: options.inputTokens,
            outputTokens: options.outputTokens,
          })
        : 0;

      // Clone the response to add headers
      const newResponse = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // Add agent headers
      newResponse.headers.set('X-Request-ID', requestId);
      newResponse.headers.set('X-Response-Latency-Ms', String(latencyMs));

      if (capability) {
        newResponse.headers.set('X-API-Cost-USD', String(costUsd));
        newResponse.headers.set('X-API-Cost-Currency', 'USD');
        newResponse.headers.set('X-API-Billing-Code', capability.pricing.billing_code);
      }

      // Add confidence score if requested
      if (options.includeConfidence && capability) {
        const { score, factors } = await getConfidenceScore(options.capabilityId);
        newResponse.headers.set('X-Confidence-Score', String(score));
        newResponse.headers.set('X-Data-Freshness', options.dataFreshness?.toISOString() || new Date().toISOString());
      }

      // Log telemetry (non-blocking)
      const userId = await extractUserId(req);
      logTelemetry({
        request_id: requestId,
        capability_id: options.capabilityId,
        user_id: userId,
        latency_ms: latencyMs,
        status_code: response.status,
        success: response.status < 400,
        cost_usd: costUsd,
        timestamp: new Date().toISOString(),
      }).catch(console.error);

      return newResponse;
    } catch (error) {
      const latencyMs = Date.now() - startTime;

      // Log error telemetry
      const userId = await extractUserId(req);
      logTelemetry({
        request_id: requestId,
        capability_id: options.capabilityId,
        user_id: userId,
        latency_ms: latencyMs,
        status_code: 500,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }).catch(console.error);

      throw error;
    }
  };
}

/**
 * Augment a JSON response with agent metadata
 *
 * Usage:
 * ```typescript
 * const data = await fetchData();
 * return augmentWithAgentMetadata(
 *   data,
 *   { capabilityId: 'ticker-returns', latencyMs: 150 }
 * );
 * ```
 */
export async function augmentWithAgentMetadata(
  data: any,
  options: {
    capabilityId: string;
    latencyMs: number;
    requestId?: string;
    itemCount?: number;
    includeConfidence?: boolean;
    dataFreshness?: Date;
  }
): Promise<any> {
  const capability = getCapability(options.capabilityId);
  const requestId = options.requestId || generateRequestId();

  const costUsd = capability
    ? calculateEstimatedCost(options.capabilityId, {
        itemCount: options.itemCount,
      })
    : 0;

  const agentMetadata: AgentMetadata = {
    cost_usd: costUsd,
    cost_currency: 'USD',
    latency_ms: options.latencyMs,
    request_id: requestId,
    billing_code: capability?.pricing.billing_code,
  };

  if (options.includeConfidence) {
    const { score, factors } = await getConfidenceScore(options.capabilityId);
    agentMetadata.confidence = {
      overall: score,
      factors,
    };
  }

  if (options.dataFreshness) {
    agentMetadata.data_freshness = options.dataFreshness.toISOString();
  }

  return {
    ...data,
    _agent: agentMetadata,
  };
}

/**
 * Create a standard agent-friendly API response
 *
 * This adds the _agent metadata field to the response body
 * and sets appropriate headers.
 */
export async function createAgentResponse(
  data: any,
  options: {
    capabilityId: string;
    status?: number;
    itemCount?: number;
    includeConfidence?: boolean;
    dataFreshness?: Date;
  }
): Promise<NextResponse> {
  const startTime = Date.now();
  const capability = getCapability(options.capabilityId);
  const requestId = generateRequestId();

  // Augment data with agent metadata
  const augmentedData = await augmentWithAgentMetadata(data, {
    capabilityId: options.capabilityId,
    latencyMs: Date.now() - startTime,
    requestId,
    itemCount: options.itemCount,
    includeConfidence: options.includeConfidence,
    dataFreshness: options.dataFreshness,
  });

  const costUsd = capability
    ? calculateEstimatedCost(options.capabilityId, { itemCount: options.itemCount })
    : 0;

  return NextResponse.json(augmentedData, {
    status: options.status || 200,
    headers: {
      'X-Request-ID': requestId,
      'X-Response-Latency-Ms': String(Date.now() - startTime),
      'X-API-Cost-USD': String(costUsd),
      'X-API-Cost-Currency': 'USD',
      ...(capability && { 'X-API-Billing-Code': capability.pricing.billing_code }),
      ...(options.includeConfidence && { 'X-Confidence-Score': String(augmentedData._agent.confidence.overall) }),
      ...(options.dataFreshness && { 'X-Data-Freshness': options.dataFreshness.toISOString() }),
    },
  });
}

/**
 * Extract user ID from request (if authenticated)
 */
async function extractUserId(req: NextRequest): Promise<string | undefined> {
  // Try to get from auth header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // In a real implementation, you'd validate the token and extract the user ID
    // For now, return undefined as we don't have the user context here
    return undefined;
  }

  return undefined;
}

/**
 * Middleware to add CORS headers for agent API requests
 */
export function withAgentCORS(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}
