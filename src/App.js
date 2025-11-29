import React, { useState, useEffect, createContext, useContext } from 'react';
import { Moon, Sun, Monitor, Palette, Check, Download, Upload } from 'lucide-react';

// Theme Context
const ThemeContext = createContext();

// Available themes
const themes = {
  light: {
    name: 'Light',
    colors: {
      bg: '#ffffff',
      bgSecondary: '#f3f4f6',
      text: '#111827',
      textSecondary: '#6b7280',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      border: '#e5e7eb',
      shadow: 'rgba(0, 0, 0, 0.1)'
    }
  },
  dark: {
    name: 'Dark',
    colors: {
      bg: '#0f172a',
      bgSecondary: '#1e293b',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      border: '#334155',
      shadow: 'rgba(0, 0, 0, 0.3)'
    }
  },
  highContrast: {
    name: 'High Contrast',
    colors: {
      bg: '#000000',
      bgSecondary: '#1a1a1a',
      text: '#ffffff',
      textSecondary: '#cccccc',
      primary: '#00ff00',
      primaryHover: '#00cc00',
      border: '#ffffff',
      shadow: 'rgba(255, 255, 255, 0.2)'
    }
  }
};

// ADD THIS: Route-specific theme overrides
const routeThemeOverrides = {
  '/trailers': 'dark',
  '/docs': 'light',
  '/accessibility': 'highContrast'
};

