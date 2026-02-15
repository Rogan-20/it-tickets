import { useState, useRef } from 'react';

export default function VoiceInput({ onResult }) {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');

    const toggleRecording = async () => {
        setError('');

        if (recording) {
            recognitionRef.current?.stop();
            setRecording(false);
            return;
        }

        // Check for microphone permission first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop()); // release immediately
        } catch (e) {
            setError('Microphone access denied. Please allow microphone in browser settings.');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError('Voice input not supported. Use Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        finalTranscriptRef.current = '';

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscriptRef.current += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }
            setTranscript(finalTranscriptRef.current + interim);
        };

        recognition.onend = () => {
            setRecording(false);
            const text = finalTranscriptRef.current.trim();
            if (text) {
                onResult(text);
                setTranscript('');
            } else if (!error) {
                setError('No speech detected. Try again.');
                setTimeout(() => setError(''), 3000);
            }
        };

        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            setRecording(false);
            if (e.error === 'not-allowed') {
                setError('Microphone access denied.');
            } else if (e.error === 'no-speech') {
                setError('No speech detected. Try again.');
            } else if (e.error === 'network') {
                setError('Network error. Check your connection.');
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
            setError('Could not start voice input.');
        }
    };

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
