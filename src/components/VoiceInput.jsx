import { useState, useRef } from 'react';

export default function VoiceInput({ onResult }) {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef(null);

    const toggleRecording = () => {
        if (recording) {
            recognitionRef.current?.stop();
            setRecording(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }
            setTranscript(finalTranscript + interim);
        };

        recognition.onend = () => {
            setRecording(false);
            if (finalTranscript.trim()) {
                onResult(finalTranscript.trim());
                setTranscript('');
            }
        };

        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            setRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        setRecording(true);
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
        </div>
    );
}
