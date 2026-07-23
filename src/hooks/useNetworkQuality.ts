import { useState, useEffect, useCallback } from 'react';

interface NetworkConnection extends EventTarget {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnection;
  mozConnection?: NetworkConnection;
  webkitConnection?: NetworkConnection;
}

export interface NetworkQuality {
  connectionType: 'wifi' | '4g' | '3g' | '2g' | 'unknown';
  effectiveBandwidth: number; // Mbps
  latency: number; // ms
  recommendedQuality: '360p' | '480p' | '720p' | '1080p';
  isOnline: boolean;
  isSaveData: boolean;
}

interface QualityThresholds {
  '1080p': number;
  '720p': number;
  '480p': number;
  '360p': number;
}

const DEFAULT_THRESHOLDS: QualityThresholds = {
  '1080p': 5,
  '720p': 2.5,
  '480p': 1,
  '360p': 0.5,
};

export function useNetworkQuality(thresholds: QualityThresholds = DEFAULT_THRESHOLDS): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>({
    connectionType: 'unknown',
    effectiveBandwidth: 10,
    latency: 50,
    recommendedQuality: '720p',
    isOnline: true,
    isSaveData: false,
  });

  const getRecommendedQuality = useCallback((bandwidth: number, saveData: boolean): '360p' | '480p' | '720p' | '1080p' => {
    if (saveData) return '360p';
    
    if (bandwidth >= thresholds['1080p']) return '1080p';
    if (bandwidth >= thresholds['720p']) return '720p';
    if (bandwidth >= thresholds['480p']) return '480p';
    return '360p';
  }, [thresholds]);

  const mapConnectionType = (effectiveType?: string): NetworkQuality['connectionType'] => {
    switch (effectiveType) {
      case '4g': return '4g';
      case '3g': return '3g';
      case '2g':
      case 'slow-2g': return '2g';
      default: return 'unknown';
    }
  };

  const updateNetworkQuality = useCallback(() => {
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    const bandwidth = connection?.downlink || 10;
    const latency = connection?.rtt || 50;
    const saveData = connection?.saveData || false;
    const connectionType = mapConnectionType(connection?.effectiveType);
    
    // If on WiFi (no connection API or high bandwidth), assume good connection
    const effectiveConnectionType = !connection ? 'wifi' : connectionType;
    
    setQuality({
      connectionType: effectiveConnectionType,
      effectiveBandwidth: bandwidth,
      latency,
      recommendedQuality: getRecommendedQuality(bandwidth, saveData),
      isOnline: navigator.onLine,
      isSaveData: saveData,
    });
  }, [getRecommendedQuality]);

  useEffect(() => {
    updateNetworkQuality();
    
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    
    if (connection) {
      connection.addEventListener?.('change', updateNetworkQuality);
    }
    
    window.addEventListener('online', updateNetworkQuality);
    window.addEventListener('offline', updateNetworkQuality);
    
    // Poll every 30 seconds for network changes
    const interval = setInterval(updateNetworkQuality, 30000);
    
    return () => {
      if (connection) {
        connection.removeEventListener?.('change', updateNetworkQuality);
      }
      window.removeEventListener('online', updateNetworkQuality);
      window.removeEventListener('offline', updateNetworkQuality);
      clearInterval(interval);
    };
  }, [updateNetworkQuality]);

  return quality;
}

// Hook for measuring actual download speed
export function useBandwidthTest() {
  const [measuredBandwidth, setMeasuredBandwidth] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runTest = useCallback(async (testUrl?: string) => {
    setIsTesting(true);
    
    try {
      // Use a small test file or generate random data
      const testSize = 100 * 1024; // 100KB
      const startTime = performance.now();
      
      // If no test URL, use a data URL approach
      if (!testUrl) {
        // Simulate by creating random data
        const data = new Uint8Array(testSize);
        crypto.getRandomValues(data);
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        
        await fetch(url);
        URL.revokeObjectURL(url);
      } else {
        await fetch(testUrl, { cache: 'no-store' });
      }
      
      const endTime = performance.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const bitsLoaded = testSize * 8;
      const bandwidthMbps = (bitsLoaded / durationSeconds) / 1000000;
      
      setMeasuredBandwidth(bandwidthMbps);
      return bandwidthMbps;
    } catch (error) {
      console.error('Bandwidth test failed:', error);
      return null;
    } finally {
      setIsTesting(false);
    }
  }, []);

  return { measuredBandwidth, isTesting, runTest };
}
