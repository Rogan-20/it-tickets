import { useState, useRef, useCallback } from 'react';

export default function VoiceInput({ onResult }) {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');
    const processedIndexRef = useRef(0);

    const toggleRecording = useCallback(async () => {
        setError('');

        if (recording) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('Voice input not supported. Use Chrome or Edge.');
            return;
        }

        // Check microphone permission — but keep the stream alive until recognition starts
        let micStream = null;
        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            setError('Microphone access denied. Please allow microphone in browser settings.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;      // single utterance — prevents duplicates on mobile
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;
        finalTranscriptRef.current = '';
        processedIndexRef.current = 0;

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    // Only process each result index once to prevent duplicates
                    if (i >= processedIndexRef.current) {
                        finalTranscriptRef.current += result[0].transcript + ' ';
                        processedIndexRef.current = i + 1;
                    }
                } else {
                    interim += result[0].transcript;
                }
            }
            setTranscript(finalTranscriptRef.current + interim);
        };

        recognition.onend = () => {
            // Release mic stream now that recognition has ended
            if (micStream) {
                micStream.getTracks().forEach(t => t.stop());
                micStream = null;
            }
            setRecording(false);
            const text = finalTranscriptRef.current.trim();
            if (text) {
                onResult(text);
                setTranscript('');
            } else {
                setError('No speech detected. Try speaking louder or closer to the mic.');
                setTimeout(() => setError(''), 4000);
            }
        };

        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            if (micStream) {
                micStream.getTracks().forEach(t => t.stop());
                micStream = null;
            }
            setRecording(false);
            if (e.error === 'not-allowed') {
                setError('Microphone access denied.');
            } else if (e.error === 'no-speech') {
                setError('No speech detected. Try again.');
            } else if (e.error === 'network') {
                setError('Network error. Speech recognition requires internet.');
            } else if (e.error === 'aborted') {
                // User stopped — not an error
                return;
            } else {
                setError(`Error: ${e.error}`);
            }
            setTimeout(() => setError(''), 4000);
        };

        recognitionRef.current = recognition;
        try {
            recognition.start();
            setRecording(true);
        } catch (e) {
            if (micStream) {
                micStream.getTracks().forEach(t => t.stop());
            }
            setError('Could not start voice input. Try refreshing.');
        }
    }, [recording, onResult]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <button
                type="button"
                className={`voice-btn ${recording ? 'recording' : ''}`}
                onClick={toggleRecording}
                title={recording ? 'Stop recording' : 'Start voice input'}
            >
                🎤
            </button>
            {recording && (
                <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600, animation: 'pulse-recording 1.5s infinite' }}>
                    Listening...
                </div>
            )}
            {transcript && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, textAlign: 'center', marginTop: 4 }}>
                    {transcript}
                </div>
            )}
            {error && (
                <div style={{ fontSize: 11, color: '#ff6b6b', maxWidth: 200, textAlign: 'center', marginTop: 4, fontWeight: 600 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
