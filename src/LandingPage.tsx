import { useEffect, useMemo, useState } from 'react';

interface LandingPageProps {
  onEnter: () => void;
}

type StatState = {
  condos: number;
  users: number;
  uptime: number;
};

const features = [
  {
    icon: '📦',
    title: 'Rastreamento QR Exclusivo',
    desc: 'Fluxo de encomendas com validação por QR Code e histórico completo de retirada.',
    accent: 'from-zinc-300 to-zinc-500',
  },
  {
    icon: '💬',
    title: 'Comunicação em Tempo Real',
    desc: 'Mensagens por unidade com experiência familiar e comunicação direta entre moradores.',
    accent: 'from-zinc-200 to-zinc-400',
  },
  {
    icon: '💳',
    title: 'Cobrança com PIX Integrado',
    desc: 'Cobrança, conciliação e confirmação de pagamento sem fricção para síndico e morador.',
    accent: 'from-zinc-300 to-zinc-600',
  },
  {
    icon: '📅',
    title: 'Reservas Inteligentes',
    desc: 'Agenda visual de áreas comuns com regra de conflito e políticas de uso configuráveis.',
    accent: 'from-zinc-200 to-zinc-500',
  },
];

const modules = [
  { icon: '📢', label: 'Comunicados Oficiais' },
  { icon: '🗳️', label: 'Assembleias Virtuais' },
  { icon: '🛒', label: 'Marketplace Interno' },
  { icon: '🚪', label: 'Controle de Acesso' },
  { icon: '🔧', label: 'Chamados de Manutenção' },
  { icon: '📁', label: 'Documentos Digitais' },
  { icon: '⚠️', label: 'Denúncias Seguras' },
  { icon: '🔎', label: 'Achados e Perdidos' },
];

const roles = [
  {
    icon: '👑',
    title: 'Admin Master',
    points: ['Visão global de condomínios', 'Gestão de licenças', 'Controle de inadimplência'],
    accent: 'from-zinc-700 to-zinc-500',
  },
  {
    icon: '🏢',
    title: 'Síndico',
    points: ['Financeiro e cobrança', 'Gestão de moradores', 'Operação do condomínio'],
    accent: 'from-zinc-700 to-zinc-400',
  },
  {
    icon: '🚪',
    title: 'Porteiro',
    points: ['Registro de entregas', 'Acesso de visitantes', 'Consulta rápida de moradores'],
    accent: 'from-zinc-600 to-zinc-400',
  },
  {
    icon: '🏠',
    title: 'Morador',
    points: ['Pagamentos e notificações', 'Reservas e marketplace', 'Chat e comunicados'],
    accent: 'from-zinc-600 to-zinc-300',
  },
];

