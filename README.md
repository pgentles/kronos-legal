# Kronos Legal

AI-powered analysis of consumer debt complaints against federal statutes (FDCPA, FCRA).

## What it does

Analyzes consumer-submitted descriptions of debt collection or credit reporting conduct and identifies which federal statutes are likely being violated. Returns structured analysis with:
- Matched violations with confidence scores
- Specific statute citations and elements
- Demand letter language templates
- Next steps for the consumer
- Penalty information

## API Endpoints

| Endpoint | Method | Price (USDC) |
|----------|--------|-------------|
| `/api/analyze` | POST | $0.05 |
| `/api/violations` | GET | Free |
| `/api/stats` | GET | Free |
| `/api/history` | GET | $0.05 |
| `/health` | GET | Free |
| `/openapi.json` | GET | Free |

## Architecture

- Express + TypeScript
- X402 payment protocol (USDC on Base network)
- Deployed to Render.com (auto-deploy from main)
- Discoverable on x402scan.com
- In-memory query tracker

## Wallet

Payments go to: `0x421C25445d6CF7B292933D743E698ed24dE36270` (Base/ETH)

## Setup

```bash
npm install
npm run build
npm start
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3002 | Server port |
| `WALLET_ADDRESS` | `0x421C...` | Payment wallet |

## License

MIT
