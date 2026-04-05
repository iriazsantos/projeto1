import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
  onError?: (err: string) => void;
}

export function QRScannerCamera({ onScan, onClose, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const [status, setStatus] = useState<'requesting' | 'active' | 'error' | 'denied'>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    stopCamera();
    setStatus('requesting');
    setErrorMsg('');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play();
        setStatus('active');
        scanLoop();
      }
    } catch (err: unknown) {
      const error = err as Error;
      stopCamera();
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatus('denied');
        setErrorMsg('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
        onError?.('denied');
      } else if (error.name === 'NotFoundError') {
        setStatus('error');
        setErrorMsg('Câmera não encontrada neste dispositivo.');
        onError?.('not_found');
      } else if (error.name === 'NotReadableError') {
        setStatus('error');
        setErrorMsg('Câmera em uso por outro aplicativo.');
        onError?.('in_use');
      } else {
        setStatus('error');
        setErrorMsg(`Error ao acessar câmera: ${error.message}`);
        onError?.(error.message);
      }
    }
  }, [stopCamera, onError]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        setScanned(true);
        stopCamera();
        onScan(code.data);
        return;
      }
    } catch {
      // continuar tentando
    }

    animFrameRef.current = requestAnimationFrame(scanLoop);
  }, [onScan, stopCamera]);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const capabilities = track.getCapabilities?.() as Record<string, unknown> | undefined;
      if (capabilities?.torch) {
        await (track.applyConstraints as (c: unknown) => Promise<void>)({ advanced: [{ torch: !torchOn }] });
        setTorchOn(t => !t);
      }
    } catch {
      // Torch não suportado
    }
  }, [torchOn]);

  const flipCamera = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  useEffect(() => {
    startCamera('environment');
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
        >
          <span className="text-xl">←</span>
          <span className="text-sm font-semibold">Cancelar</span>
        </button>
        <h3 className="text-white font-bold text-sm">📷 Ler QR Code</h3>
        <div className="flex gap-2">
          {/* Torch */}
          <button
            onClick={toggleTorch}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
              torchOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
            }`}
          >
            🔦
          </button>
          {/* Flip camera */}
          <button
            onClick={flipCamera}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg text-white hover:bg-white/20 transition-all"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Video stream */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />

        {/* Canvas oculto para processamento */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay escuro nas bordas */}
        {status === 'active' && (
          <>
            {/* Overlay com buraco no centro */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top */}
              <div className="absolute top-0 left-0 right-0 h-[20%] bg-black/60" />
              {/* Bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black/60" />
              {/* Left */}
              <div className="absolute top-[20%] bottom-[20%] left-0 w-[10%] bg-black/60" />
              {/* Right */}
              <div className="absolute top-[20%] bottom-[20%] right-0 w-[10%] bg-black/60" />
            </div>

            {/* Frame do QR */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-64">
                {/* Cantos animados */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-lg" />

                {/* Linha de scan animada */}
                <div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"
                  style={{ animation: 'scanLine 2s ease-in-out infinite' }}
                />
              </div>
            </div>

            {/* Instrução */}
            <div className="absolute bottom-28 left-0 right-0 flex justify-center">
              <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
                <p className="text-white text-sm font-semibold">Aponte para o QR Code da encomenda</p>
                <p className="text-white/50 text-xs mt-1">O código será lido automaticamente</p>
              </div>
            </div>
          </>
        )}

        {/* Estado: Solicitando permissão */}
        {status === 'requesting' && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center gap-6 p-8">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-4xl animate-pulse">
              📷
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-2">Aguardando câmera...</p>
              <p className="text-white/50 text-sm">Permita o acesso à câmera quando solicitado</p>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 bg-indigo-400 rounded-full"
                  style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Estado: Permissão negada */}
        {status === 'denied' && (
          <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center gap-5 p-8">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-4xl">
              🚫
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-2">Câmera bloqueada</p>
              <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
              <div className="bg-white/5 rounded-2xl p-4 text-left space-y-2 mb-6">
                <p className="text-white/70 text-sm font-semibold">📱 Como liberar a câmera:</p>
                <p className="text-white/50 text-xs">1. Toque no ícone 🔒 ou ℹ️ na barra de endereços</p>
                <p className="text-white/50 text-xs">2. Selecione "Permissões do site"</p>
                <p className="text-white/50 text-xs">3. Mude "Câmera" para "Permitir"</p>
                <p className="text-white/50 text-xs">4. Recarregue a página</p>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => startCamera('environment')}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-colors"
              >
                🔄 Tentar Novamente
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Estado: Error genérico */}
        {status === 'error' && (
          <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center gap-5 p-8">
            <div className="w-20 h-20 rounded-full bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center text-4xl">
              ⚠️
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-2">Error na câmera</p>
              <p className="text-orange-400 text-sm">{errorMsg}</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => startCamera('environment')}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-colors"
              >
                🔄 Tentar Novamente
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-bold text-sm hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Sucesso ao ler */}
        {scanned && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-5">
            <div
              className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-5xl shadow-2xl shadow-emerald-500/50"
              style={{ animation: 'bounceIn 0.4s ease-out' }}
            >
              ✅
            </div>
            <div className="text-center">
              <p className="text-white font-black text-xl">QR Code Lido!</p>
              <p className="text-emerald-400 text-sm mt-1">Processando encomenda...</p>
            </div>
          </div>
        )}
      </div>

      {/* Botão manual na base */}
      {status === 'active' && (
        <div className="bg-black/90 backdrop-blur-sm px-4 py-4 flex items-center justify-center">
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="px-8 py-3 bg-white/10 text-white rounded-2xl font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
          >
            Cancelar leitura
          </button>
        </div>
      )}

      {/* CSS da linha de scan */}
      <style>{`
        @keyframes scanLine {
          0% { top: 8px; opacity: 1; }
          50% { top: calc(100% - 8px); opacity: 1; }
          100% { top: 8px; opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
