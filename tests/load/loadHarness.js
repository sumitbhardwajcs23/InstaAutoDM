// tests/load/loadHarness.js
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { monitorEventLoopDelay } = require('perf_hooks');

class LoadHarness {
  constructor(options = {}) {
    this.keepAliveAgentHttp = new http.Agent({
      keepAlive: true,
      maxSockets: options.maxSockets || 500,
      keepAliveMsecs: 30000,
      timeout: 15000
    });
    this.keepAliveAgentHttps = new https.Agent({
      keepAlive: true,
      maxSockets: options.maxSockets || 500,
      keepAliveMsecs: 30000,
      timeout: 15000
    });
  }

  /**
   * Execute a single HTTP request with microsecond latency measurement
   */
  async executeRequest({ url, method = 'GET', headers = {}, body = null, timeout = 10000 }) {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const agent = isHttps ? this.keepAliveAgentHttps : this.keepAliveAgentHttp;

    const requestHeaders = {
      'x-forwarded-proto': 'https',
      ...headers
    };
    let payload = null;
    if (body) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
      requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: requestHeaders,
      agent,
      timeout
    };

    return new Promise((resolve) => {
      const startTime = process.hrtime.bigint();
      const req = client.request(options, (res) => {
        let responseData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1e6;
          resolve({
            statusCode: res.statusCode,
            latencyMs,
            body: responseData,
            headers: res.headers,
            error: null
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = process.hrtime.bigint();
        const latencyMs = Number(endTime - startTime) / 1e6;
        resolve({
          statusCode: 0,
          latencyMs,
          body: null,
          error: 'TIMEOUT'
        });
      });

      req.on('error', (err) => {
        const endTime = process.hrtime.bigint();
        const latencyMs = Number(endTime - startTime) / 1e6;
        resolve({
          statusCode: 0,
          latencyMs,
          body: null,
          error: err.message
        });
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  /**
   * Run a concurrency benchmark
   * @param {Object} config
   * @param {number} config.concurrentUsers - Number of concurrent worker loops
   * @param {number} config.totalRequests - Total requests to issue across all workers
   * @param {number} config.durationMs - Optional max duration in ms
   * @param {Function} config.requestGenerator - Function(workerIndex, requestIndex) => requestOptions
   */
  async runBenchmark({
    concurrentUsers = 10,
    totalRequests = 100,
    durationMs = null,
    requestGenerator
  }) {
    // Start Event Loop delay monitor
    const eld = monitorEventLoopDelay({ resolution: 10 });
    eld.enable();

    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage();
    const wallStart = Date.now();

    const latencies = [];
    const statusCodes = {};
    let errorCount = 0;
    let completedRequests = 0;

    let globalReqIndex = 0;
    const isDurationMode = Boolean(durationMs);
    const deadline = isDurationMode ? (wallStart + durationMs) : Infinity;

    // Worker pool loop
    const workers = Array.from({ length: concurrentUsers }, async (_, workerIndex) => {
      while (true) {
        if (isDurationMode) {
          if (Date.now() >= deadline) break;
        } else {
          if (globalReqIndex >= totalRequests) break;
        }

        const reqIdx = globalReqIndex++;
        if (!isDurationMode && reqIdx >= totalRequests) break;

        const reqOptions = await requestGenerator(workerIndex, reqIdx);
        const res = await this.executeRequest(reqOptions);

        latencies.push(res.latencyMs);
        const code = res.statusCode || 'ERR';
        statusCodes[code] = (statusCodes[code] || 0) + 1;

        if (res.error || res.statusCode >= 500) {
          errorCount++;
          if (errorCount <= 10) {
            console.log(`   [Harness ERR ${errorCount}] worker=${workerIndex} reqIdx=${reqIdx} url=${reqOptions.url} code=${res.statusCode} err=${res.error}`);
          }
        }
        completedRequests++;
      }
    });

    await Promise.all(workers);

    const wallEnd = Date.now();
    eld.disable();

    const totalDurationSec = Math.max(0.001, (wallEnd - wallStart) / 1000);
    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();

    // Compute percentile metrics
    latencies.sort((a, b) => a - b);
    const count = latencies.length;
    const getPercentile = (p) => {
      if (count === 0) return 0;
      const idx = Math.min(count - 1, Math.floor((p / 100) * count));
      return Number(latencies[idx].toFixed(2));
    };

    const p50 = getPercentile(50);
    const p90 = getPercentile(90);
    const p95 = getPercentile(95);
    const p99 = getPercentile(99);
    const minLatency = count > 0 ? Number(latencies[0].toFixed(2)) : 0;
    const maxLatency = count > 0 ? Number(latencies[count - 1].toFixed(2)) : 0;
    const avgLatency = count > 0 ? Number((latencies.reduce((a, b) => a + b, 0) / count).toFixed(2)) : 0;

    const reqsPerSec = Number((completedRequests / totalDurationSec).toFixed(2));
    const successfulRequests = completedRequests - errorCount;
    const successReqsPerSec = Number((successfulRequests / totalDurationSec).toFixed(2));
    const errorRatePct = completedRequests > 0 ? Number(((errorCount / completedRequests) * 100).toFixed(2)) : 0;

    const eventLoopDelayP50Ms = Number((eld.percentile(50) / 1e6).toFixed(2));
    const eventLoopDelayP95Ms = Number((eld.percentile(95) / 1e6).toFixed(2));
    const eventLoopDelayP99Ms = Number((eld.percentile(99) / 1e6).toFixed(2));

    const totalCpuMs = (endCpu.user + endCpu.system) / 1000;
    const cpuUtilizationPct = Number(((totalCpuMs / (totalDurationSec * 1000)) * 100).toFixed(1));

    return {
      concurrentUsers,
      totalRequests: completedRequests,
      durationSec: Number(totalDurationSec.toFixed(2)),
      throughput: {
        reqsPerSec,
        successReqsPerSec
      },
      latencyMs: {
        min: minLatency,
        avg: avgLatency,
        p50,
        p90,
        p95,
        p99,
        max: maxLatency
      },
      errors: {
        count: errorCount,
        errorRatePct,
        statusCodes
      },
      system: {
        cpuUtilizationPct,
        eventLoopDelayMs: {
          p50: eventLoopDelayP50Ms,
          p95: eventLoopDelayP95Ms,
          p99: eventLoopDelayP99Ms
        },
        memory: {
          rssMb: Number((endMem.rss / 1024 / 1024).toFixed(1)),
          heapUsedMb: Number((endMem.heapUsed / 1024 / 1024).toFixed(1)),
          heapTotalMb: Number((endMem.heapTotal / 1024 / 1024).toFixed(1)),
          deltaRssMb: Number(((endMem.rss - startMem.rss) / 1024 / 1024).toFixed(1)),
          deltaHeapMb: Number(((endMem.heapUsed - startMem.heapUsed) / 1024 / 1024).toFixed(1))
        }
      }
    };
  }

  destroy() {
    this.keepAliveAgentHttp.destroy();
    this.keepAliveAgentHttps.destroy();
  }
}

module.exports = LoadHarness;
