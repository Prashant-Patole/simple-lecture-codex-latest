import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Volume2, Loader2 } from "lucide-react";
import { useWebSpeech } from "@/hooks/useWebSpeech";

export const VoiceTestPanel = () => {
  const [testResult, setTestResult] = useState<string>("");
  const {
    isListening,
    isSpeaking,
    transcript,
    startListening,
    stopListening,
    speak,
    isSupported,
  } = useWebSpeech();

  const handleTestVoiceInput = () => {
    setTestResult("Listening... Please speak now.");
    startListening('en-IN');
    
    setTimeout(() => {
      stopListening();
    }, 5000);
  };

  const handleTestVoiceOutput = () => {
    setTestResult("Playing test audio...");
    speak("Hello! This is a test of the text to speech system. If you can hear this, audio output is working correctly.", 'en-IN');
  };

  return (
    <Card className="p-4 m-4 space-y-4">
      <h3 className="font-semibold">Voice System Test</h3>
      
      <div className="space-y-2 text-sm">
        <p><strong>Browser Support:</strong> {isSupported ? "✅ Supported" : "❌ Not Supported"}</p>
        <p><strong>Status:</strong> {isListening ? "🎤 Listening" : isSpeaking ? "🔊 Speaking" : "Idle"}</p>
        {transcript && <p><strong>Last Transcript:</strong> {transcript}</p>}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleTestVoiceInput}
          disabled={!isSupported || isListening}
          variant="outline"
          size="sm"
        >
          {isListening ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Listening...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" />
              Test Input
            </>
          )}
        </Button>

        <Button
          onClick={handleTestVoiceOutput}
          disabled={!isSupported || isSpeaking}
          variant="outline"
          size="sm"
        >
          <Volume2 className="h-4 w-4 mr-2" />
          Test Output
        </Button>
      </div>

      {testResult && (
        <div className="p-2 bg-muted rounded text-sm">
          {testResult}
        </div>
      )}

      {!isSupported && (
        <div className="p-2 bg-destructive/10 text-destructive rounded text-xs">
          Voice features require Chrome or Edge browser. Please switch browsers and allow microphone access.
        </div>
      )}
    </Card>
  );
};
