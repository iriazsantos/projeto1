import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initStore } from "./store";
import { ThemeProvider } from "./ThemeContext";
import { installApiFetchPatch } from "./apiBase";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Error inesperado no frontend',
    };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    console.error('Error capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px' }}>
          <div style={{ maxWidth: 560, width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: '0 10px 25px rgba(15,23,42,0.08)' }}>
            <h1 style={{ fontSize: 24, margin: 0, color: '#0f172a' }}>Ops, ocorreu um erro na tela</h1>
            <p style={{ marginTop: 8, color: '#475569', lineHeight: 1.5 }}>
              Evitamos a tela branca e mantivemos o sistema em modo de recuperacao.
            </p>
            <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, color: '#334155', fontSize: 13 }}>
              {this.state.message || 'Error nao identificado'}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, background: '#4f46e5', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', fontWeight: 600 }}
            >
              Recarregar sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

async function initWithRetry(maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await initStore();
      return true;
    } catch (err) {
      console.warn(`Tentativa ${i + 1}/${maxRetries} falhou:`, err);
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
    }
  }
}

installApiFetchPatch();

initWithRetry().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AppErrorBoundary>
    </StrictMode>
  );
}).catch((err) => {
  console.error("Falha ao inicializar após retries:", err);
  // Fallback GRACEFUL: mostrar aviso mas carregar app em modo offline
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#059669;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);text-align:center;padding:2rem;max-width:500px;margin:0 auto;">
      <div style="font-size:4rem;margin-bottom:1rem;">⚠️</div>
      <h1 style="font-size:2rem;font-weight:800;color:white;margin-bottom:1rem;">Conexão Backend Temporariamente Indisponível</h1>
      <p style="color:#d1d5db;font-size:1.1rem;margin-bottom:2rem;line-height:1.6;">
        O app carregou em <strong>modo offline</strong> com dados locais.<br>
        Funcionalidades de sincronização voltarão automaticamente.
      </p>
      <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:1rem;padding:1.5rem;border:1px solid rgba(255,255,255,0.2);margin-bottom:2rem;">
        <details style="color:white;">
          <summary style="cursor:pointer;font-weight:600;margin-bottom:0.5rem;">Detalhes do erro (clique para expandir)</summary>
          <pre style="font-size:0.9rem;color:#d1d5db;overflow:auto;max-height:200px;">${err.message || err}</pre>
        </details>
      </div>
      <button onclick="location.reload()" style="background:#10b981;color:white;padding:1rem 2rem;border:none;border-radius:9999px;font-weight:600;font-size:1.1rem;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.4);transition:all 0.2s;">🔄 Tentar Reconectar</button>
    </div>
    <script>
      // Auto-retry a cada 10s
      setTimeout(() => location.reload(), 10000);
    </script>
  `;
});
