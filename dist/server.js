import express from 'express';
import cors from 'cors';
import { analyzeText } from './api/analysis.js';
import { ALL_VIOLATIONS } from './data/statutes.js';
const app = express();
const PORT = process.env.PORT || 3002;
const VERSION = '1.0.0';
app.use(cors());
app.use(express.json({ limit: '256kb' }));
// ─── In-Memory Query Tracker ───────────────────────────────────
const queryHistory = [];
const MAX_QUERIES = 500;
function recordQuery(type, path) {
    queryHistory.push({ type, timestamp: new Date().toISOString(), path });
    if (queryHistory.length > MAX_QUERIES)
        queryHistory.shift();
}
// ─── X402 Payment Protocol ──────────────────────────────────────
const BYPASS_PATHS = ['/', '/health', '/openapi.json', '/favicon.ico'];
app.use((req, res, next) => {
    if (BYPASS_PATHS.includes(req.path))
        return next();
    const payment = req.headers['x402-payment'];
    if (!payment) {
        const wallet = process.env.WALLET_ADDRESS || '0x421C25445d6CF7B292933D743E698ed24dE36270';
        const resource = `https://${req.headers.host}${req.path}`;
        const accepts = [{
                network: 'base',
                asset: 'USDC',
                amount: '0.05',
                scheme: 'exact',
                payTo: wallet,
                resource,
            }];
        const body = { x402Version: 2, accepts, wallet, facilitator: 'https://x402scan.com/facilitator' };
        const b64 = Buffer.from(JSON.stringify(body)).toString('base64');
        res.set('X-Payment-Protocol', 'x402');
        res.set('X402-Payment', 'required');
        res.set('Payment-Required', b64);
        return res.status(402).json(body);
    }
    if (req.path.startsWith('/api/') || req.path === '/mcp') {
        recordQuery('paid', req.path);
    }
    next();
});
// ─── Health ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({
        status: 'kronos-legal live',
        version: VERSION,
        endpoints: ['/api/analyze', '/api/violations', '/api/stats'],
        uptime: process.uptime()
    });
});
// ─── OpenAPI Discovery ──────────────────────────────────────────
app.get('/openapi.json', (_req, res) => {
    res.json({
        openapi: '3.1.0',
        info: {
            title: 'Kronos Legal — FDCRA/FCRA Violation Analysis API',
            version: VERSION,
            description: 'AI-powered legal violation analysis for consumer debt and credit reporting complaints. Identifies FDCPA, FCRA, and related statutory violations from consumer-submitted descriptions.',
            contact: { email: 'pgpgentles@gmail.com' },
            'x-guidance': 'Use POST /api/analyze to submit consumer complaints for statutory violation analysis. Use GET /api/violations to browse the statute database. All paid endpoints require X402-Payment header.',
        },
        servers: [{ url: 'https://kronos-legal.onrender.com' }],
        paths: {
            '/api/analyze': {
                post: {
                    operationId: 'analyzeViolations',
                    summary: 'Analyze consumer complaint for statutory violations',
                    tags: ['Legal Analysis'],
                    'x-payment-info': {
                        price: { mode: 'fixed', currency: 'USD', amount: '0.05' },
                        protocols: [{ x402: {} }],
                    },
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        complaint: {
                                            type: 'string',
                                            description: 'Consumer description of debt collector or credit bureau conduct',
                                            examples: ['A debt collector called me 5 times yesterday before 8am and threatened to garnish my wages']
                                        },
                                        state: {
                                            type: 'string',
                                            description: 'US state code for jurisdictional analysis (e.g., FL, CA, TX)',
                                            examples: ['FL']
                                        },
                                    },
                                    required: ['complaint'],
                                },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Violation analysis results',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            matches: { type: 'array', items: { type: 'object' } },
                                            generalAdvice: { type: 'string' },
                                            nextSteps: { type: 'array', items: { type: 'string' } },
                                        },
                                    },
                                },
                            },
                        },
                        '402': {
                            description: 'Payment Required (X402 Protocol)',
                            headers: {
                                'X-Payment-Protocol': { schema: { type: 'string', example: 'x402' } },
                                'Payment-Required': { schema: { type: 'string', description: 'Base64-encoded payment info' } },
                            },
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            x402Version: { type: 'integer' },
                                            accepts: { type: 'array', items: { type: 'object' } },
                                            wallet: { type: 'string' },
                                            facilitator: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/violations': {
                get: {
                    operationId: 'listViolations',
                    summary: 'Browse the statute database (free, no payment required)',
                    tags: ['Legal Reference'],
                    security: [],
                    parameters: [
                        {
                            name: 'act',
                            in: 'query',
                            required: false,
                            schema: { type: 'string', enum: ['FDCPA', 'FCRA'] },
                            description: 'Filter by act type',
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'List of statutory violations',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            count: { type: 'integer' },
                                            violations: { type: 'array', items: { type: 'object' } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/api/stats': {
                get: {
                    operationId: 'queryStats',
                    summary: 'Query statistics (free endpoint)',
                    tags: ['Analytics'],
                    security: [],
                    responses: {
                        '200': {
                            description: 'Running query statistics',
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            totalQueries: { type: 'integer' },
                                            recentQueries: { type: 'array', items: { type: 'object' } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
});
// ─── API: Violation Analysis ────────────────────────────────────
app.post('/api/analyze', (req, res) => {
    const { complaint, state } = req.body;
    if (!complaint || typeof complaint !== 'string' || complaint.trim().length < 10) {
        return res.status(400).json({ error: 'Field "complaint" is required and must be at least 10 characters.' });
    }
    const result = analyzeText(complaint);
    recordQuery('analyze', '/api/analyze');
    res.json({
        ...result,
        state: state || 'general',
        disclaimer: 'This analysis is informational only and does not constitute legal advice. Consult a licensed attorney for formal legal guidance. Statutes and case law change; verify current citations with an attorney.',
    });
});
// ─── API: Violations Database ───────────────────────────────────
app.get('/api/violations', (req, res) => {
    const act = req.query.act;
    const filtered = act
        ? ALL_VIOLATIONS.filter(v => v.act.toUpperCase() === act.toUpperCase())
        : ALL_VIOLATIONS;
    recordQuery('violations', '/api/violations');
    res.json({
        count: filtered.length,
        violations: filtered.map(v => ({
            statute: v.statute,
            act: v.act,
            section: v.section,
            description: v.description,
            penalties: v.penalties,
            deadlines: v.deadlines,
            elements: v.elements,
            commonViolations: v.violations.slice(0, 3),
        })),
    });
});
// ─── API: Query Stats ───────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
    res.json({
        totalQueries: queryHistory.length,
        recentQueries: queryHistory.slice(-50).reverse(),
    });
});
// ─── API: Query History (paid) ──────────────────────────────────
app.get('/api/history', (_req, res) => {
    recordQuery('history', '/api/history');
    res.json({
        total: queryHistory.length,
        recent: queryHistory.slice(-100).reverse(),
    });
});
// ─── Static Files ───────────────────────────────────────────────
app.use(express.static('public'));
app.listen(PORT, () => {
    console.log(`Kronos Legal v${VERSION} running on port ${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/{analyze,violations,stats,history}`);
    console.log(`OpenAPI: http://localhost:${PORT}/openapi.json`);
});