export function LandingPage({ onEnter }: LandingPageProps) {
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [stats, setStats] = useState<StatState>({ condos: 0, users: 0, uptime: 0 });

  useEffect(() => {
    setMounted(true);

    const finalStats: StatState = { condos: 500, users: 50000, uptime: 99.9 };
    const durationMs = 1800;
    const start = performance.now();

    let animationFrame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setStats({
        condos: Math.floor(finalStats.condos * eased),
        users: Math.floor(finalStats.users * eased),
        uptime: Number((finalStats.uptime * eased).toFixed(1)),
      });
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    const featureInterval = window.setInterval(() => {
      setActiveFeature((current) => (current + 1) % features.length);
    }, 3500);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearInterval(featureInterval);
    };
  }, []);

  const heroStats = useMemo(() => ([
    { label: 'Condomínios', value: `${stats.condos}+` },
    { label: 'Usuários ativos', value: `${stats.users.toLocaleString('pt-BR')}+` },
    { label: 'Uptime médio', value: `${stats.uptime.toFixed(1)}%` },
    { label: 'Suporte', value: '24/7' },
  ]), [stats]);

  return (
    <div
      className="landing-shell relative min-h-screen overflow-x-hidden bg-black text-white"
      style={{ fontFamily: "'Space Grotesk', 'Manrope', sans-serif" }}
    >
      {/* Cinematic Condominium Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80&w=2560')",
          backgroundPosition: "center 20%"
        }}
      />
      {/* Dark overlay specifically tuned to keep white text readable but allow the background to shine through */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0a0a0a] pointer-events-none" />


      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] rounded-full bg-cyan-500/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen" />
      </div>


      <nav className={`fixed top-0 z-40 w-full border-b border-white/10 bg-black/90 px-4 backdrop-blur-xl transition-all sm:px-6 lg:px-12 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-white to-zinc-300 text-lg shadow-lg shadow-white/10">
              🏢
            </div>
            <div>
              <p className="text-sm font-black tracking-wide text-white">INOVATECH</p>
              <p className="text-[10px] font-bold tracking-[0.35em] text-zinc-300">CONNECT</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <a href="#recursos" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">Recursos</a>
            <a href="#modulos" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">Módulos</a>
            <a href="#perfis" className="rounded-lg px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white">Perfis</a>
            <button
              onClick={onEnter}
              className="ml-2 rounded-xl bg-gradient-to-r from-white to-zinc-300 px-4 py-2 text-xs font-black text-black shadow-lg shadow-white/10 transition-transform hover:-translate-y-0.5"
            >
              Entrar
            </button>
          </div>
        </div>
      </nav>

      <header className="relative z-10 px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className={`transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Gestão condominial inteligente
            </div>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Painel completo para
              <span className="block bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                operação, cobrança e comunicação
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Centralize toda a rotina do condomínio em uma experiência visual moderna: dashboards vivos, pagamentos integrados, entregas com QR e comunicação em tempo real.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={onEnter}
                className="rounded-2xl bg-gradient-to-r from-white to-zinc-300 px-6 py-3 text-sm font-black text-black shadow-xl shadow-white/15 transition-all hover:-translate-y-0.5 hover:shadow-white/20"
              >
                Acessar Plataforma
              </button>
              <a
                href="#recursos"
                className="rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Ver recursos
              </a>
            </div>
          </div>

          <div className={`transition-all delay-150 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-md">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">Destaque</p>
                  <h2 className="text-xl font-black text-white">{features[activeFeature].title}</h2>
                </div>
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-2xl ${features[activeFeature].accent}`}>
                  {features[activeFeature].icon}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/75">{features[activeFeature].desc}</p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {features.map((feature, index) => (
                  <button
                    key={feature.title}
                    onClick={() => setActiveFeature(index)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                      index === activeFeature
                        ? 'border-white/35 bg-white/15 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {feature.icon} {feature.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl grid-cols-2 gap-3 sm:grid-cols-4">
          {heroStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur-sm">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/55">{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      <section id="recursos" className="relative z-10 px-4 py-14 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-300">Recursos principais</p>
            <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">Gráficos claros para decisões rápidas</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
              Dashboard com leitura instantânea de operação, financeiro, tickets e entregas para cada perfil do sistema.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <article key={feature.title} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/[0.08]">
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xl ${feature.accent}`}>
                    {feature.icon}
                  </div>
                  <h4 className="text-lg font-black text-white">{feature.title}</h4>
                </div>
                <p className="text-sm text-white/70">{feature.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modulos" className="relative z-10 px-4 py-14 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-300">Ecossistema</p>
            <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">12 módulos integrados</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map((module) => (
              <div key={module.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm transition-all hover:bg-white/10">
                <div className="text-2xl">{module.icon}</div>
                <p className="mt-2 text-xs font-semibold text-white/80 sm:text-sm">{module.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="perfis" className="relative z-10 px-4 py-14 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-300">Perfis de acesso</p>
            <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">Experiência certa para cada papel</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roles.map((role) => (
              <article key={role.title} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-white/[0.08]">
                <div className={`bg-gradient-to-r px-5 py-4 ${role.accent}`}>
                  <p className="text-2xl">{role.icon}</p>
                  <h4 className="mt-1 text-lg font-black text-white">{role.title}</h4>
                </div>
                <ul className="space-y-2 p-5">
                  {role.points.map((point) => (
                    <li key={point} className="text-sm text-white/75">
                      • {point}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 py-16 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/20 bg-gradient-to-r from-white/10 via-zinc-500/10 to-white/10 px-6 py-10 text-center shadow-2xl backdrop-blur-md sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-200">Pronto para começar</p>
          <h3 className="mt-2 text-3xl font-black text-white sm:text-4xl">Modernize seu condomínio hoje</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
            Entre agora e veja na prática como o novo painel melhora operação, visual e produtividade da equipe.
          </p>
          <button
            onClick={onEnter}
            className="mt-7 rounded-2xl bg-white px-7 py-3 text-sm font-black text-black transition-all hover:-translate-y-0.5 hover:bg-zinc-200"
          >
            Acessar INOVATECH CONNECT
          </button>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-4 py-5 text-center text-xs text-white/45 sm:px-6 lg:px-12">
        © {new Date().getFullYear()} INOVATECH CONNECT • Todos os direitos reservados
      </footer>
    </div>
  );
}


