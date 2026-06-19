import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request bodies parsing
  app.use(express.json());

  app.get('/api/proxy/list', async (req, res) => {
    const token = req.headers['authorization'];
    if (!token) {
      return res.status(401).json({ error: 'Authorization header is missing' });
    }

    try {
      const targetUrl = 'https://proxy.webshare.io/api/proxy/list/';
      
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': token
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `API Error: ${response.status}` });
      }

      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      console.error('Error fetching proxy list:', e);
      res.status(500).json({ error: e.message || 'Failed to fetch proxy list' });
    }
  });

  // Bulk proxy and profile stats loader
  app.post('/api/proxy/fetch-bulk', async (req, res) => {
    const { accounts } = req.body;
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ error: 'Accounts array is required' });
    }

    const settledResultsRaw = await Promise.allSettled(
      accounts.map(async (acc: { alias: string; token: string }) => {
        const tokenStr = acc.token.startsWith('Token ') ? acc.token : `Token ${acc.token}`;
        const started = Date.now();

        try {
          // Fetch proxy list
          const listPromise = fetch('https://proxy.webshare.io/api/proxy/list/?page_size=250', {
            method: 'GET',
            headers: { 'Authorization': tokenStr }
          });

          // Fetch profile for bandwidth usage info
          const profilePromise = fetch('https://proxy.webshare.io/api/profile/', {
            method: 'GET',
            headers: { 'Authorization': tokenStr }
          });

          // Fetch subscription for billing/plan info
          const subPromise = fetch('https://proxy.webshare.io/api/subscription/', {
            method: 'GET',
            headers: { 'Authorization': tokenStr }
          });

          const [listRes, profileRes, subRes] = await Promise.all([listPromise, profilePromise, subPromise]);

          if (!listRes.ok) {
            throw new Error(`API Error ${listRes.status}`);
          }

          const proxyData = await listRes.json();
          let profileData = null;
          let subscriptionData: any = null;

          if (profileRes.ok) {
            profileData = await profileRes.json();
          }

          if (subRes.ok) {
            subscriptionData = await subRes.json();
          }

          const proxies = proxyData.results || [];
          const validCount = proxies.filter((p: any) => p.valid).length;

          return {
            token_alias: acc.alias,
            token: acc.token,
            status: 'success',
            stats: {
              total: proxies.length,
              valid: validCount,
              invalid: proxies.length - validCount
            },
            profile: profileData ? {
              bandwidth_limit: profileData.plan?.bandwidth_limit || 0,
              bandwidth_used: profileData.plan?.bandwidth_used || 0,
              plan_name: profileData.plan?.name || null,
              plan_price: profileData.plan?.price ?? null,
              plan_currency: profileData.plan?.currency || 'USD',
              auto_prolong: profileData.plan?.auto_prolong ?? false,
              next_billing_date: subscriptionData?.next_billing_date || null,
              latency_ms: Date.now() - started,
              last_updated: new Date().toISOString(),
            } : null,
            proxies: proxies
          };
        } catch (err: any) {
          return {
            token_alias: acc.alias,
            token: acc.token,
            status: 'error',
            error_message: err.message || 'Connection failed',
            stats: { total: 0, valid: 0, invalid: 0 },
            profile: null,
            proxies: [],
            latency_ms: Date.now() - started,
            last_updated: new Date().toISOString(),
          };
        }
      })
    );

    const settledResults = settledResultsRaw.map((r, idx) =>
      r.status === 'fulfilled' ? r.value : {
        token_alias: accounts[idx].alias,
        token: accounts[idx].token,
        status: 'error',
        error_message: r.reason?.message || 'Unknown failure',
        stats: { total: 0, valid: 0, invalid: 0 },
        profile: null,
        proxies: [],
        latency_ms: 0,
        last_updated: new Date().toISOString(),
      }
    );

    // Compute summary
    let total_proxies = 0;
    let total_valid = 0;
    let total_invalid = 0;
    let total_bandwidth_used = 0;
    let total_bandwidth_limit = 0;

    settledResults.forEach(r => {
      total_proxies += r.stats.total;
      total_valid += r.stats.valid;
      total_invalid += r.stats.invalid;
      if (r.profile) {
        total_bandwidth_used += r.profile.bandwidth_used;
        total_bandwidth_limit += r.profile.bandwidth_limit;
      }
    });

    res.json({
      summary: {
        total_proxies,
        total_valid,
        total_invalid,
        total_bandwidth_used,
        total_bandwidth_limit
      },
      groups: settledResults
    });
  });

  // Change credentials (PATCH https://proxy.webshare.io/api/v2/proxy/config/)
  app.patch('/api/proxy/update-credentials', async (req, res) => {
    const { token, username, password } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenStr = token.startsWith('Token ') ? token : `Token ${token}`;

    try {
      const response = await fetch('https://proxy.webshare.io/api/v2/proxy/config/', {
        method: 'PATCH',
        headers: {
          'Authorization': tokenStr,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Webshare configuration error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Error updating credentials:', err);
      res.status(500).json({ error: err.message || 'Failed to update credentials' });
    }
  });

  // On-demand replacement of IP addresses
  app.post('/api/proxy/replace-ips', async (req, res) => {
    const { token, ips, replacement_all } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const tokenStr = token.startsWith('Token ') ? token : `Token ${token}`;

    try {
      const response = await fetch('https://proxy.webshare.io/api/v2/proxy/replacement/', {
        method: 'POST',
        headers: {
          'Authorization': tokenStr,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ips,
          replacement_all: !!replacement_all
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Webshare replacement error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Error replacing IPs:', err);
      res.status(500).json({ error: err.message || 'Failed to request IP replacement' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
