import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import type { Plugin } from 'vite';

// Get git commit hash for version tracking
function getGitCommitHash(): string {
  // First check if passed via environment (Docker build)
  if (process.env.VITE_GIT_COMMIT && process.env.VITE_GIT_COMMIT !== 'unknown') {
    return process.env.VITE_GIT_COMMIT;
  }
  // Otherwise try to get from git directly
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

// Get build timestamp
function getBuildTimestamp(): string {
  return new Date().toISOString();
}

// Detect if running in WSL
function isWSL(): boolean {
  try {
    const release = execSync('cat /proc/version', { encoding: 'utf-8' });
    return release.toLowerCase().includes('microsoft');
  } catch {
    return false;
  }
}

// Get WSL IP address
function getWslIp(): string | null {
  try {
    const result = execSync('hostname -I', { encoding: 'utf-8' });
    const ip = result.trim().split(' ')[0];
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
      return ip;
    }
  } catch (e) {
    console.error('Failed to get WSL IP:', e);
  }
  return null;
}

// Get Windows IP address
function getWindowsIp(): string | null {
  try {
    const ipResult = execSync('cmd.exe /c ipconfig', { encoding: 'utf-8' });
    const lines = ipResult.split('\n');
    for (const line of lines) {
      if (line.includes('IPv4') && line.includes('192.168')) {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  } catch (e) {
    console.warn('Could not auto-detect Windows IP:', (e as Error).message);
  }
  return null;
}

// WSL Port Forwarding Plugin
function wslPortForwardingPlugin(): Plugin {
  function setupPortForwarding(port: number, wslIp: string, windowsIp: string): void {
    try {
      console.log(`\n🔧 Setting up Windows port forwarding for port ${port}...`);

      // Delete existing rule (ignore errors if it doesn't exist)
      try {
        execSync(
          `powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'netsh interface portproxy delete v4tov4 listenport=${port} listenaddress=0.0.0.0' -Wait"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch {
        // Ignore - rule might not exist
      }

      // Add new port forwarding rule
      execSync(
        `powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${wslIp}' -Wait"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      console.log(`✅ Port forwarding configured!`);
      console.log(`   WSL IP: ${wslIp}`);
      console.log(`   Windows IP: ${windowsIp}`);
      console.log(`\n📱 Access from your phone: http://${windowsIp}:${port}`);
      console.log(`   Local access: http://localhost:${port}\n`);
    } catch (e) {
      console.error('⚠️  Failed to set up port forwarding (requires admin):', e);
      console.log('   You may need to run the command manually as administrator.');
    }
  }

  return {
    name: 'wsl-port-forwarding',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        if (!isWSL()) return;

        // Get the actual port the server is listening on
        const address = server.httpServer?.address();
        const port = typeof address === 'object' && address !== null ? address.port : 3000;

        const wslIp = getWslIp();
        const windowsIp = getWindowsIp();

        if (wslIp && windowsIp) {
          setupPortForwarding(port, wslIp, windowsIp);
        } else {
          console.warn('⚠️  Could not detect IP addresses for port forwarding');
        }
      });
    }
  };
}

// Detect if running in WSL for server configuration
const runningInWSL = isWSL();

export default defineConfig({
  plugins: [react(), wslPortForwardingPlugin()],
  root: '.',
  define: {
    __APP_VERSION__: JSON.stringify(getGitCommitHash()),
    __BUILD_TIME__: JSON.stringify(getBuildTimestamp())
  },
  server: {
    port: 3000,
    host: true, // Bind to all interfaces for network access
    open: true, // Let Vite handle opening the browser with the correct port
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Retry with next port if 3001 fails
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            // Try port 3002 if 3001 fails
            const backupTarget = 'http://localhost:3002';
            console.log(`Proxy error, retrying with ${backupTarget}`);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Optimization for production builds.
    // Goal: keep the app shell ("index" chunk) small so first-paint is fast,
    // and split heavy third-party deps into vendor chunks that change rarely
    // (so browser cache survives most app deploys).
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Vendor splits — node_modules deps that are stable across deploys.
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || /[\\/]node_modules[\\/]react[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (id.includes('framer-motion')) return 'vendor-framer-motion';
            if (id.includes('qrcode.react')) return 'vendor-qrcode';
            // html2canvas is dynamically imported by FeedbackButton —
            // Rollup will create its own async chunk. Don't pull it into
            // a sync vendor chunk here.
            if (id.includes('html2canvas')) return undefined;
            // Everything else from node_modules → catch-all vendor chunk.
            return 'vendor';
          }
          // App code splits — group by directory so churn in one area
          // doesn't invalidate the others' cache.
          if (id.includes('/src/services/')) return 'services';
          if (id.includes('/src/components/editor/')) return 'editor';
          if (id.includes('/src/dictionary/')) return 'dictionary';
          // Default: main app bundle
          return undefined;
        },
      }
    },
    // Optimize for performance
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for performance monitoring
        drop_debugger: true,
        pure_funcs: ['console.debug']
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
    // Force optimization of large dependencies
    force: true
  }
});