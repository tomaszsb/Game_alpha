import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';
import type { Plugin } from 'vite';

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
  const PORT = 3000;

  function setupPortForwarding(wslIp: string, windowsIp: string): void {
    try {
      console.log(`\n🔧 Setting up Windows port forwarding for port ${PORT}...`);

      // Delete existing rule (ignore errors if it doesn't exist)
      try {
        execSync(
          `powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'netsh interface portproxy delete v4tov4 listenport=${PORT} listenaddress=0.0.0.0' -Wait"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch {
        // Ignore - rule might not exist
      }

      // Add new port forwarding rule
      execSync(
        `powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command', 'netsh interface portproxy add v4tov4 listenport=${PORT} listenaddress=0.0.0.0 connectport=${PORT} connectaddress=${wslIp}' -Wait"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );

      console.log(`✅ Port forwarding configured!`);
      console.log(`   WSL IP: ${wslIp}`);
      console.log(`   Windows IP: ${windowsIp}`);
      console.log(`\n📱 Access from your phone: http://${windowsIp}:${PORT}`);
      console.log(`   Local access: http://localhost:${PORT}\n`);
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

        const wslIp = getWslIp();
        const windowsIp = getWindowsIp();

        if (wslIp && windowsIp) {
          setupPortForwarding(wslIp, windowsIp);
        } else {
          console.warn('⚠️  Could not detect IP addresses for port forwarding');
        }
      });
    }
  };
}

// Detect network IP for browser opening
const runningInWSL = isWSL();
const networkIP = runningInWSL ? getWindowsIp() : null;
const openURL = networkIP ? `http://${networkIP}:3000` : true;

export default defineConfig({
  plugins: [react(), wslPortForwardingPlugin()],
  root: '.',
  server: {
    port: 3000,
    host: true, // Bind to all interfaces for network access
    open: openURL, // Open network IP in WSL, localhost otherwise
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimization for production builds
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          react: ['react', 'react-dom'],
          // Separate service chunks for code splitting
          services: [
            './src/services/DataService.ts',
            './src/services/StateService.ts',
            './src/services/LoggingService.ts'
          ],
          utils: [
            './src/utils/PerformanceMonitor.ts',
            './src/utils/FormatUtils.ts',
            './src/utils/NotificationUtils.ts'
          ]
        }
      }
    },
    // Optimize for performance
    target: 'esnext',
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