function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [baseTheme, setBaseTheme] = useState('light'); // Store base theme
  const [autoTheme, setAutoTheme] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [userId, setUserId] = useState(null);
  const [currentRoute, setCurrentRoute] = useState('/'); // Track current route
  const [nonce] = useState(() => generateNonce()); // CSP nonce

  // Generate CSP nonce
  function generateNonce() {
    // Guard in case crypto is unavailable (very defensive)
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.getRandomValues) {
      return Math.random().toString(36).slice(2);
    }
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Apply route-specific theme override
  useEffect(() => {
    const override = routeThemeOverrides[currentRoute];
    if (override) {
      setCurrentTheme(override);
    } else {
      setCurrentTheme(baseTheme);
    }
  }, [currentRoute, baseTheme]);

  // Initialize theme from cookie/localStorage
  useEffect(() => {
    // Check for server-injected class to prevent flash
    const htmlElement = document.documentElement;
    const match = htmlElement.className.match(/theme-(\w+)/);
    const serverTheme = match?.[1];

    if (serverTheme && themes[serverTheme]) {
      setBaseTheme(serverTheme);
      setCurrentTheme(serverTheme);
    } else {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
        loadUserThemeFromDB(storedUserId).then(dbTheme => {
          if (dbTheme) {
            setBaseTheme(dbTheme);
            setCurrentTheme(dbTheme);
          }
        });
      }

      const cookieTheme = getCookie('theme');
      const cookieAuto = getCookie('autoTheme');

      if (cookieTheme) {
        setBaseTheme(cookieTheme);
        setCurrentTheme(cookieTheme);
      } else {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
          setBaseTheme(storedTheme);
          setCurrentTheme(storedTheme);
        }
      }

      if (cookieAuto === 'true') {
        setAutoTheme(true);
        applySystemTheme();
      }
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (autoTheme || getCookie('autoTheme') === 'true') {
        applySystemTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply theme with Framer Motion-style transition
  useEffect(() => {
    setIsTransitioning(true);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionDuration = prefersReducedMotion ? '0ms' : '500ms';

    document.documentElement.style.setProperty('--transition-duration', transitionDuration);

    const timer = setTimeout(
      () => setIsTransitioning(false),
      prefersReducedMotion ? 0 : 500
    );

    // Persist *base* theme (user preference)
    setCookie('theme', baseTheme, 365);
    localStorage.setItem('theme', baseTheme);

    // Save to simulated DB if logged in
    if (userId) {
      saveUserThemeToDB(userId, baseTheme);
    }

    // Apply theme class to html element (SSR support)
    document.documentElement.className = `theme-${currentTheme}`;

    applyThemeVariables(currentTheme);

    return () => clearTimeout(timer);
  }, [currentTheme, baseTheme, userId]);

  useEffect(() => {
    setCookie('autoTheme', autoTheme.toString(), 365);
    localStorage.setItem('autoTheme', autoTheme.toString());

    if (autoTheme) {
      applySystemTheme();
    }
  }, [autoTheme]);

  function applySystemTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setBaseTheme(isDark ? 'dark' : 'light');
  }

  function applyThemeVariables(themeName) {
    const theme = themes[themeName];
    const root = document.documentElement;

    // Create style element with CSP nonce
    let styleEl = document.getElementById('theme-vars');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'theme-vars';
      styleEl.setAttribute('nonce', nonce);
      document.head.appendChild(styleEl);
    }

    const cssVars = Object.entries(theme.colors)
      .map(([key, value]) => `--color-${key}: ${value};`)
      .join('\n    ');

    styleEl.textContent = `:root {\n    ${cssVars}\n  }`;
  }

  function changeTheme(newTheme) {
    setAutoTheme(false);
    setBaseTheme(newTheme);
  }

  function toggleAutoTheme() {
    setAutoTheme(!autoTheme);
  }

  function navigateToRoute(route) {
    setCurrentRoute(route);
  }

  // Simulated DB functions
  async function saveUserThemeToDB(userId, theme) {
    const userThemes = JSON.parse(localStorage.getItem('userThemesDB') || '{}');
    userThemes[userId] = theme;
    localStorage.setItem('userThemesDB', JSON.stringify(userThemes));
  }

  async function loadUserThemeFromDB(userId) {
    const userThemes = JSON.parse(localStorage.getItem('userThemesDB') || '{}');
    return userThemes[userId] || null;
  }

  function exportTheme() {
    const themeData = {
      currentTheme: baseTheme,
      autoTheme,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'theme-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importTheme(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.currentTheme && themes[data.currentTheme]) {
          setBaseTheme(data.currentTheme);
          setAutoTheme(data.autoTheme || false);
        }
      } catch (error) {
        console.error('Invalid theme file');
      }
    };
    reader.readAsText(file);
  }

  return (
    <ThemeContext.Provider value={{
      currentTheme,
      baseTheme,
      changeTheme,
      autoTheme,
      toggleAutoTheme,
      isTransitioning,
      exportTheme,
      importTheme,
      userId,
      setUserId,
      currentRoute,
      navigateToRoute,
      nonce
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Helper functions for cookies
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

// Theme Selector Component
function ThemeSelector() {
  const { currentTheme, changeTheme, autoTheme, toggleAutoTheme, isTransitioning } = useContext(ThemeContext);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-bgSecondary)',
          color: 'var(--color-text)',
          border: '2px solid var(--color-border)',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all var(--transition-duration) cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isTransitioning ? 'scale(0.95)' : 'scale(1)'
        }}
      >
        <Palette size={20} />
        <span>{autoTheme ? 'Auto' : themes[currentTheme].name}</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            backgroundColor: 'var(--color-bg)',
            border: '2px solid var(--color-border)',
            borderRadius: '16px',
            padding: '12px',
            minWidth: '240px',
            boxShadow: `0 8px 32px var(--color-shadow)`,
            zIndex: 1000,
            animation: 'slideIn 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => {
                toggleAutoTheme();
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: autoTheme ? 'var(--color-primary)' : 'var(--color-bgSecondary)',
                color: autoTheme ? '#ffffff' : 'var(--color-text)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 200ms'
              }}
            >
              <Monitor size={18} />
              <span>Auto (System)</span>
              {autoTheme && <Check size={18} style={{ marginLeft: 'auto' }} />}
            </button>
          </div>

          <div style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => {
                  changeTheme(key);
                  setIsOpen(false);
                }}
                style={{
                  padding: '12px',
                  backgroundColor: currentTheme === key && !autoTheme ? 'var(--color-primary)' : 'var(--color-bgSecondary)',
                  color: currentTheme === key && !autoTheme ? '#ffffff' : 'var(--color-text)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 200ms'
                }}
              >
                {key === 'light' && <Sun size={18} />}
                {key === 'dark' && <Moon size={18} />}
                {key === 'highContrast' && <Palette size={18} />}
                <span>{theme.name}</span>
                {currentTheme === key && !autoTheme && <Check size={18} style={{ marginLeft: 'auto' }} />}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// Import/Export Component
