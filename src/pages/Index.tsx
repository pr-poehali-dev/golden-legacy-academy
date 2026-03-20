import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import EditableText, { useContent, contentManager } from "@/components/EditableText";

const AUTH_URL = "https://functions.poehali.dev/e6da7fcf-5b58-4d23-bcb3-2e96a22c0726";
const ADMIN_URL = "https://functions.poehali.dev/1766177a-c2da-45c4-ab5b-e61d5b8f9608";
const FILES_URL = "https://functions.poehali.dev/69dd48ae-c01f-4f36-86f5-41e309f27990";
const PROGRESS_URL = "https://functions.poehali.dev/e7bff3a3-d4dd-475e-997b-18688a92ac19";
const TOKEN_KEY = "gn_session_token";
const LOGO_IMG = "https://cdn.poehali.dev/projects/e7a92d70-13fa-4fe1-b427-04d5de72d5d4/bucket/104ffa8d-3640-40b5-858a-6ba7f7a2f794.jpg";

type Page = "home" | "grounds" | "cabinet" | "progress" | "club" | "contacts";

interface UserData {
  id: number;
  name: string;
  email: string;
  status: string;
  level: number;
  is_admin: boolean;
  created_at: string;
}

interface ProfileData {
  user: UserData;
  progress: ProgressItem[];
  certificates: CertItem[];
  completedGrounds: number;
}

interface ProgressItem {
  ground_id: number;
  current_module: number;
  total_modules: number;
  percent: number;
  status: string;
}

interface CertItem {
  ground_id: number;
  ground_title: string;
  issued_at: string;
}

const GROUNDS = [
  { id: 1, title: "Основы наставничества", subtitle: "Фундамент мастерства", icon: "Sprout", duration: "4 недели", modules: 8, description: "Базовые принципы наставничества, философия передачи знаний и установление доверия с подопечными." },
  { id: 2, title: "Психология роста", subtitle: "Искусство понимания", icon: "Brain", duration: "5 недель", modules: 10, description: "Глубинная психология развития личности, мотивация и раскрытие потенциала каждого ученика." },
  { id: 3, title: "Методы передачи знаний", subtitle: "Технологии обучения", icon: "BookOpen", duration: "6 недель", modules: 12, description: "Авторские методики, инструменты наставника и создание персональных программ развития." },
  { id: 4, title: "Лидерство и влияние", subtitle: "Сила примера", icon: "Crown", duration: "5 недель", modules: 10, description: "Развитие лидерских качеств, построение репутации эксперта и расширение круга влияния." },
  { id: 5, title: "Мастер-наставник", subtitle: "Вершина мастерства", icon: "Star", duration: "8 недель", modules: 16, description: "Создание собственной школы наставничества, подготовка наставников и формирование наследия." },
];

