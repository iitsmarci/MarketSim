# 📈 MarketSim

> **Make uncertainty visible.**

MarketSim is an offline-first educational tool for exploring the range of outcomes produced by financial assumptions. Built milestone by milestone, it provides a safe, zero-risk sandbox to test investment strategies, visualize percentiles, and compare economic scenarios without relying on external servers.

**[👉 Try MarketSim Live](https://your-project-link.vercel.app)

---

## ⚖️ Disclaimer
**MarketSim is an educational simulation tool. It does not predict future market returns, does not constitute financial advice, and does not guarantee real-world results.** 

---

## ✨ Core Features & Current Scope

The application is currently at **Milestone 7**, featuring a highly optimized architecture and advanced comparative tools:

*   **Offline-First & Privacy by Design:** The product has absolutely no mandatory backend, accounts, analytics, or hidden telemetry. Everything runs locally on your browser.
*   **High-Performance Engine:** A pure TypeScript simulation core runs in a dedicated Web Worker. It presents inspectable nominal or today's-euro percentile bands and statistics without blocking the React frontend.
*   **Scenario A/B Comparison:** Run two editable what-if scenarios sequentially using common random numbers. Compare contributed capital and all seven percentiles (nominal or real terms) through synchronized uncertainty views.
*   **Independent Variables:** Capital, contributions, returns, volatility, inflation, and horizon are fully independent. The jobs share the canonical seed, model, and path count.
*   **Deferred for Future Milestones:** Persistence, history, import/export, PWA, progress/cancellation, advanced models, and native shells.

---

## 💻 Local Development

MarketSim is built with modern web technologies. To run the simulator locally on your machine:

**Requirements:** Node.js 22.12–24 and npm 11.

### Quick Start
```bash
# Install dependencies
npm install

# Start the local development server
npm run dev