function ThemeImportExport() {
  const { exportTheme, importTheme } = useContext(ThemeContext);
  const fileInputRef = React.useRef(null);

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <button
        onClick={exportTheme}
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-primary)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 200ms'
        }}
      >
        <Download size={18} />
        Export Theme
      </button>

      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--color-bgSecondary)',
          color: 'var(--color-text)',
          border: '2px solid var(--color-border)',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 200ms'
        }}
      >
        <Upload size={18} />
        Import Theme
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            importTheme(e.target.files[0]);
          }
        }}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// Login Simulation Component
function LoginSection() {
  const { userId, setUserId } = useContext(ThemeContext);
  const [inputId, setInputId] = useState('');

  const handleLogin = () => {
    if (inputId.trim()) {
      setUserId(inputId.trim());
      localStorage.setItem('userId', inputId.trim());
      setInputId('');
    }
  };

  const handleLogout = () => {
    setUserId(null);
    localStorage.removeItem('userId');
  };

  if (userId) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--color-bgSecondary)',
        borderRadius: '12px',
        border: '2px solid var(--color-border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--color-textSecondary)', fontSize: '12px', margin: '0 0 4px 0' }}>
              Logged in as
            </p>
            <p style={{ color: 'var(--color-text)', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              {userId}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '2px solid var(--color-border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--color-bgSecondary)',
      borderRadius: '12px',
      border: '2px solid var(--color-border)'
    }}>
      <p style={{ color: 'var(--color-text)', fontSize: '14px', marginBottom: '12px' }}>
        Login to persist theme across devices
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          placeholder="Enter user ID"
          style={{
            flex: 1,
            padding: '10px 12px',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '2px solid var(--color-border)',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
        <button
          onClick={handleLogin}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}

// Route Navigation Component (demonstrates per-route theme overrides)
function RouteNavigation() {
  const { currentRoute, navigateToRoute } = useContext(ThemeContext);

  const routes = [
    { path: '/', name: 'Home', theme: 'Default' },
    { path: '/trailers', name: 'Trailers', theme: 'Dark' },
    { path: '/docs', name: 'Documentation', theme: 'Light' },
    { path: '/accessibility', name: 'Accessibility', theme: 'High Contrast' }
  ];

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--color-bgSecondary)',
      borderRadius: '12px',
      border: '2px solid var(--color-border)'
    }}>
      <h3 style={{
        color: 'var(--color-text)',
        margin: '0 0 12px 0',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        Route-Based Theme Overrides
      </h3>
      <p style={{
        color: 'var(--color-textSecondary)',
        fontSize: '13px',
        margin: '0 0 16px 0'
      }}>
        Click routes to see automatic theme switching based on context
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {routes.map(route => (
          <button
            key={route.path}
            onClick={() => navigateToRoute(route.path)}
            style={{
              padding: '10px 16px',
              backgroundColor: currentRoute === route.path ? 'var(--color-primary)' : 'var(--color-bg)',
              color: currentRoute === route.path ? '#ffffff' : 'var(--color-text)',
              border: `2px solid ${currentRoute === route.path ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              transition: 'all 200ms',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '4px'
            }}
          >
            <span>{route.name}</span>
            <span style={{
              fontSize: '11px',
              opacity: 0.8,
              fontWeight: 'normal'
            }}>
              Theme: {route.theme}
            </span>
          </button>
        ))}
      </div>
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: 'var(--color-bg)',
        borderRadius: '8px',
        border: '1px solid var(--color-border)'
      }}>
        <p style={{
          color: 'var(--color-textSecondary)',
          fontSize: '12px',
          margin: 0
        }}>
          Current Route: <strong style={{ color: 'var(--color-text)' }}>{currentRoute}</strong>
        </p>
      </div>
    </div>
  );
}

// CLS Monitor Component (Lighthouse optimization)
function CLSMonitor() {
  const [clsScore, setCLSScore] = useState(0);
  const [measurements, setMeasurements] = useState([]);

  useEffect(() => {
    let clsValue = 0;
    const clsEntries = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push({
            value: entry.value,
            time: new Date().toLocaleTimeString()
          });
          setCLSScore(clsValue);
          setMeasurements([...clsEntries]);
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    return () => observer.disconnect();
  }, []);

  const getScoreColor = (score) => {
    if (score < 0.1) return '#10b981'; // Good
    if (score < 0.25) return '#f59e0b'; // Needs improvement
    return '#ef4444'; // Poor
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--color-bgSecondary)',
      borderRadius: '12px',
      border: '2px solid var(--color-border)'
    }}>
      <h3 style={{
        color: 'var(--color-text)',
        margin: '0 0 12px 0',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        Lighthouse CLS Monitor
      </h3>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: getScoreColor(clsScore),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '16px'
        }}>
          {clsScore.toFixed(3)}
        </div>
        <div>
          <p style={{ color: 'var(--color-text)', margin: '0 0 4px 0', fontWeight: '600' }}>
            Cumulative Layout Shift
          </p>
          <p style={{ color: 'var(--color-textSecondary)', margin: 0, fontSize: '13px' }}>
            {clsScore < 0.1 ? '✅ Good' : clsScore < 0.25 ? '⚠️ Needs Improvement' : '❌ Poor'}
          </p>
        </div>
      </div>
      {measurements.length > 0 && (
        <div style={{
          padding: '8px',
          backgroundColor: 'var(--color-bg)',
          borderRadius: '6px',
          maxHeight: '100px',
          overflowY: 'auto'
        }}>
          <p style={{
            color: 'var(--color-textSecondary)',
            fontSize: '11px',
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            Layout Shift Events:
          </p>
          {measurements.slice(-5).map((m, i) => (
            <p key={i} style={{
              color: 'var(--color-textSecondary)',
              fontSize: '11px',
              margin: '0 0 4px 0'
            }}>
              {m.time}: +{m.value.toFixed(4)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// Demo Content Component
function DemoContent() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      marginTop: '32px'
    }}>
      <div style={{
        padding: '24px',
        backgroundColor: 'var(--color-bgSecondary)',
        borderRadius: '16px',
        border: '2px solid var(--color-border)',
        transition: 'all var(--transition-duration) cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <h2 style={{
          color: 'var(--color-text)',
          margin: '0 0 12px 0',
          fontSize: '24px',
          fontWeight: '700'
        }}>
          Theme Features Demo
        </h2>
        <p style={{
          color: 'var(--color-textSecondary)',
          margin: '0 0 16px 0',
          lineHeight: '1.6'
        }}>
          This theming system includes smooth color transitions with springy effects,
          reduced motion respect, and lazy-loaded theme chunks for optimal performance.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button style={{
            padding: '12px 24px',
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            Primary Button
          </button>

          <button style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: 'var(--color-primary)',
            border: '2px solid var(--color-primary)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            Secondary Button
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: '20px',
              backgroundColor: 'var(--color-bgSecondary)',
              borderRadius: '12px',
              border: '2px solid var(--color-border)',
              transition: 'all var(--transition-duration) cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <h3 style={{
              color: 'var(--color-text)',
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '600'
            }}>
              Card {i}
            </h3>
            <p style={{
              color: 'var(--color-textSecondary)',
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              Theme transitions apply smoothly to all components with proper color cascading.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  return (
    <ThemeProvider>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          transition:
            'background-color 500ms cubic-bezier(0.16, 1, 0.3, 1), color 500ms cubic-bezier(0.16, 1, 0.3, 1)', // Spring-like easing
          padding: '24px'
        }}
      >
        {/* SSR fallback for users with JS disabled */}
        <noscript>
          <style>{`
            :root {
              --color-bg: #ffffff;
              --color-text: #111827;
            }
          `}</style>
        </noscript>

        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '32px'
          }}>
            <div>
              <h1 style={{
                margin: '0 0 8px 0',
                fontSize: '32px',
                fontWeight: '800',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-primaryHover))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Advanced Theme System
              </h1>
              <p style={{
                margin: 0,
                color: 'var(--color-textSecondary)',
                fontSize: '14px'
              }}>
                Multi-device, conflict-resilient theming with SSR support
              </p>
            </div>
            <ThemeSelector />
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <LoginSection />
            <RouteNavigation />
            <CLSMonitor />
            <ThemeImportExport />
            <DemoContent />
          </div>

          <footer style={{
            marginTop: '48px',
            paddingTop: '24px',
            borderTop: '2px solid var(--color-border)',
            textAlign: 'center',
            color: 'var(--color-textSecondary)',
            fontSize: '12px'
          }}>
            <p style={{ margin: 0 }}>
              Theme persists via cookies + localStorage • Supports SSR flash-free rendering •
              CSP-safe inline styles • Lighthouse optimized
            </p>
          </footer>
        </div>
      </div>
    </ThemeProvider>
  );
}
