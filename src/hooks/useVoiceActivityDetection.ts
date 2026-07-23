import { useEffect, useRef, useState, useCallback } from "react";

interface UseVoiceActivityDetectionProps {
  enabled: boolean;
  onVoiceDetected: () => void;
  threshold?: number;
  detectionDuration?: number;
  onAudioLevel?: (level: number) => void;
}

// Human speech fundamental frequency range (85-300 Hz for fundamentals, harmonics up to 3400 Hz)
const SPEECH_FREQ_LOW = 85;
const SPEECH_FREQ_HIGH = 300;
const HARMONIC_FREQ_HIGH = 3400;

export const useVoiceActivityDetection = ({
  enabled,
  onVoiceDetected,
  threshold = 55, // Lower threshold for easier interrupt
  detectionDuration = 300, // Faster detection for responsive interrupts
  onAudioLevel,
}: UseVoiceActivityDetectionProps) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const micPermissionDeniedRef = useRef<boolean>(false);
  const consecutiveVoiceFramesRef = useRef<number>(0);
  
  // Baseline tracking for adaptive threshold
  const baselineLevelRef = useRef<number>(40);
  const baselineSamplesRef = useRef<number[]>([]);
  const baselineEstablishedRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (detectionTimerRef.current) {
      clearTimeout(detectionTimerRef.current);
      detectionTimerRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    analyserRef.current = null;
    consecutiveVoiceFramesRef.current = 0;
    baselineSamplesRef.current = [];
    baselineEstablishedRef.current = false;
    setIsDetecting(false);
    setCurrentLevel(0);
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    startVAD();

    return () => {
      cleanup();
    };
  }, [enabled, cleanup]);

  const startVAD = async () => {
    try {
      if (micPermissionDeniedRef.current) {
        console.log("VAD: Microphone permission denied, skipping");
        return;
      }

      if (micStreamRef.current && micStreamRef.current.active) {
        console.log("VAD: Reusing existing microphone stream");
        setupAudioAnalysis(micStreamRef.current);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      micStreamRef.current = stream;
      setupAudioAnalysis(stream);
    } catch (error) {
      console.log("VAD: Microphone access not available:", error);
      micPermissionDeniedRef.current = true;
      setIsDetecting(false);
    }
  };

  const setupAudioAnalysis = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      // Create filters for human speech frequency range
      const lowPassFilter = audioContext.createBiquadFilter();
      lowPassFilter.type = "lowpass";
      lowPassFilter.frequency.value = HARMONIC_FREQ_HIGH;
      lowPassFilter.Q.value = 0.7;

      const highPassFilter = audioContext.createBiquadFilter();
      highPassFilter.type = "highpass";
      highPassFilter.frequency.value = SPEECH_FREQ_LOW;
      highPassFilter.Q.value = 0.7;

      const microphone = audioContext.createMediaStreamSource(stream);
      
      // Chain: microphone -> highPass -> lowPass -> analyser
      microphone.connect(highPassFilter);
      highPassFilter.connect(lowPassFilter);
      lowPassFilter.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      startTimeRef.current = Date.now();
      baselineEstablishedRef.current = false;
      baselineSamplesRef.current = [];

      setIsDetecting(true);
      monitorAudioLevel();
    } catch (error) {
      console.log("VAD: Failed to setup audio analysis:", error);
      setIsDetecting(false);
    }
  };

  // Calculate spectral flatness (voice has peaks/harmonics, noise is flat)
  const calculateSpectralFlatness = (dataArray: Uint8Array, startBin: number, endBin: number): number => {
    let geometricMean = 0;
    let arithmeticMean = 0;
    let count = 0;

    for (let i = startBin; i <= endBin && i < dataArray.length; i++) {
      const value = Math.max(dataArray[i], 1); // Avoid log(0)
      geometricMean += Math.log(value);
      arithmeticMean += value;
      count++;
    }

    if (count === 0) return 1;

    geometricMean = Math.exp(geometricMean / count);
    arithmeticMean = arithmeticMean / count;

    // Spectral flatness: 0 = tonal (voice), 1 = flat (noise)
    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 1;
  };

  // Calculate zero-crossing rate from time domain data
  const calculateZeroCrossingRate = (analyser: AnalyserNode): number => {
    const timeData = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeData);
    
    let crossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i] >= 0 && timeData[i - 1] < 0) || 
          (timeData[i] < 0 && timeData[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    // Human speech typically has ZCR between 0.01-0.15
    // Higher values indicate noise or fricatives
    return crossings / timeData.length;
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const analyser = analyserRef.current;
    const sampleRate = audioContextRef.current.sampleRate;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyResolution = sampleRate / analyser.fftSize;

    // Calculate which bins correspond to speech frequencies
    const fundamentalLowBin = Math.floor(SPEECH_FREQ_LOW / frequencyResolution);
    const fundamentalHighBin = Math.ceil(SPEECH_FREQ_HIGH / frequencyResolution);
    const harmonicHighBin = Math.ceil(HARMONIC_FREQ_HIGH / frequencyResolution);

    const checkAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate energy in fundamental speech frequency range (85-300 Hz)
      let fundamentalSum = 0;
      let fundamentalCount = 0;
      for (let i = fundamentalLowBin; i <= fundamentalHighBin && i < bufferLength; i++) {
        fundamentalSum += dataArray[i];
        fundamentalCount++;
      }
      const fundamentalEnergy = fundamentalCount > 0 ? fundamentalSum / fundamentalCount : 0;

      // Calculate energy in harmonic range (300-3400 Hz) - voice has harmonics
      let harmonicSum = 0;
      let harmonicCount = 0;
      for (let i = fundamentalHighBin; i <= harmonicHighBin && i < bufferLength; i++) {
        harmonicSum += dataArray[i];
        harmonicCount++;
      }
      const harmonicEnergy = harmonicCount > 0 ? harmonicSum / harmonicCount : 0;

      // Calculate overall energy for comparison
      let totalSum = 0;
      for (let i = 0; i < bufferLength; i++) {
        totalSum += dataArray[i];
      }
      const overallEnergy = totalSum / bufferLength;

      // Human voice characteristics checks:
      
      // 1. Spectral flatness - voice is tonal (low flatness), noise is flat (high flatness)
      const spectralFlatness = calculateSpectralFlatness(dataArray, fundamentalLowBin, harmonicHighBin);
      const isTonal = spectralFlatness < 0.4; // Voice should be < 0.4

      // 2. Zero-crossing rate - voice typically 0.01-0.15, noise higher
      const zcr = calculateZeroCrossingRate(analyser);
      const hasVoiceZCR = zcr > 0.01 && zcr < 0.2;

      // 3. Harmonic-to-noise ratio - voice has strong harmonics
      const hasHarmonics = harmonicEnergy > fundamentalEnergy * 0.3 && harmonicEnergy < fundamentalEnergy * 2;

      // 4. Energy ratio - voice should have more energy in speech band vs overall
      const speechBandRatio = fundamentalEnergy / Math.max(overallEnergy, 1);
      const hasGoodSpeechRatio = speechBandRatio > 1.1;

      // Combined speech likelihood
      const speechConfidence = 
        (isTonal ? 1 : 0) + 
        (hasVoiceZCR ? 1 : 0) + 
        (hasHarmonics ? 1 : 0) + 
        (hasGoodSpeechRatio ? 1 : 0);

      const isLikelyVoice = speechConfidence >= 3; // At least 3 out of 4 indicators

      // Establish baseline during first 600ms
      const timeSinceStart = Date.now() - startTimeRef.current;
      if (timeSinceStart < 600) {
        baselineSamplesRef.current.push(fundamentalEnergy);
        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        return;
      }
      
      // Set baseline once after 600ms
      if (!baselineEstablishedRef.current && baselineSamplesRef.current.length > 0) {
        const avgBaseline = baselineSamplesRef.current.reduce((a, b) => a + b, 0) / baselineSamplesRef.current.length;
        baselineLevelRef.current = Math.max(40, avgBaseline * 1.2); // Add 20% margin
        baselineEstablishedRef.current = true;
        console.log("VAD: Baseline established at", baselineLevelRef.current.toFixed(1));
      }

      // Must be significantly above baseline (2.5x) to trigger
      const isAboveBaseline = fundamentalEnergy > baselineLevelRef.current * 2.5;

      // Update current level for visual feedback
      setCurrentLevel(fundamentalEnergy);
      if (onAudioLevel) {
        onAudioLevel(fundamentalEnergy);
      }

      // Final voice detection: energy threshold + baseline + voice characteristics
      // Lowered requirements for easier interruption during AI speech
      if (fundamentalEnergy > threshold && isAboveBaseline && isLikelyVoice) {
        consecutiveVoiceFramesRef.current++;
        
        // Require only 3 consecutive voice frames for faster interrupt
        if (consecutiveVoiceFramesRef.current >= 3) {
          const now = Date.now();
          // Cooldown of 500ms between triggers
          if (now - lastTriggerRef.current < 500) {
            animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
            return;
          }

          if (!detectionTimerRef.current) {
            detectionTimerRef.current = setTimeout(() => {
              console.log(
                "VAD: Human voice detected!",
                "Energy:", fundamentalEnergy.toFixed(1),
                "Baseline:", baselineLevelRef.current.toFixed(1),
                "Flatness:", spectralFlatness.toFixed(2),
                "ZCR:", zcr.toFixed(3),
                "Confidence:", speechConfidence
              );
              lastTriggerRef.current = Date.now();
              consecutiveVoiceFramesRef.current = 0;
              onVoiceDetected();
              detectionTimerRef.current = null;
            }, detectionDuration);
          }
        }
      } else {
        // Reset consecutive count on silence or non-voice
        consecutiveVoiceFramesRef.current = Math.max(0, consecutiveVoiceFramesRef.current - 2);
        
        if (detectionTimerRef.current) {
          clearTimeout(detectionTimerRef.current);
          detectionTimerRef.current = null;
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  return {
    isDetecting,
    currentLevel,
  };
};
