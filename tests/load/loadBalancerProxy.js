// tests/load/loadBalancerProxy.js
const http = require('http');

class LoadBalancerProxy {
  constructor(options = {}) {
    this.port = options.port || 4100;
    this.instances = options.instances || []; // [{ id, host, port, isHealthy, isDraining }]
    this.currentIndex = 0;
    this.healthCheckIntervalMs = options.healthCheckIntervalMs || 1000;
    this.healthCheckPath = options.healthCheckPath || '/health';
    this.healthTimer = null;
    this.server = null;
    this.failoverEvents = [];
    this.inFlightRequests = new Map(); // instanceId -> count
  }

  start() {
    return new Promise((resolve) => {
      this.server = http.createServer((clientReq, clientRes) => {
        this.handleRequest(clientReq, clientRes);
      });

      this.server.listen(this.port, () => {
        this.startHealthChecks();
        resolve({ port: this.port });
      });
    });
  }

  getNextHealthyInstance() {
    const available = this.instances.filter(inst => inst.isHealthy && !inst.isDraining);
    if (available.length === 0) return null;
    const inst = available[this.currentIndex % available.length];
    this.currentIndex++;
    return inst;
  }

  handleRequest(clientReq, clientRes) {
    const instance = this.getNextHealthyInstance();
    if (!instance) {
      clientRes.writeHead(503, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'No healthy upstream instances available' }));
      return;
    }

    const currentInFlight = this.inFlightRequests.get(instance.id) || 0;
    this.inFlightRequests.set(instance.id, currentInFlight + 1);

    const proxyOptions = {
      hostname: instance.host,
      port: instance.port,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        'x-forwarded-for': clientReq.socket.remoteAddress,
        'x-forwarded-proto': clientReq.headers['x-forwarded-proto'] || 'https',
        'x-proxy-instance': instance.id
      }
    };

    const proxyReq = http.request(proxyOptions, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(clientRes);

      proxyRes.on('end', () => {
        const remaining = (this.inFlightRequests.get(instance.id) || 1) - 1;
        this.inFlightRequests.set(instance.id, Math.max(0, remaining));
      });
    });

    proxyReq.on('error', (err) => {
      const remaining = (this.inFlightRequests.get(instance.id) || 1) - 1;
      this.inFlightRequests.set(instance.id, Math.max(0, remaining));

      // Mark instance as unhealthy on connection error
      if (instance.isHealthy) {
        instance.isHealthy = false;
        this.failoverEvents.push({
          instanceId: instance.id,
          reason: err.message,
          timestamp: Date.now()
        });
      }

      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'Bad Gateway: Upstream connection failed', instance: instance.id }));
    });

    clientReq.pipe(proxyReq);
  }

  startHealthChecks() {
    this.healthTimer = setInterval(() => {
      this.checkAllInstances();
    }, this.healthCheckIntervalMs);
  }

  async checkAllInstances() {
    for (const inst of this.instances) {
      if (inst.isDraining) continue;
      try {
        const isOk = await this.probeInstance(inst);
        if (isOk && !inst.isHealthy) {
          inst.isHealthy = true;
          this.failoverEvents.push({
            instanceId: inst.id,
            event: 'recovered',
            timestamp: Date.now()
          });
        } else if (!isOk && inst.isHealthy) {
          inst.isHealthy = false;
          this.failoverEvents.push({
            instanceId: inst.id,
            event: 'evicted_unhealthy',
            timestamp: Date.now()
          });
        }
      } catch (err) {
        if (inst.isHealthy) {
          inst.isHealthy = false;
          this.failoverEvents.push({
            instanceId: inst.id,
            event: 'evicted_error',
            error: err.message,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  probeInstance(inst) {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: inst.host,
        port: inst.port,
        path: this.healthCheckPath,
        method: 'GET',
        headers: { 'x-forwarded-proto': 'https' },
        timeout: 800
      }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  drainInstance(instanceId) {
    const inst = this.instances.find(i => i.id === instanceId);
    if (inst) {
      inst.isDraining = true;
      return new Promise((resolve) => {
        const check = () => {
          const inFlight = this.inFlightRequests.get(instanceId) || 0;
          if (inFlight === 0) {
            resolve({ drained: true, inFlight: 0 });
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }
    return Promise.resolve({ drained: false });
  }

  stop() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
    return Promise.resolve();
  }
}

module.exports = LoadBalancerProxy;
