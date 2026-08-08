import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, CheckCircle2, X, Loader2 } from 'lucide-react';

/**
 * Live camera selfie capture. Requests camera permission, shows a preview,
 * and calls onCapture(File) when the user snaps a photo.
 * Falls back to a file input (with capture) if getUserMedia is unavailable.
 */
const SelfieCapture = ({ onCapture, facingMode = 'user', label = 'Take Selfie' }) => {
    const videoRef  = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [active, setActive]   = useState(false);
    const [error, setError]     = useState('');
    const [preview, setPreview] = useState('');
    const [starting, setStarting] = useState(false);

    const stopStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => () => stopStream(), [stopStream]);

    // Bind the stream AFTER the <video> is mounted (active === true).
    // Attaching before mount left srcObject on a null ref → black screen.
    useEffect(() => {
        if (!active || !streamRef.current) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = streamRef.current;
        const p = video.play();
        if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay retry on user gesture */ });
    }, [active]);

    const start = async () => {
        setError(''); setStarting(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode }, audio: false,
            });
            streamRef.current = stream;
            setActive(true);   // mount <video> first; the effect above binds the stream
        } catch (err) {
            stopStream();
            setError('Camera access is required for attendance. Please allow camera permission and retry.');
        } finally {
            setStarting(false);
        }
    };

    const snap = () => {
        const video = videoRef.current, canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width  = video.videoWidth  || 480;
        canvas.height = video.videoHeight || 640;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setPreview(URL.createObjectURL(blob));
            onCapture(file);
            stopStream();
            setActive(false);
        }, 'image/jpeg', 0.85);
    };

    const retake = () => { setPreview(''); onCapture(null); start(); };

    return (
        <div className="space-y-2">
            <div className="relative rounded-xl overflow-hidden border bg-black/90"
                style={{ aspectRatio: '3/4', maxWidth: 280, margin: '0 auto' }}>
                {preview ? (
                    <img src={preview} alt="selfie preview" className="w-full h-full object-cover" />
                ) : active ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                        <Camera className="h-10 w-10" />
                        <span className="text-xs">Camera preview</span>
                    </div>
                )}
                {preview && (
                    <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Captured
                    </span>
                )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center justify-center gap-2">
                {!active && !preview && (
                    <button type="button" onClick={start} disabled={starting}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors">
                        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                        {label}
                    </button>
                )}
                {active && (
                    <button type="button" onClick={snap}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 rounded-lg hover:bg-teal-800">
                        <Camera className="h-4 w-4" /> Capture
                    </button>
                )}
                {preview && (
                    <button type="button" onClick={retake}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200">
                        <RefreshCw className="h-4 w-4" /> Retake
                    </button>
                )}
                {active && (
                    <button type="button" onClick={() => { stopStream(); setActive(false); }}
                        className="p-2 text-gray-500 hover:text-red-600" aria-label="Cancel camera">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Camera-only notice — no gallery/file uploads permitted */}
            {!active && !preview && (
                <p className="text-[11px] text-center text-gray-500">
                    Live camera only — gallery uploads are not allowed.
                </p>
            )}
            {error && <p className="text-[11px] text-amber-700 text-center">{error}</p>}
        </div>
    );
};

export default SelfieCapture;
