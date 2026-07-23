/**
 * ============================================================================
 * Toroloom — Public REST API Documentation (OpenAPI 3.0)
 * ============================================================================
 *
 * Serves the OpenAPI specification and a simple HTML documentation page
 * at /api/docs. The spec is generated as a JSON object that describes
 * all public API v1 endpoints.
 *
 * ============================================================================
 */

import { Router, Request, Response } from 'express';

const router = Router();

const API_VERSION = 'v1';
const API_BASE_URL = `/api/${API_VERSION}`;

// ──── OpenAPI Specification ────────────────────────────────────────────────

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Toroloom Public API',
    version: '1.0.0',
    description: `# Toroloom REST API\n\nThird-party developers can access Toroloom market data, portfolio information, and more via this API.\n\n## Authentication\n\nAll API requests require an API key passed via the \`X-API-Key\` header.\n\n\`\`\`\nX-API-Key: tol_abc123def456...\n\`\`\`\n\nGet your API key from the Toroloom app: **More → API Keys** or \`POST /api/user/api-keys\`.\n\n## Scopes\n\nEach API key has scoped permissions. Choose the minimum scopes needed:\n\n| Scope | Access |\n|-------|--------|\n| \`market:read\` | Market indices, stocks, quotes, OHLC, search |\n| \`portfolio:read\` | Holdings, positions |\n| \`trades:read\` | Trade history |\n| \`watchlist:read\` | Watchlists |\n| \`account:read\` | Profile info |\n| \`notifications:read\` | Notifications |\n\n## Rate Limiting\n\n- **200 requests per minute** per API key\n- Exceeding this returns \`429 Too Many Requests\`\n\n## Responses\n\nAll responses follow a standard envelope:\n\n\`\`\`json\n{\n  "success": true,\n  "data": { ... }  // or [...]\n}\n\`\`\`\n\nError responses:\n\n\`\`\`json\n{\n  "success": false,\n  "error": "Error message here"\n}\n\`\`\`\n`,
    contact: {
      name: 'Toroloom Support',
      url: 'https://toroloom.app/support',
    },
  },
  servers: [
    { url: API_BASE_URL, description: 'API v1' },
    { url: 'https://toroloom.up.railway.app/api/v1', description: 'Production' },
  ],
  security: [
    { ApiKeyAuth: [] },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Your Toroloom API key (tol_ prefix)',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Invalid API key' },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      MarketIndex: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          shortName: { type: 'string' },
          currentValue: { type: 'number' },
          change: { type: 'number' },
          changePercent: { type: 'number' },
          isPositive: { type: 'boolean' },
        },
      },
      Stock: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          name: { type: 'string' },
          sector: { type: 'string' },
          price: { type: 'number' },
          change: { type: 'number' },
          changePercent: { type: 'number' },
          marketCap: { type: 'string' },
          volume: { type: 'string' },
          pe: { type: 'number' },
          pb: { type: 'number' },
        },
      },
      Quote: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          price: { type: 'number' },
          change: { type: 'number' },
          changePercent: { type: 'number' },
          open: { type: 'number' },
          high: { type: 'number' },
          low: { type: 'number' },
          volume: { type: 'number' },
        },
      },
      OHLCData: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            open: { type: 'number' },
            high: { type: 'number' },
            low: { type: 'number' },
            close: { type: 'number' },
            volume: { type: 'number' },
          },
        },
      },
      Holding: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          name: { type: 'string' },
          quantity: { type: 'number' },
          buyPrice: { type: 'number' },
          currentPrice: { type: 'number' },
          pnl: { type: 'number' },
          pnlPercent: { type: 'number' },
        },
      },
      Trade: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          type: { type: 'string', enum: ['buy', 'sell'] },
          quantity: { type: 'number' },
          price: { type: 'number' },
          total: { type: 'number' },
          timestamp: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ═══ Market Endpoints ═══
    '/market/indices': {
      get: {
        summary: 'Get all market indices',
        description: 'Returns NIFTY 50, BANKNIFTY, SENSEX, and other indices with current values and changes.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        responses: {
          '200': {
            description: 'List of market indices',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MarketIndex' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/market/stocks': {
      get: {
        summary: 'Get all stocks',
        description: 'Returns the full list of available stocks with price data.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        responses: {
          '200': {
            description: 'List of stocks',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Stock' },
                    },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid API key' },
        },
      },
    },
    '/market/quote/{symbol}': {
      get: {
        summary: 'Get stock quote',
        description: 'Returns real-time quote data for a single stock symbol.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'RELIANCE',
          },
        ],
        responses: {
          '200': {
            description: 'Stock quote data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/Quote' },
                  },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid API key' },
          '404': { description: 'Symbol not found' },
        },
      },
    },
    '/market/quotes': {
      get: {
        summary: 'Get bulk quotes',
        description: 'Returns quotes for multiple stock symbols in a single request.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        parameters: [
          {
            name: 'symbols',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Comma-separated list of symbols',
            example: 'RELIANCE,TCS,INFY',
          },
        ],
        responses: {
          '200': {
            description: 'Array of stock quotes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Quote' },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing symbols parameter' },
        },
      },
    },
    '/market/ohlc/{symbol}': {
      get: {
        summary: 'Get OHLC data',
        description: 'Returns historical OHLC (Open, High, Low, Close) data for charting.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'RELIANCE',
          },
          {
            name: 'interval',
            in: 'query',
            schema: { type: 'string', enum: ['1m', '5m', '15m', '1h', 'day', 'week', 'month'] },
            description: 'Candle interval',
            example: 'day',
          },
          {
            name: 'days',
            in: 'query',
            schema: { type: 'integer', default: 30 },
            description: 'Number of days of data',
            example: 30,
          },
        ],
        responses: {
          '200': {
            description: 'OHLC data array',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/OHLCData' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/market/search': {
      get: {
        summary: 'Search stocks',
        description: 'Search for stocks by symbol or name.',
        tags: ['Market'],
        security: [{ ApiKeyAuth: ['market:read'] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Search query',
            example: 'RELIANCE',
          },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Stock' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══ Portfolio Endpoints ═══
    '/portfolio/holdings': {
      get: {
        summary: 'Get user holdings',
        description: 'Returns the authenticated user\'s portfolio holdings.',
        tags: ['Portfolio'],
        security: [{ ApiKeyAuth: ['portfolio:read'] }],
        responses: {
          '200': {
            description: 'List of holdings',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Holding' },
                    },
                  },
                },
              },
            },
          },
          '403': { description: 'Insufficient permissions (needs portfolio:read scope)' },
        },
      },
    },
    '/portfolio/positions': {
      get: {
        summary: 'Get user positions',
        description: 'Returns the authenticated user\'s open positions.',
        tags: ['Portfolio'],
        security: [{ ApiKeyAuth: ['portfolio:read'] }],
        responses: {
          '200': {
            description: 'List of positions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          symbol: { type: 'string' },
                          quantity: { type: 'number' },
                          buyPrice: { type: 'number' },
                          currentPrice: { type: 'number' },
                          pnl: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/portfolio/trades': {
      get: {
        summary: 'Get trade history',
        description: 'Returns the authenticated user\'s trade history.',
        tags: ['Portfolio'],
        security: [{ ApiKeyAuth: ['trades:read'] }],
        responses: {
          '200': {
            description: 'List of trades',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Trade' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══ Watchlist Endpoints ═══
    '/watchlist': {
      get: {
        summary: 'Get watchlists',
        description: 'Returns the authenticated user\'s watchlists.',
        tags: ['Watchlist'],
        security: [{ ApiKeyAuth: ['watchlist:read'] }],
        responses: {
          '200': {
            description: 'List of watchlists',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          stocks: {
                            type: 'array',
                            items: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══ Account Endpoints ═══
    '/account/profile': {
      get: {
        summary: 'Get account profile',
        description: 'Returns the authenticated user\'s basic profile and key info.',
        tags: ['Account'],
        security: [{ ApiKeyAuth: ['account:read'] }],
        responses: {
          '200': {
            description: 'Profile info',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        userId: { type: 'string' },
                        scopes: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        keyId: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ═══ Notification Endpoints ═══
    '/notifications': {
      get: {
        summary: 'Get notifications',
        description: 'Returns the authenticated user\'s recent notifications.',
        tags: ['Notifications'],
        security: [{ ApiKeyAuth: ['notifications:read'] }],
        responses: {
          '200': {
            description: 'List of notifications',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          type: { type: 'string' },
                          title: { type: 'string' },
                          message: { type: 'string' },
                          read: { type: 'boolean' },
                          timestamp: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  tags: [
    { name: 'Market', description: 'Market data endpoints' },
    { name: 'Portfolio', description: 'Portfolio & trade data endpoints' },
    { name: 'Watchlist', description: 'Watchlist management endpoints' },
    { name: 'Account', description: 'Account information endpoints' },
    { name: 'Notifications', description: 'Notification endpoints' },
  ],
};

// ──── GET /api/docs/openapi.json ───────────────────────────────────────────
// Returns the raw OpenAPI spec as JSON.
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

// ──── GET /api/docs ────────────────────────────────────────────────────────
// Returns a simple HTML documentation page with Swagger UI.
router.get('/', (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Toroloom API Docs</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0E1A; color: #E0E0E0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .topbar { background: #0D1520; border-bottom: 1px solid #1E2A3A; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
    .topbar h1 { font-size: 20px; color: #00D2FF; font-weight: 700; letter-spacing: -0.5px; }
    .topbar span { color: #6C63FF; font-weight: 700; }
    .topbar .version { background: #6C63FF20; color: #6C63FF; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .topbar .badge { background: #00E67620; color: #00E676; padding: 4px 10px; border-radius: 20px; font-size: 11px; margin-left: auto; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #E0E0E0 !important; }
    .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info td { color: #B0B0B0 !important; }
    .swagger-ui .info code { background: #1E2A3A !important; color: #00D2FF !important; }
    .swagger-ui .opblock-tag { color: #E0E0E0 !important; border-bottom: 1px solid #1E2A3A !important; }
    .swagger-ui .opblock-tag:hover { background: #0D1520 !important; }
    .swagger-ui .opblock .opblock-summary-method { font-weight: 700 !important; }
    .swagger-ui .opblock { background: #0D1520 !important; border: 1px solid #1E2A3A !important; margin: 0 0 12px !important; border-radius: 8px !important; }
    .swagger-ui .opblock .opblock-summary { border-bottom: 1px solid #1E2A3A !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #B0B0B0 !important; }
    .swagger-ui .opblock-body { background: #0D1520 !important; }
    .swagger-ui .opblock-body pre { background: #0A0E1A !important; color: #E0E0E0 !important; border: 1px solid #1E2A3A !important; border-radius: 4px !important; }
    .swagger-ui .opblock .opblock-section-header { background: #0D1520 !important; border-bottom: 1px solid #1E2A3A !important; }
    .swagger-ui .opblock .opblock-section-header h4 { color: #E0E0E0 !important; }
    .swagger-ui table thead tr td, .swagger-ui table thead tr th { color: #E0E0E0 !important; border-bottom: 1px solid #1E2A3A !important; }
    .swagger-ui .parameter__name { color: #E0E0E0 !important; }
    .swagger-ui .parameter__type { color: #00D2FF !important; }
    .swagger-ui .model { color: #E0E0E0 !important; }
    .swagger-ui .model-box { background: #0D1520 !important; border: 1px solid #1E2A3A !important; }
    .swagger-ui .model-title { color: #E0E0E0 !important; }
    .swagger-ui .prop-type { color: #00D2FF !important; }
    .swagger-ui .prop-format { color: #6C63FF !important; }
    .swagger-ui .response-col_status { color: #E0E0E0 !important; }
    .swagger-ui .response-col_description { color: #B0B0B0 !important; }
    .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5 { color: #E0E0E0 !important; }
    .swagger-ui .markdown p, .swagger-ui .markdown li { color: #B0B0B0 !important; }
    .swagger-ui .markdown code { background: #1E2A3A !important; color: #00D2FF !important; }
    .swagger-ui .btn { background: #6C63FF !important; border-color: #6C63FF !important; color: #fff !important; }
    .swagger-ui .btn:hover { background: #5B52E0 !important; }
    .swagger-ui select { background: #0D1520 !important; color: #E0E0E0 !important; border: 1px solid #1E2A3A !important; }
    .swagger-ui section.models { border: 1px solid #1E2A3A !important; }
    .swagger-ui section.models.is-open h4 { border-bottom: 1px solid #1E2A3A !important; }
    .swagger-ui .auth-wrapper .authorize { background: #6C63FF20 !important; border-color: #6C63FF !important; color: #6C63FF !important; }
    .swagger-ui .auth-container { background: #0D1520 !important; border: 1px solid #1E2A3A !important; }
    .swagger-ui .auth-container input[type=text] { background: #0A0E1A !important; color: #E0E0E0 !important; border: 1px solid #1E2A3A !important; }
    .swagger-ui .auth-container label { color: #E0E0E0 !important; }
    .swagger-ui .auth-btn-wrapper .btn-done { color: #00E676 !important; }
    .swagger-ui .arrow { fill: #E0E0E0 !important; }
    .swagger-ui .loading-container { padding: 40px; }
    .swagger-ui .loading-container .loading { color: #E0E0E0 !important; }
    .swagger-ui .errors-wrapper { margin-top: 20px !important; }
    .swagger-ui .errors-wrapper hgroup { background: #FF525220 !important; border-color: #FF5252 !important; }
    .swagger-ui .errors-wrapper hgroup h4 { color: #FF5252 !important; }
    .swagger-ui .errors-wrapper hgroup .errors h4 { color: #E0E0E0 !important; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0A0E1A; }
    ::-webkit-scrollbar-thumb { background: #1E2A3A; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #2E3A4A; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Toroloom <span>API</span></h1>
    <span class="version">v${API_VERSION}</span>
    <span class="badge">● Live</span>
  </div>
  <div class="container">
    <div id="swagger-ui"></div>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.min.js"><\/script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
      ],
      defaultModelExpandDepth: 2,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    });
  <\/script>
</body>
</html>`);
});

export default router;