function getAvatarLetters(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

export default function Index() {
  const [page, setPage] = useState<Page>("home");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const isLoggedIn = !!profile;

  const loadProfile = useCallback(async (token: string) => {
    const res = await fetch(`${AUTH_URL}?action=profile`, {
      headers: { "X-Session-Token": token },
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) loadProfile(token);
    contentManager.load();
  }, [loadProfile]);

  const handleLogout = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      await fetch(`${AUTH_URL}?action=logout`, {
        method: "POST",
        headers: { "X-Session-Token": token },
      });
    }
    localStorage.removeItem(TOKEN_KEY);
    setProfile(null);
    setPage("home");
  };

  const navItems: { id: Page; label: string; icon: string; requireAuth?: boolean }[] = [
    { id: "home", label: "Главная", icon: "Home" },
    { id: "grounds", label: "Площадки", icon: "LayoutGrid" },
    { id: "cabinet", label: "Кабинет", icon: "User", requireAuth: true },
    { id: "progress", label: "Прогресс", icon: "TrendingUp", requireAuth: true },
    { id: "club", label: "Клуб", icon: "Shield", requireAuth: true },
    { id: "contacts", label: "Контакты", icon: "MessageCircle" },
  ];

  const handleNav = (id: Page, requireAuth?: boolean) => {
    if (requireAuth && !isLoggedIn) { setShowLogin(true); return; }
    setPage(id);
    setMobileMenu(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(60,100,60,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(180,140,40,0.05) 0%, transparent 40%)` }} />
      </div>

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-border/60 backdrop-blur-md bg-background/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => setPage("home")} className="flex items-center gap-3">
              <img src={LOGO_IMG} alt="Золотое Наследие" className="w-10 h-10 rounded-full object-cover object-center flex-shrink-0" style={{ filter: "brightness(1.05) saturate(1.1)" }} />
              <div className="hidden sm:block">
                <div className="font-display text-lg leading-tight" style={{ color: "hsl(45, 90%, 68%)" }}>Золотое Наследие</div>
                <div className="font-body text-[10px] tracking-widest text-muted-foreground uppercase">Академия наставничества</div>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => handleNav(item.id, item.requireAuth)}
                  className="flex items-center gap-2 px-3 py-2 rounded text-xs font-body font-medium tracking-wide uppercase transition-all duration-200"
                  style={page === item.id ? { color: "hsl(45, 80%, 58%)", backgroundColor: "rgba(200,160,40,0.08)" } : { color: "hsl(215, 20%, 50%)" }}
                >
                  <Icon name={item.icon} size={14} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              {isLoggedIn && profile ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage("cabinet")} className="flex items-center gap-2 px-3 py-1.5 rounded border border-amber-700/40 hover:border-amber-600/60 transition-all">
                    <div className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-[10px] font-bold text-stone-900">{getAvatarLetters(profile.user.name)}</div>
                    <span className="hidden sm:block font-body text-xs" style={{ color: "hsl(45, 80%, 60%)" }}>{profile.user.name.split(" ")[0]}</span>
                  </button>
                  <button onClick={handleLogout} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Выйти">
                    <Icon name="LogOut" size={16} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowLogin(true)} className="btn-gold px-4 py-2 rounded text-xs">Войти</button>
              )}
              <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-muted-foreground">
                <Icon name={mobileMenu ? "X" : "Menu"} size={20} />
              </button>
            </div>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden border-t border-border/40 bg-background/95 animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => handleNav(item.id, item.requireAuth)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body text-muted-foreground hover:text-foreground hover:bg-white/4 transition-all text-left"
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                  {item.requireAuth && !isLoggedIn && <Icon name="Lock" size={12} className="ml-auto opacity-40" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="relative">
        {page === "home" && <HomePage setPage={setPage} setShowLogin={setShowLogin} isLoggedIn={isLoggedIn} isAdmin={!!profile?.user.is_admin} />}
        {page === "grounds" && <GroundsPage isLoggedIn={isLoggedIn} setShowLogin={setShowLogin} profile={profile} isAdmin={!!profile?.user.is_admin} />}
        {page === "cabinet" && isLoggedIn && profile && <CabinetPage profile={profile} onProfileUpdate={loadProfile} isAdmin={!!profile?.user.is_admin} />}
        {page === "progress" && isLoggedIn && profile && <ProgressPage profile={profile} onProfileUpdate={loadProfile} />}
        {page === "club" && isLoggedIn && profile && <ClubPage profile={profile} isAdmin={!!profile?.user.is_admin} />}
        {page === "contacts" && <ContactsPage isAdmin={!!profile?.user.is_admin} />}
      </main>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={(data) => {
            localStorage.setItem(TOKEN_KEY, data.token);
            setProfile(data.profile);
            setShowLogin(false);
            setPage("cabinet");
          }}
        />
      )}

      <footer className="border-t border-border/40 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={LOGO_IMG} alt="ЗН" className="w-7 h-7 rounded-full object-cover object-center" />
              <span className="font-display text-sm" style={{ color: "hsl(45, 70%, 55%)" }}>Академия Золотое Наследие</span>
            </div>
            <p className="font-body text-xs text-muted-foreground tracking-wide">© 2026 — Все права защищены</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
const HERO_IMG = "https://cdn.poehali.dev/projects/e7a92d70-13fa-4fe1-b427-04d5de72d5d4/bucket/8509dc14-455a-411c-8604-21de621dfba8.jpg";

function HomePage({ setPage, setShowLogin, isLoggedIn, isAdmin }: { setPage: (p: Page) => void; setShowLogin: (v: boolean) => void; isLoggedIn: boolean; isAdmin: boolean }) {
  useContent();
  return (
    <div>
      {/* HERO — split layout */}
      <section className="relative min-h-[90vh] flex items-stretch overflow-hidden">
        {/* Left — text */}
        <div className="relative z-10 flex items-center w-full lg:w-1/2 px-6 sm:px-12 lg:px-16 py-20">
          <div className="max-w-lg">
            {/* Logo */}
            <div className="mb-6 flex items-center gap-4">
              <img src={LOGO_IMG} alt="Золотое Наследие" className="w-16 h-16 rounded-full object-cover object-center border border-amber-700/30"
                style={{ boxShadow: "0 0 24px rgba(180,140,30,0.2)" }} />
              <EditableText contentKey="hero_badge" fallback="✦ Академия Наставничества ✦" isAdmin={isAdmin}
                as="span" className="status-badge border border-amber-700/40" style={{ color: "hsl(40,70%,55%)" }} />
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-light mb-6 leading-tight animate-fade-in">
              <EditableText contentKey="hero_title_line1" fallback="Золотое" isAdmin={isAdmin}
                as="span" className="gold-text-gradient block" /><br />
              <EditableText contentKey="hero_title_line2" fallback="Наследие" isAdmin={isAdmin}
                as="span" className="text-foreground/90" />
            </h1>
            <div className="divider-gold w-20 mb-6" />
            <EditableText contentKey="hero_subtitle" fallback="Пять ступеней мастерства, которые превратят ваш опыт в вечное наследие. Система наставничества, проверенная временем."
              isAdmin={isAdmin} as="p" multiline className="font-body text-base text-muted-foreground leading-relaxed mb-10" />
            <div className="flex flex-col sm:flex-row gap-4">
              <EditableText contentKey="hero_btn_start" fallback="Начать обучение" isAdmin={isAdmin}
                as="button" className="btn-gold px-8 py-3 rounded" onClick={() => setPage("grounds")} />
              {!isLoggedIn && (
                <EditableText contentKey="hero_btn_login" fallback="Войти в кабинет" isAdmin={isAdmin}
                  as="button" className="btn-outline-gold px-8 py-3 rounded" onClick={() => setShowLogin(true)} />
              )}
            </div>

            {/* Mini stats */}
            <div className="flex gap-8 mt-12 pt-8 border-t border-border/30">
              {[
                { ck: "stat_graduates", val: "247", label: "Выпускников" },
                { ck: "stat_grounds", val: "5", label: "Ступеней" },
                { ck: "stat_years", val: "12", label: "Лет традиций" },
              ].map((s) => (
                <div key={s.label}>
                  <EditableText contentKey={s.ck} fallback={s.val} isAdmin={isAdmin}
                    as="div" className="font-display text-2xl font-light gold-text-gradient" />
                  <div className="font-body text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — image */}
        <div className="hidden lg:block absolute right-0 top-0 w-1/2 h-full">
          {/* Fade overlay left edge */}
          <div className="absolute inset-y-0 left-0 w-32 z-10"
            style={{ background: "linear-gradient(to right, hsl(150,18%,6%) 0%, transparent 100%)" }} />
          {/* Fade overlay bottom */}
          <div className="absolute inset-x-0 bottom-0 h-32 z-10"
            style={{ background: "linear-gradient(to top, hsl(150,18%,6%) 0%, transparent 100%)" }} />
          <img
            src={HERO_IMG}
            alt="Академия Золотое Наследие"
            className="w-full h-full object-cover object-center"
            style={{ filter: "brightness(0.85) saturate(0.9)" }}
          />
          {/* Gold border accent */}
          <div className="absolute inset-y-8 left-0 w-px"
            style={{ background: "linear-gradient(to bottom, transparent, hsl(45,70%,45%), transparent)" }} />
        </div>

        {/* Mobile bg image */}
        <div className="lg:hidden absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover object-center opacity-15" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,18,12,0.6) 0%, rgba(8,18,12,0.95) 100%)" }} />
        </div>
      </section>

      <section className="border-y border-border/40 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[{ value: "5", label: "Площадок обучения" }, { value: "247", label: "Выпускников" }, { value: "12", label: "Лет традиций" }, { value: "94%", label: "Рекомендуют" }].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-display text-4xl font-light mb-1 gold-text-gradient">{stat.value}</div>
                <div className="font-body text-xs text-muted-foreground tracking-wide uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="ornament mb-2">✦</div>
          <EditableText contentKey="grounds_section_title" fallback="Пять Площадок Мастерства" isAdmin={isAdmin}
            as="h2" className="font-display text-4xl font-light mb-3" />
          <EditableText contentKey="grounds_section_subtitle" fallback="Каждая ступень открывается после успешного завершения предыдущей"
            isAdmin={isAdmin} as="p" className="font-body text-sm text-muted-foreground max-w-md mx-auto" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {GROUNDS.map((g, i) => (
            <div key={g.id} onClick={() => setPage("grounds")} className="card-luxury rounded-lg p-5 text-center transition-all duration-300 cursor-pointer">
              <div className={`w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center ${i === 0 ? "gold-gradient" : "bg-muted/50 border border-border/60"}`}>
                <Icon name={g.icon} size={18} className={i === 0 ? "text-stone-900" : "text-muted-foreground"} />
              </div>
              <div className="font-body text-[10px] tracking-widest text-muted-foreground uppercase mb-1">{i + 1} ступень</div>
              <EditableText contentKey={`ground${g.id}_title`} fallback={g.title} isAdmin={isAdmin}
                as="div" className="font-display text-base font-medium mb-1" style={i === 0 ? { color: "hsl(45, 80%, 65%)" } : {}} />
              {i > 0 && <Icon name="Lock" size={12} className="mx-auto mt-1 text-muted-foreground/40" />}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/40 py-20">
        <div className="max-w-7xl mx-auto px-6">
          {/* Image + text row */}
          <div className="flex flex-col lg:flex-row gap-10 items-center mb-16">
            <div className="w-full lg:w-2/5 flex-shrink-0">
              <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "4/5" }}>
                <img
                  src={HERO_IMG}
                  alt="Золотое Наследие — пространство знаний"
                  className="w-full h-full object-cover object-center"
                  style={{ filter: "brightness(0.9) saturate(0.85)" }}
                />
                {/* Gold frame accent */}
                <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 0 1px rgba(180,140,40,0.3)" }} />
                {/* Bottom overlay with tagline */}
                <div className="absolute bottom-0 inset-x-0 p-5"
                  style={{ background: "linear-gradient(to top, rgba(6,14,9,0.92) 0%, transparent 100%)" }}>
                  <div className="ornament text-sm mb-1">✦</div>
                  <EditableText contentKey="about_img_caption" fallback="Пространство, созданное для роста"
                    isAdmin={isAdmin} as="div" className="font-display text-lg font-light" style={{ color: "hsl(45, 85%, 70%)" }} />
                  <div className="font-body text-xs text-muted-foreground mt-0.5 tracking-wide">
                    Академия наставничества · с 2014 года
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="ornament mb-3">✦</div>
              <h2 className="font-display text-4xl lg:text-5xl font-light mb-4 leading-tight">
                <EditableText contentKey="about_title_line1" fallback="Место, где опыт" isAdmin={isAdmin} as="span" /><br />
                <EditableText contentKey="about_title_line2" fallback="становится наследием" isAdmin={isAdmin} as="span" className="gold-text-gradient" />
              </h2>
              <div className="divider-gold w-20 mb-5" />
              <EditableText contentKey="about_text" fallback="Мы создали систему, в которой каждый эксперт может структурировать свои знания, передать их следующему поколению и оставить след, который будет жить в людях."
                isAdmin={isAdmin} as="p" multiline className="font-body text-sm text-muted-foreground leading-relaxed mb-6 max-w-lg" />
              <div className="space-y-4">
                {[
                  { icon: "Award", title: "Сертификаты", desc: "Именной документ после каждой из пяти ступеней" },
                  { icon: "Shield", title: "Закрытый клуб", desc: "Эксклюзивное сообщество с бонусами по статусу" },
                  { icon: "Users", title: "Личный наставник", desc: "Поддержка опытного ментора на всём пути" },
                ].map((feat) => (
                  <div key={feat.title} className="flex items-start gap-4 p-4 rounded-lg border border-border/30 hover:border-amber-800/40 transition-all">
                    <div className="w-8 h-8 rounded gold-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon name={feat.icon} size={15} className="text-stone-900" />
                    </div>
                    <div>
                      <div className="font-display text-base font-medium mb-0.5" style={{ color: "hsl(45, 80%, 65%)" }}>{feat.title}</div>
                      <div className="font-body text-xs text-muted-foreground">{feat.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Контент программ курсов
const GROUND_PROGRAMS: Record<number, { week: string; topic: string }[]> = {
  1: [
    { week: "Неделя 1–2", topic: "Философия наставничества: ценности и миссия" },
    { week: "Неделя 2–3", topic: "Установление доверия и создание безопасной среды" },
    { week: "Неделя 3–4", topic: "Первая встреча с подопечным: диагностика и контакт" },
    { week: "Неделя 4", topic: "Обратная связь как инструмент роста. Итоговый проект" },
  ],
  2: [
    { week: "Неделя 1", topic: "Психология мотивации и внутренние движущие силы" },
    { week: "Неделя 2", topic: "Зоны роста и барьеры развития личности" },
    { week: "Неделя 3–4", topic: "Работа с сопротивлением и страхами" },
    { week: "Неделя 4–5", topic: "Раскрытие потенциала через системное мышление" },
  ],
  3: [
    { week: "Неделя 1–2", topic: "Авторские методики структурирования знаний" },
    { week: "Неделя 2–3", topic: "Создание персональных программ развития" },
    { week: "Неделя 3–5", topic: "Инструменты наставника: коучинг, менторинг, тьюторство" },
    { week: "Неделя 5–6", topic: "Оценка эффективности и корректировка программы" },
  ],
  4: [
    { week: "Неделя 1–2", topic: "Природа лидерства. Сила личного примера" },
    { week: "Неделя 2–3", topic: "Построение экспертной репутации в своей области" },
    { week: "Неделя 3–4", topic: "Расширение круга влияния и нетворкинг" },
    { week: "Неделя 4–5", topic: "Лидер как наставник: передача культуры и ценностей" },
  ],
  5: [
    { week: "Неделя 1–2", topic: "Архитектура собственной школы наставничества" },
    { week: "Неделя 2–4", topic: "Подготовка наставников следующего уровня" },
    { week: "Неделя 4–6", topic: "Создание методологии и авторских программ" },
    { week: "Неделя 6–8", topic: "Формирование наследия. Итоговая аттестация" },
  ],
};

// ─── GROUNDS PAGE ─────────────────────────────────────────────────────────────
function GroundsPage({ isLoggedIn, setShowLogin, profile, isAdmin }: { isLoggedIn: boolean; setShowLogin: (v: boolean) => void; profile: ProfileData | null; isAdmin: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [programModal, setProgramModal] = useState<number | null>(null);
  const [startModal, setStartModal] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const completedGrounds = profile?.completedGrounds ?? 0;
  useContent(); // подписываемся на обновления контента

  const handleStartGround = async (groundId: number) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setStarting(true);
    await fetch(`${ADMIN_URL}?action=start_ground`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body: JSON.stringify({ user_id: profile?.user.id, ground_id: groundId }),
    });
    setStarting(false);
    setStartModal(null);
    window.location.reload();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="ornament mb-2">✦</div>
        <h1 className="font-display text-5xl font-light mb-3">Площадки Обучения</h1>
        <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">Последовательный путь от основ до уровня Мастер-наставника</p>
      </div>

      <div className="space-y-4">
        {GROUNDS.map((g, i) => {
          const isOpen = selected === g.id;
          const isAvailable = i === 0 || (isLoggedIn && i < completedGrounds + 1);
          const inProgress = profile?.progress.find((p) => p.ground_id === g.id && p.status === "active");

          return (
            <div key={g.id} className={`card-luxury rounded-lg overflow-hidden transition-all duration-300 ${!isAvailable ? "opacity-70" : ""}`}>
              <button className="w-full flex items-center gap-4 p-5 sm:p-6 text-left hover:bg-white/[0.02] transition-all" onClick={() => setSelected(isOpen ? null : g.id)}>
                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isAvailable ? "gold-gradient text-stone-900" : "bg-muted/40 border border-border/50 text-muted-foreground"}`}>
                  {isAvailable ? <Icon name={g.icon} size={18} /> : <Icon name="Lock" size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-body text-[10px] tracking-widest text-muted-foreground uppercase">Площадка {g.id}</span>
                    {inProgress && <span className="status-badge bg-amber-900/30 border border-amber-700/30 text-amber-600/80 text-[9px]">В процессе</span>}
                  </div>
                  <EditableText contentKey={`ground${g.id}_title`} fallback={g.title} isAdmin={isAdmin}
                    as="div" className="font-display text-xl font-medium" style={isAvailable ? { color: "hsl(45, 80%, 68%)" } : {}} />
                  <EditableText contentKey={`ground${g.id}_subtitle`} fallback={g.subtitle} isAdmin={isAdmin}
                    as="div" className="font-body text-xs text-muted-foreground" />
                </div>
                <div className="hidden sm:flex items-center gap-4 text-muted-foreground">
                  <div className="text-center"><div className="font-display text-base font-medium text-foreground/60">{g.modules}</div><div className="font-body text-[10px] uppercase tracking-wide">модулей</div></div>
                  <div className="text-center"><div className="font-display text-base font-medium text-foreground/60">{g.duration}</div><div className="font-body text-[10px] uppercase tracking-wide">срок</div></div>
                </div>
                <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={18} className="text-muted-foreground flex-shrink-0" />
              </button>
              {isOpen && (
                <div className="border-t border-border/40 p-5 sm:p-6 animate-fade-in">
                  <EditableText contentKey={`ground${g.id}_description`} fallback={g.description} isAdmin={isAdmin}
                    as="p" multiline className="font-body text-sm text-muted-foreground leading-relaxed mb-5" />
                  <div className="flex flex-col sm:flex-row gap-3">
                    {isAvailable ? (
                      <>
                        <button
                          className="btn-gold px-6 py-2.5 rounded"
                          onClick={() => {
                            if (!isLoggedIn) { setShowLogin(true); return; }
                            if (inProgress) return;
                            setStartModal(g.id);
                          }}
                        >
                          {inProgress ? "✓ Обучение идёт" : "Начать площадку"}
                        </button>
                        <button className="btn-outline-gold px-6 py-2.5 rounded" onClick={() => setProgramModal(g.id)}>
                          Программа курса
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Icon name="Lock" size={14} />
                        <span className="font-body text-xs">Доступно после завершения площадки {g.id - 1}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoggedIn && (
        <div className="mt-10 card-luxury rounded-lg p-8 text-center shimmer">
          <Icon name="Star" size={24} className="mx-auto mb-3" style={{ color: "hsl(45, 80%, 55%)" }} />
          <h3 className="font-display text-2xl mb-2" style={{ color: "hsl(45, 80%, 65%)" }}>Начните путь к мастерству</h3>
          <p className="font-body text-sm text-muted-foreground mb-5 max-w-xs mx-auto">Создайте личный кабинет для доступа к обучению и отслеживания прогресса</p>
          <button onClick={() => setShowLogin(true)} className="btn-gold px-8 py-3 rounded">Зарегистрироваться</button>
        </div>
      )}

      {/* Modal: программа курса */}
      {programModal !== null && (() => {
        const g = GROUNDS.find(gr => gr.id === programModal)!;
        const program = GROUND_PROGRAMS[programModal] || [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setProgramModal(null)} />
            <div className="relative card-luxury rounded-lg p-6 sm:p-8 w-full max-w-lg animate-scale-in">
              <button onClick={() => setProgramModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center flex-shrink-0">
                  <Icon name={g.icon} size={16} className="text-stone-900" />
                </div>
                <div>
                  <div className="font-body text-[10px] tracking-widest text-muted-foreground uppercase">Площадка {g.id}</div>
                  <div className="font-display text-xl font-medium" style={{ color: "hsl(45, 80%, 68%)" }}>{g.title}</div>
                </div>
              </div>
              <div className="divider-gold mb-4" />
              <div className="flex gap-4 mb-5 font-body text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Icon name="BookOpen" size={13} />{g.modules} модулей</span>
                <span className="flex items-center gap-1"><Icon name="Clock" size={13} />{g.duration}</span>
              </div>
              <div className="space-y-3">
                {program.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded bg-muted/10 border border-border/30">
                    <div className="w-5 h-5 rounded-full gold-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="font-body text-[9px] font-bold text-stone-900">{i + 1}</span>
                    </div>
                    <div>
                      <div className="font-body text-[10px] text-muted-foreground tracking-wide uppercase mb-0.5">{item.week}</div>
                      <div className="font-body text-sm text-foreground/80">{item.topic}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setProgramModal(null); if (isLoggedIn) setStartModal(g.id); else setShowLogin(true); }}
                className="btn-gold w-full py-3 rounded mt-5">
                Начать эту площадку
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal: подтверждение старта */}
      {startModal !== null && (() => {
        const g = GROUNDS.find(gr => gr.id === startModal)!;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStartModal(null)} />
            <div className="relative card-luxury rounded-lg p-6 sm:p-8 w-full max-w-sm animate-scale-in text-center">
              <button onClick={() => setStartModal(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><Icon name="X" size={18} /></button>
              <div className="w-14 h-14 rounded-full gold-gradient flex items-center justify-center mx-auto mb-4">
                <Icon name={g.icon} size={22} className="text-stone-900" />
              </div>
              <h3 className="font-display text-2xl mb-2" style={{ color: "hsl(45, 80%, 68%)" }}>Начать площадку?</h3>
              <p className="font-body text-sm text-muted-foreground mb-5">
                Вы начнёте обучение на площадке <span style={{ color: "hsl(45, 75%, 65%)" }}>«{g.title}»</span>.<br />Продолжительность — {g.duration}.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setStartModal(null)} className="btn-outline-gold flex-1 py-2.5 rounded">Отмена</button>
                <button onClick={() => handleStartGround(g.id)} disabled={starting} className="btn-gold flex-1 py-2.5 rounded disabled:opacity-60">
                  {starting ? "Запускаем..." : "Начать!"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
interface AdminUser {
  id: number; name: string; email: string; status: string; level: number;
  is_admin: boolean; cert_count: number;
  progress: { ground_id: number; percent: number; status: string }[];
  certificates: { ground_id: number }[];
}

function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [working, setWorking] = useState(false);

  const token = localStorage.getItem(TOKEN_KEY) || "";

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`${ADMIN_URL}?action=users`, { headers: { "X-Session-Token": token } });
    if (res.ok) { const d = await res.json(); setUsers(d.users || []); }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const issueCert = async (userId: number, groundId: number) => {
    setWorking(true); setMsg("");
    const res = await fetch(`${ADMIN_URL}?action=issue_cert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body: JSON.stringify({ user_id: userId, ground_id: groundId }),
    });
    const d = await res.json();
    setMsg(d.message || d.error || "");
    setWorking(false);
    loadUsers();
  };

  const setProgress = async (userId: number, groundId: number, percent: number) => {
    setWorking(true); setMsg("");
    const module = Math.ceil((percent / 100) * (GROUNDS.find(g => g.id === groundId)?.modules || 8));
    const res = await fetch(`${ADMIN_URL}?action=set_progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": token },
      body: JSON.stringify({ user_id: userId, ground_id: groundId, percent, current_module: module }),
    });
    const d = await res.json();
    setMsg(d.message || d.error || "");
    setWorking(false);
    loadUsers();
  };

  return (
    <div className="card-luxury rounded-lg p-6 lg:col-span-3 border border-amber-800/40">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded gold-gradient flex items-center justify-center">
          <Icon name="ShieldCheck" size={15} className="text-stone-900" />
        </div>
        <h3 className="font-display text-xl font-medium" style={{ color: "hsl(45, 80%, 68%)" }}>Панель Администратора</h3>
      </div>

      {msg && <div className="mb-4 p-3 rounded bg-green-900/20 border border-green-700/30 font-body text-xs text-green-400">{msg}</div>}

      {loading ? (
        <div className="font-body text-sm text-muted-foreground">Загрузка участников...</div>
      ) : users.length === 0 ? (
        <div className="font-body text-sm text-muted-foreground">Участников пока нет</div>
      ) : (
        <div className="space-y-4">
          {users.filter(u => !u.is_admin).map((u) => (
            <div key={u.id} className="p-4 rounded-lg bg-muted/10 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-base font-medium" style={{ color: "hsl(45, 75%, 65%)" }}>{u.name}</div>
                  <div className="font-body text-xs text-muted-foreground">{u.email} · {u.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="status-badge bg-amber-900/20 border border-amber-800/30 text-amber-600/80 text-[9px]">
                    Ур. {u.level}
                  </span>
                  <span className="font-body text-xs text-muted-foreground">{u.cert_count} серт.</span>
                </div>
              </div>

              {/* Площадки */}
              <div className="grid grid-cols-5 gap-2">
                {GROUNDS.map((g) => {
                  const prog = u.progress?.find((p) => p.ground_id === g.id);
                  const cert = u.certificates?.find((c) => c.ground_id === g.id);
                  return (
                    <div key={g.id} className="text-center p-2 rounded bg-muted/10 border border-border/20">
                      <div className="font-body text-[9px] text-muted-foreground uppercase mb-1">П{g.id}</div>
                      <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center ${cert ? "gold-gradient" : prog ? "border border-amber-700/40 bg-transparent" : "bg-muted/30"}`}>
                        <Icon name={cert ? "Award" : prog ? g.icon : "Lock"} size={11}
                          className={cert ? "text-stone-900" : prog ? "" : "text-muted-foreground/30"}
                          style={(!cert && prog) ? { color: "hsl(45,70%,55%)" } : {}}
                        />
                      </div>
                      {prog && <div className="font-body text-[9px] text-muted-foreground">{prog.percent}%</div>}
                      <div className="flex flex-col gap-1 mt-1.5">
                        {!cert && (
                          <button
                            onClick={() => issueCert(u.id, g.id)}
                            disabled={working}
                            className="font-body text-[8px] rounded px-1 py-0.5 border border-amber-700/40 hover:bg-amber-900/20 transition-all disabled:opacity-40"
                            style={{ color: "hsl(45,70%,55%)" }}
                            title="Выдать сертификат"
                          >
                            Серт.
                          </button>
                        )}
                        {!prog && !cert && (
                          <button
                            onClick={() => setProgress(u.id, g.id, 50)}
                            disabled={working}
                            className="font-body text-[8px] rounded px-1 py-0.5 border border-border/40 hover:bg-muted/20 transition-all disabled:opacity-40 text-muted-foreground"
                            title="Начать площадку (50%)"
                          >
                            50%
                          </button>
                        )}
                        {prog && prog.status !== "completed" && (
                          <button
                            onClick={() => setProgress(u.id, g.id, 100)}
                            disabled={working}
                            className="font-body text-[8px] rounded px-1 py-0.5 border border-green-800/40 hover:bg-green-900/20 transition-all disabled:opacity-40 text-green-500/70"
                            title="Завершить площадку"
                          >
                            100%
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CABINET PAGE ─────────────────────────────────────────────────────────────
function CabinetPage({ profile, onProfileUpdate, isAdmin: _isAdmin }: { profile: ProfileData; onProfileUpdate: (token: string) => void; isAdmin: boolean }) {
  const { user, progress, certificates, completedGrounds } = profile;
  const currentProgress = progress.find((p) => p.status === "active");
  const currentGround = currentProgress ? GROUNDS.find((g) => g.id === currentProgress.ground_id) : GROUNDS[0];

  useEffect(() => {
    const interval = setInterval(() => {
      const tok = localStorage.getItem(TOKEN_KEY);
      if (tok) onProfileUpdate(tok);
    }, 30000);
    return () => clearInterval(interval);
  }, [onProfileUpdate]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="mb-10">
        <div className="ornament mb-1">✦</div>
        <h1 className="font-display text-4xl font-light">Личный Кабинет</h1>
        {user.is_admin && (
          <div className="mt-1 flex items-center gap-1.5">
            <Icon name="ShieldCheck" size={13} style={{ color: "hsl(45,70%,55%)" }} />
            <span className="font-body text-xs" style={{ color: "hsl(45,70%,55%)" }}>Администратор</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-luxury rounded-lg p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-full gold-gradient flex items-center justify-center text-xl font-bold text-stone-900 mb-3 font-body">{getAvatarLetters(user.name)}</div>
            <h2 className="font-display text-2xl font-medium mb-1" style={{ color: "hsl(45, 80%, 68%)" }}>{user.name}</h2>
            <span className="status-badge bg-amber-900/30 border border-amber-700/30 text-amber-600 text-[10px]">{user.status}</span>
            <div className="font-body text-xs text-muted-foreground mt-2">С нами с {formatDate(user.created_at)}</div>
          </div>
          <div className="divider-gold mb-4" />
          <div className="space-y-3">
            {[
              { icon: "Award", label: "Площадок пройдено", value: `${completedGrounds} из 5` },
              { icon: "FileText", label: "Сертификатов", value: certificates.length },
              { icon: "Shield", label: "Уровень", value: `${user.level} из 5` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon name={item.icon} size={14} />
                  <span className="font-body text-xs">{item.label}</span>
                </div>
                <span className="font-body text-xs font-medium" style={{ color: "hsl(45, 70%, 60%)" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-luxury rounded-lg p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-xl font-medium">Текущий курс</h3>
            {currentProgress
              ? <span className="status-badge bg-green-900/20 border border-green-700/30 text-green-500/80 text-[10px]">Активен</span>
              : <span className="status-badge bg-muted/20 border border-border/30 text-muted-foreground text-[10px]">Не начат</span>
            }
          </div>
          {currentGround && (
            <div className="bg-muted/20 rounded-lg p-4 mb-5 border border-border/40">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center">
                  <Icon name={currentGround.icon} size={14} className="text-stone-900" />
                </div>
                <div>
                  <div className="font-display text-base font-medium" style={{ color: "hsl(45, 80%, 65%)" }}>{currentGround.title}</div>
                  <div className="font-body text-xs text-muted-foreground">Площадка {currentGround.id} из 5</div>
                </div>
              </div>
              {currentProgress && (
                <div className="mb-2">
                  <div className="flex justify-between font-body text-xs text-muted-foreground mb-1.5">
                    <span>Прогресс</span>
                    <span style={{ color: "hsl(45, 70%, 60%)" }}>{currentProgress.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full progress-bar-gold rounded-full transition-all duration-1000" style={{ width: `${currentProgress.percent}%` }} />
                  </div>
                  <div className="font-body text-xs text-muted-foreground mt-1">Модуль {currentProgress.current_module} из {currentProgress.total_modules}</div>
                </div>
              )}
            </div>
          )}
          {currentProgress && currentProgress.status === "active" ? (
            <button
              onClick={async () => {
                const tok = localStorage.getItem(TOKEN_KEY) || "";
                await fetch(`${PROGRESS_URL}?action=complete_module`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "X-Session-Token": tok },
                  body: JSON.stringify({ ground_id: currentProgress.ground_id, module_num: currentProgress.current_module }),
                });
                onProfileUpdate(tok);
              }}
              className="btn-gold w-full py-3 rounded"
            >
              Завершить модуль {currentProgress.current_module} →
            </button>
          ) : (
            <div className="font-body text-xs text-center text-muted-foreground py-2">Нет активных площадок — перейдите в раздел «Площадки»</div>
          )}
        </div>

        <div className="card-luxury rounded-lg p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-xl font-medium">Мои Сертификаты</h3>
            <span className="font-body text-xs text-muted-foreground">{certificates.length} из 5</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {GROUNDS.map((g) => {
              const cert = certificates.find((c) => c.ground_id === g.id);
              return (
                <div key={g.id} className={`rounded-lg p-4 text-center border transition-all duration-200 ${cert ? "border-amber-700/40 bg-amber-900/10 hover:border-amber-600/60" : "border-border/30 bg-muted/10 opacity-50"}`}>
                  <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${cert ? "gold-gradient" : "bg-muted/30"}`}>
                    <Icon name={cert ? "Award" : "Lock"} size={16} className={cert ? "text-stone-900" : "text-muted-foreground/40"} />
                  </div>
                  <div className="font-body text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Площадка {g.id}</div>
                  <div className="font-display text-xs font-medium leading-tight" style={cert ? { color: "hsl(45, 75%, 65%)" } : {}}>{g.title}</div>
                  {cert && <button className="mt-2 font-body text-[10px] underline" style={{ color: "hsl(45, 70%, 55%)" }}>Скачать</button>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin Panel */}
        {user.is_admin && <AdminPanel />}
      </div>
    </div>
  );
}

// ─── PROGRESS PAGE ────────────────────────────────────────────────────────────
function ProgressPage({ profile, onProfileUpdate }: { profile: ProfileData; onProfileUpdate: (token: string) => void }) {
  const { progress, certificates, completedGrounds } = profile;
  const [completing, setCompleting] = useState<number | null>(null);
  const [notification, setNotification] = useState<{ msg: string; type: "success" | "info" | "level" } | null>(null);

  const token = localStorage.getItem(TOKEN_KEY) || "";

  const completeModule = async (groundId: number, moduleNum: number) => {
    setCompleting(groundId);
    setNotification(null);
    try {
      const res = await fetch(`${PROGRESS_URL}?action=complete_module`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({ ground_id: groundId, module_num: moduleNum }),
      });
      const d = await res.json();
      if (d.cert_issued) {
        setNotification({ msg: `🎓 Сертификат площадки получен! Вы перешли на ступень ${d.new_level_title}`, type: "level" });
      } else if (d.level_up) {
        setNotification({ msg: `⬆️ Поздравляем! Новый уровень: ${d.new_level_title}`, type: "level" });
      } else if (d.success) {
        setNotification({ msg: `✅ Модуль ${moduleNum} завершён. Прогресс: ${d.percent}%`, type: "success" });
      }
      onProfileUpdate(token);
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="mb-10">
        <div className="ornament mb-1">✦</div>
        <h1 className="font-display text-4xl font-light">Мой Прогресс</h1>
      </div>

      <div className="card-luxury rounded-lg p-6 mb-6">
        <h3 className="font-display text-xl mb-5">Путь к Мастеру</h3>
        <div className="relative">
          <div className="absolute top-5 left-5 right-5 h-px bg-border/40 hidden sm:block" />
          <div className="absolute top-5 left-5 h-px hidden sm:block progress-bar-gold" style={{ width: `${(completedGrounds / 5) * 100 + 10}%` }} />
          <div className="grid grid-cols-5 gap-2 sm:gap-4 relative">
            {GROUNDS.map((g, i) => {
              const done = i < completedGrounds;
              const current = progress.find((p) => p.ground_id === g.id && p.status === "active");
              return (
                <div key={g.id} className="flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-full z-10 flex items-center justify-center transition-all ${done ? "gold-gradient" : current ? "border-2 bg-background" : "bg-muted/30 border border-border/40"}`}
                    style={current ? { borderColor: "hsl(45, 70%, 45%)" } : {}}>
                    {done ? <Icon name="Check" size={16} className="text-stone-900" /> : current ? <Icon name={g.icon} size={16} style={{ color: "hsl(45, 75%, 60%)" }} /> : <Icon name="Lock" size={14} className="text-muted-foreground/40" />}
                  </div>
                  <div className="font-display text-xs font-medium leading-tight" style={done || current ? { color: "hsl(45, 75%, 65%)" } : { color: "hsl(215,15%,40%)" }}>{g.title}</div>
                  {done && <span className="font-body text-[9px] tracking-wide uppercase text-green-500/70">Завершено</span>}
                  {current && <span className="font-body text-[9px] tracking-wide uppercase" style={{ color: "hsl(45, 70%, 55%)" }}>В процессе</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: "BookOpen", label: "Площадок пройдено", value: `${completedGrounds} / 5` },
          { icon: "Award", label: "Сертификатов", value: certificates.length },
          { icon: "TrendingUp", label: "Активных курсов", value: progress.filter((p) => p.status === "active").length },
          { icon: "Shield", label: "Уровень клуба", value: profile.user.level },
        ].map((s) => (
          <div key={s.label} className="card-luxury rounded-lg p-4">
            <Icon name={s.icon} size={18} className="mb-2" style={{ color: "hsl(45, 70%, 55%)" }} />
            <div className="font-display text-2xl font-light mb-0.5" style={{ color: "hsl(45, 80%, 68%)" }}>{s.value}</div>
            <div className="font-body text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {notification && (
        <div className={`mb-4 p-4 rounded-lg border font-body text-sm ${notification.type === "level" ? "bg-amber-900/20 border-amber-700/40 text-amber-400" : "bg-green-900/15 border-green-700/30 text-green-400"}`}>
          {notification.msg}
          <button onClick={() => setNotification(null)} className="ml-3 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {progress.length > 0 ? (
        <div className="card-luxury rounded-lg p-6">
          <h3 className="font-display text-xl mb-4">Детали по площадкам</h3>
          <div className="space-y-4">
            {progress.map((p) => {
              const g = GROUNDS.find((gr) => gr.id === p.ground_id);
              if (!g) return null;
              const isActive = p.status === "active";
              return (
                <div key={p.ground_id} className="p-4 rounded-lg bg-muted/10 border border-border/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: p.status === "completed" ? "linear-gradient(135deg, hsl(45,80%,55%), hsl(36,70%,42%))" : "rgba(200,160,40,0.12)" }}>
                        <Icon name={p.status === "completed" ? "Award" : g.icon} size={14} className={p.status === "completed" ? "text-stone-900" : ""} style={isActive ? { color: "hsl(45,75%,60%)" } : {}} />
                      </div>
                      <div className="font-display text-sm font-medium" style={{ color: "hsl(45, 75%, 65%)" }}>{g.title}</div>
                    </div>
                    <span className="font-body text-[10px] uppercase tracking-wide" style={{ color: p.status === "completed" ? "hsl(140, 60%, 50%)" : "hsl(45, 70%, 55%)" }}>
                      {p.status === "completed" ? "Завершено" : "В процессе"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full progress-bar-gold rounded-full transition-all duration-500" style={{ width: `${p.percent}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-body text-xs text-muted-foreground">Модуль {p.current_module} из {p.total_modules} · {p.percent}%</div>
                    {isActive && (
                      <button
                        onClick={() => completeModule(p.ground_id, p.current_module)}
                        disabled={completing === p.ground_id}
                        className="btn-gold text-xs px-3 py-1.5 rounded disabled:opacity-40"
                      >
                        {completing === p.ground_id ? "Сохраняем..." : `Завершить модуль ${p.current_module}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card-luxury rounded-lg p-8 text-center">
          <Icon name="BookOpen" size={24} className="mx-auto mb-3" style={{ color: "hsl(45, 70%, 55%)" }} />
          <p className="font-display text-xl mb-1" style={{ color: "hsl(45, 75%, 65%)" }}>Вы ещё не начали обучение</p>
          <p className="font-body text-sm text-muted-foreground">Перейдите в раздел «Площадки» и начните первый курс</p>
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENTS LIBRARY ───────────────────────────────────────────────────────
interface DocFile {
  id: number;
  ground_id: number;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  required_level: number;
  created_at: string;
}

function DocumentsLibrary({ userLevel, isAdmin }: { userLevel: number; isAdmin: boolean }) {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [filterGround, setFilterGround] = useState<number>(0);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", ground_id: 0, required_level: 0, is_public: true });

  const token = localStorage.getItem(TOKEN_KEY) || "";

  const loadFiles = useCallback(async () => {
    setLoading(true);
    const url = filterGround ? `${FILES_URL}?action=list&ground_id=${filterGround}` : `${FILES_URL}?action=list`;
    const res = await fetch(url, { headers: { "X-Session-Token": token } });
    if (res.ok) { const d = await res.json(); setFiles(d.files || []); }
    setLoading(false);
  }, [token, filterGround]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput?.files?.[0]) { setUploadMsg("Выберите файл"); return; }
    const file = fileInput.files[0];
    if (file.size > 10 * 1024 * 1024) { setUploadMsg("Файл не должен превышать 10 МБ"); return; }

    setUploading(true); setUploadMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await fetch(`${FILES_URL}?action=upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": token },
        body: JSON.stringify({ ...uploadForm, file_data: base64, file_name: file.name }),
      });
      const d = await res.json();
      if (res.ok) {
        setUploadMsg("Файл загружен!");
        setShowUpload(false);
        loadFiles();
      } else {
        setUploadMsg(d.error || "Ошибка загрузки");
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const deleteFile = async (id: number) => {
    if (!confirm("Удалить файл?")) return;
    await fetch(`${FILES_URL}?action=delete&id=${id}`, { method: "DELETE", headers: { "X-Session-Token": token } });
    loadFiles();
  };

  const fileIcon = (type: string) => {
    if (type === "image") return "Image";
    if (type === "video") return "Video";
    return "FileText";
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="card-luxury rounded-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded gold-gradient flex items-center justify-center">
            <Icon name="FolderOpen" size={15} className="text-stone-900" />
          </div>
          <h3 className="font-display text-xl" style={{ color: "hsl(45, 80%, 65%)" }}>Библиотека материалов</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterGround}
            onChange={(e) => setFilterGround(Number(e.target.value))}
            className="bg-muted/20 border border-border/50 rounded px-2 py-1 font-body text-xs text-foreground/70 focus:outline-none"
          >
            <option value={0}>Все площадки</option>
            {GROUNDS.map(g => <option key={g.id} value={g.id}>Площадка {g.id}</option>)}
          </select>
          {isAdmin && (
            <button onClick={() => setShowUpload(!showUpload)} className="btn-gold text-xs px-3 py-1.5 rounded">
              <Icon name="Upload" size={12} className="inline mr-1" />Загрузить
            </button>
          )}
        </div>
      </div>

      {uploadMsg && <div className="mb-3 p-2 rounded bg-green-900/15 border border-green-700/20 font-body text-xs text-green-400">{uploadMsg}</div>}

      {showUpload && isAdmin && (
        <form onSubmit={handleUpload} className="mb-5 p-4 rounded-lg border border-amber-800/30 bg-amber-900/5 space-y-3">
          <div className="font-display text-base mb-2" style={{ color: "hsl(45, 75%, 65%)" }}>Загрузить файл</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Название файла" className="bg-muted/20 border border-border/50 rounded px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-amber-700/60" />
            <select value={uploadForm.ground_id} onChange={e => setUploadForm(f => ({ ...f, ground_id: Number(e.target.value) }))}
              className="bg-muted/20 border border-border/50 rounded px-3 py-2 font-body text-sm text-foreground/70 focus:outline-none">
              <option value={0}>Общий (без площадки)</option>
              {GROUNDS.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
          <input value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Описание (необязательно)" className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-amber-700/60" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select value={uploadForm.required_level} onChange={e => setUploadForm(f => ({ ...f, required_level: Number(e.target.value) }))}
              className="bg-muted/20 border border-border/50 rounded px-3 py-2 font-body text-sm text-foreground/70 focus:outline-none">
              <option value={0}>Доступен всем</option>
              <option value={1}>Уровень 1+</option>
              <option value={2}>Уровень 2+</option>
              <option value={3}>Уровень 3+</option>
              <option value={4}>Уровень 4+</option>
              <option value={5}>Только Мастера</option>
            </select>
            <input type="file" required accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp4" className="font-body text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-amber-700/40 file:text-amber-600 file:text-xs file:bg-transparent" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={uploading} className="btn-gold px-4 py-2 rounded text-sm disabled:opacity-50">{uploading ? "Загружаем..." : "Загрузить"}</button>
            <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 rounded text-sm border border-border/40 font-body text-muted-foreground hover:text-foreground transition-colors">Отмена</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="font-body text-sm text-muted-foreground py-4">Загружаем материалы...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="FolderOpen" size={28} className="mx-auto mb-2 opacity-30" />
          <p className="font-body text-sm text-muted-foreground">Материалов пока нет{isAdmin ? " — загрузите первый!" : ""}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {files.map((f) => {
            const hasAccess = userLevel >= f.required_level;
            return (
              <div key={f.id} className={`p-3 rounded-lg border transition-all ${hasAccess ? "border-border/40 bg-muted/10 hover:border-amber-800/40" : "border-border/20 bg-muted/5 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${hasAccess ? "gold-gradient" : "bg-muted/30"}`}>
                    <Icon name={fileIcon(f.file_type)} size={14} className={hasAccess ? "text-stone-900" : "text-muted-foreground/40"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm font-medium truncate" style={hasAccess ? { color: "hsl(45, 75%, 65%)" } : {}}>{f.title}</div>
                    {f.description && <div className="font-body text-xs text-muted-foreground truncate">{f.description}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      {f.ground_id > 0 && <span className="font-body text-[10px] text-muted-foreground">Площадка {f.ground_id}</span>}
                      <span className="font-body text-[10px] text-muted-foreground">{formatSize(f.file_size)}</span>
                      {f.required_level > 0 && <span className="font-body text-[10px] text-amber-600/70">Ур. {f.required_level}+</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {hasAccess && (
                      <a href={f.file_url} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-amber-900/20 transition-colors" title="Открыть">
                        <Icon name="ExternalLink" size={13} style={{ color: "hsl(45, 70%, 55%)" }} />
                      </a>
                    )}
                    {!hasAccess && <Icon name="Lock" size={14} className="text-muted-foreground/30" />}
                    {isAdmin && (
                      <button onClick={() => deleteFile(f.id)} className="p-1.5 rounded hover:bg-red-900/20 transition-colors text-muted-foreground/40 hover:text-red-400">
                        <Icon name="Trash2" size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CLUB PAGE ────────────────────────────────────────────────────────────────
function ClubPage({ profile, isAdmin }: { profile: ProfileData; isAdmin: boolean }) {
  const { user } = profile;

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="ornament mb-2">✦</div>
        <h1 className="font-display text-5xl font-light mb-2">Закрытый Клуб</h1>
        <p className="font-body text-sm text-muted-foreground">Золотое сообщество наставников</p>
      </div>

      <div className="max-w-md mx-auto mb-10">
        <div className="card-luxury rounded-lg p-6 shimmer border border-amber-800/30">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-stone-900 font-bold font-body">{getAvatarLetters(user.name)}</div>
            <div>
              <div className="font-display text-xl font-medium" style={{ color: "hsl(45, 80%, 68%)" }}>{user.name}</div>
              <div className="status-badge bg-amber-900/30 border border-amber-700/30 text-amber-600 text-[10px]">{user.status}</div>
            </div>
            <div className="ml-auto"><Icon name="Shield" size={28} style={{ color: "hsl(45, 70%, 50%)" }} /></div>
          </div>
          <div className="divider-gold mb-3" />
          <div className="flex justify-between font-body text-xs text-muted-foreground">
            <span>Член клуба с {formatDate(user.created_at)}</span>
            <span style={{ color: "hsl(45, 70%, 55%)" }}>Уровень {user.level} из 5</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {[
          { icon: "BookMarked", title: "Библиотека наставника", desc: "Эксклюзивные материалы, книги и исследования для членов клуба", minLevel: 0 },
          { icon: "Video", title: "Мастер-классы", desc: "Еженедельные встречи с опытными наставниками и экспертами", minLevel: 0 },
          { icon: "Users", title: "Сеть контактов", desc: "Прямой доступ к сообществу из 247 практикующих наставников", minLevel: 0 },
          { icon: "Gift", title: "Бонусы I ступени", desc: "Специальные материалы и скидки для наставников первой ступени", minLevel: 1 },
          { icon: "Gem", title: "Бонусы II–IV ступеней", desc: "Расширенные привилегии, наставничество один-на-один", minLevel: 2 },
          { icon: "Crown", title: "Зал Мастеров", desc: "Элитное сообщество Мастер-наставников и особые возможности", minLevel: 5 },
        ].map((item) => {
          const available = user.level >= item.minLevel;
          return (
            <div key={item.title} className={`card-luxury rounded-lg p-5 transition-all duration-300 ${!available ? "opacity-50" : "hover:scale-[1.02]"}`}>
              <div className={`w-9 h-9 rounded flex items-center justify-center mb-3 ${available ? "gold-gradient" : "bg-muted/30"}`}>
                <Icon name={item.icon} size={16} className={available ? "text-stone-900" : "text-muted-foreground/40"} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display text-base font-medium" style={available ? { color: "hsl(45, 80%, 65%)" } : {}}>{item.title}</h3>
                {!available && <Icon name="Lock" size={12} className="text-muted-foreground/40" />}
              </div>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              {available && <button className="mt-3 font-body text-xs btn-outline-gold px-4 py-1.5 rounded">Открыть</button>}
            </div>
          );
        })}
      </div>

      <div className="card-luxury rounded-lg p-6">
        <h3 className="font-display text-xl mb-4">Ближайшие встречи клуба</h3>
        <div className="space-y-3">
          {[
            { date: "25 марта", time: "19:00", title: "Вебинар: Как создать школу наставничества", type: "Онлайн" },
            { date: "1 апреля", time: "18:30", title: "Мастер-класс: Психология мотивации", type: "Онлайн" },
            { date: "15 апреля", time: "11:00", title: "Живая встреча участников в Москве", type: "Офлайн" },
          ].map((ev) => (
            <div key={ev.date} className="flex items-center gap-4 p-3 rounded bg-muted/10 border border-border/30 hover:border-amber-800/40 transition-all">
              <div className="text-center w-14 flex-shrink-0">
                <div className="font-display text-base font-medium" style={{ color: "hsl(45, 75%, 65%)" }}>{ev.date}</div>
                <div className="font-body text-[10px] text-muted-foreground">{ev.time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-body text-sm text-foreground/80 truncate">{ev.title}</div>
                <div className="font-body text-[10px] text-muted-foreground">{ev.type}</div>
              </div>
              <button className="btn-outline-gold px-3 py-1.5 rounded flex-shrink-0 text-[10px]">Записаться</button>
            </div>
          ))}
        </div>
      </div>

      {/* Хранилище документов */}
      <DocumentsLibrary userLevel={user.level} isAdmin={isAdmin} />
    </div>
  );
}

// ─── CONTACTS PAGE ────────────────────────────────────────────────────────────
function ContactsPage({ isAdmin }: { isAdmin: boolean }) {
  const contacts = [
    { icon: "Mail", label: "Email", ck: "contacts_email", fallback: "info@zolotoe-nasledie.ru" },
    { icon: "Phone", label: "Телефон", ck: "contacts_phone", fallback: "+7 (800) 000-00-00" },
    { icon: "MapPin", label: "Адрес", ck: "contacts_address", fallback: "Москва, ул. Примерная, 1" },
    { icon: "MessageCircle", label: "Telegram", ck: "contacts_telegram", fallback: "@zolotoe_nasledie" },
  ];
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="ornament mb-2">✦</div>
        <h1 className="font-display text-5xl font-light mb-3">Контакты</h1>
        <p className="font-body text-sm text-muted-foreground max-w-sm mx-auto">Мы рады ответить на ваши вопросы о программах обучения</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {contacts.map((c) => (
          <div key={c.label} className="card-luxury rounded-lg p-5 flex items-center gap-4 hover:scale-[1.01] transition-all">
            <div className="w-10 h-10 rounded gold-gradient flex items-center justify-center flex-shrink-0"><Icon name={c.icon} size={16} className="text-stone-900" /></div>
            <div>
              <div className="font-body text-xs text-muted-foreground uppercase tracking-wide">{c.label}</div>
              <EditableText contentKey={c.ck} fallback={c.fallback} isAdmin={isAdmin}
                as="div" className="font-body text-sm text-foreground/80" />
            </div>
          </div>
        ))}
      </div>
      <div className="card-luxury rounded-lg p-6 sm:p-8">
        <h3 className="font-display text-2xl mb-5" style={{ color: "hsl(45, 80%, 65%)" }}>Написать нам</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Имя</label>
              <input type="text" placeholder="Ваше имя" className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors" />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Email</label>
              <input type="email" placeholder="your@email.ru" className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors" />
            </div>
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Сообщение</label>
            <textarea rows={4} placeholder="Расскажите о вашем запросе..." className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors resize-none" />
          </div>
          <EditableText contentKey="contact_btn_send" fallback="Отправить сообщение" isAdmin={isAdmin}
            as="button" className="btn-gold w-full py-3 rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────
function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (data: { token: string; profile: ProfileData }) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const action = isRegister ? "register" : "login";
      const body: Record<string, string> = { email, password };
      if (isRegister) body.name = name;

      const res = await fetch(`${AUTH_URL}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка"); setLoading(false); return; }

      const token = data.token;
      const profileRes = await fetch(`${AUTH_URL}?action=profile`, { headers: { "X-Session-Token": token } });
      const profileData = await profileRes.json();

      onLogin({ token, profile: profileData });
    } catch {
      setError("Ошибка соединения");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card-luxury rounded-lg p-6 sm:p-8 w-full max-w-md animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
          <Icon name="X" size={18} />
        </button>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center mx-auto mb-3">
            <Icon name="Star" size={20} className="text-stone-900" />
          </div>
          <h2 className="font-display text-2xl font-medium mb-1" style={{ color: "hsl(45, 80%, 65%)" }}>
            {isRegister ? "Регистрация" : "Вход в кабинет"}
          </h2>
          <p className="font-body text-xs text-muted-foreground">{isRegister ? "Начните свой путь к мастерству" : "Добро пожаловать в Академию"}</p>
        </div>

        <div className="space-y-3">
          {isRegister && (
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Имя</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше имя"
                className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors" />
            </div>
          )}
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.ru"
              className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors" />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wide block mb-1.5">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-muted/20 border border-border/50 rounded px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-700/60 transition-colors" />
          </div>

          {error && <p className="font-body text-xs text-red-400 text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={loading} className="btn-gold w-full py-3 rounded mt-1 disabled:opacity-60">
            {loading ? "Подождите..." : isRegister ? "Создать аккаунт" : "Войти"}
          </button>
        </div>

        <div className="divider-gold my-5" />
        <p className="text-center font-body text-xs text-muted-foreground">
          {isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?"}{" "}
          <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="underline transition-colors" style={{ color: "hsl(45, 70%, 60%)" }}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </button>
        </p>
      </div>
    </div>
  );
}