# PLAN DZIAŁANIA - NATYCHMIASTOWE KROKI IMPLEMENTACYJNE

*Konkretny plan wykonania dla projektu Radio Adamowo (MGX-version-3)*

---

## 🚨 EMERGENCY RESPONSE - PIERWSZE 48 GODZIN

### Krytyczne Luki Bezpieczeństwa [NATYCHMIAST]

**1. Zabezpieczenie PHP Endpoints**
```bash
# Tymczasowo wyłącz niebezpieczne endpointy
echo "<?php http_response_code(503); echo 'Maintenance mode'; ?>" > api/get_comments.php.bak
echo "<?php http_response_code(503); echo 'Maintenance mode'; ?>" > api/add_comment.php.bak

# Backup oryginalnych plików
cp api/get_comments.php api/get_comments.php.original
cp api/add_comment.php api/add_comment.php.original
```

**2. Podstawowa Ochrona CORS**
```php
// Dodaj do wszystkich PHP API files na początku:
<?php
// Bezpieczna konfiguracja CORS
$allowed_origins = [
    'https://radio-adamowo.pl',
    'https://www.radio-adamowo.pl'
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: https://radio-adamowo.pl");
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
?>
```

**3. Basic Rate Limiting (.htaccess)**
```apache
# Dodaj do głównego .htaccess
<IfModule mod_evasive24.c>
    DOSHashTableSize    10000
    DOSPageCount        3
    DOSPageInterval     1
    DOSSiteCount        50
    DOSSiteInterval     1
    DOSBlockingPeriod   600
</IfModule>

# Limit dla API endpoints
<LocationMatch "^/api/">
    <RequireAll>
        Require all granted
        # Max 10 requests per minute per IP
        SetEnvIf Request_URI "^/api/" api_request
        RewriteEngine On
        RewriteRule ^api/ - [E=api_request:1]
    </RequireAll>
</LocationMatch>
```

---

## 📋 WEEK 1: STABILIZACJA KRYTYCZNA

### Dzień 1-2: Security Patches

**Task 1.1: Secure PHP API Rewrite**
```php
// api/v1/secure_comments.php - Nowa bezpieczna implementacja
<?php
require_once '../config/security.php';

class SecureCommentsAPI extends BaseSecureAPI {
    private $rateLimiter;
    private $validator;
    
    public function __construct() {
        parent::__construct();
        $this->rateLimiter = new RateLimiter();
        $this->validator = new InputValidator();
    }
    
    public function getComments() {
        // Rate limiting check
        if (!$this->rateLimiter->checkLimit($_SERVER['REMOTE_ADDR'], 10, 60)) {
            $this->sendError(429, 'Too many requests');
            return;
        }
        
        // CSRF validation
        if (!$this->validateCSRF()) {
            $this->sendError(403, 'CSRF token invalid');
            return;
        }
        
        // Input validation
        $date = $this->validator->validateDate($_GET['date'] ?? '');
        if (!$date) {
            $this->sendError(400, 'Invalid date format');
            return;
        }
        
        try {
            $stmt = $this->pdo->prepare(
                "SELECT id, name, text, created_at 
                 FROM calendar_comments 
                 WHERE comment_date = ? AND status = 'approved' 
                 ORDER BY created_at DESC LIMIT 50"
            );
            $stmt->execute([$date]);
            $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $this->sendSuccess($comments);
        } catch (Exception $e) {
            error_log("Comments API Error: " . $e->getMessage());
            $this->sendError(500, 'Internal server error');
        }
    }
}

$api = new SecureCommentsAPI();
$api->handleRequest();
?>
```

**Task 1.2: JavaScript Error Handling**
```javascript
// src/core/ErrorHandler.js - Nowy error handler
class GlobalErrorHandler {
    constructor() {
        this.setupGlobalHandlers();
        this.errorQueue = [];
        this.initialized = false;
    }
    
    setupGlobalHandlers() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });
        
        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                promise: event.promise
            });
            
            // Show user-friendly message
            this.showUserError('Wystąpił nieoczekiwany błąd. Odśwież stronę.');
        });
        
        // Console cleanup for production
        if (window.location.hostname !== 'localhost') {
            this.disableConsole();
        }
    }
    
    logError(type, details) {
        const errorInfo = {
            type,
            details,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getCurrentUserId()
        };
        
        // Send to monitoring service (when available)
        this.errorQueue.push(errorInfo);
        
        // Local logging for debugging
        if (process.env.NODE_ENV === 'development') {
            console.error('Error logged:', errorInfo);
        }
    }
    
    showUserError(message) {
        // Show user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc2626;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
    
    disableConsole() {
        const noop = () => {};
        ['log', 'warn', 'info', 'debug'].forEach(method => {
            console[method] = noop;
        });
    }
}

// Initialize immediately
new GlobalErrorHandler();
```

### Dzień 3-4: Missing Files Creation

**Task 1.3: Service Worker Implementation**
```javascript
// sw.js - Basic Service Worker
const CACHE_NAME = 'radio-adamowo-v1.0.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/src/app.js',
    '/lang/pl.json',
    '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching files');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Skip waiting');
                return self.skipWaiting();
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - Cache first for static assets, network first for API
self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // API requests - Network first
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache successful API responses
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Return cached response if available
                    return caches.match(request);
                })
        );
        return;
    }
    
    // Static assets - Cache first
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                return fetch(request).then(response => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseToCache);
                    });
                    
                    return response;
                });
            })
    );
});

// Background sync for offline functionality (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-notes-sync') {
        event.waitUntil(syncNotes());
    }
});

async function syncNotes() {
    try {
        const notes = await getOfflineNotes();
        for (const note of notes) {
            await syncNoteToServer(note);
        }
        await clearOfflineNotes();
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}
```

**Task 1.4: Language Files Creation**
```json
// lang/pl.json - Polskie tłumaczenia (pierwsze 50 kluczy)
{
  "header": {
    "title": "Radio Adamowo",
    "subtitle": "Platforma Edukacyjna o Manipulacji Psychologicznej",
    "navigation": {
      "home": "Start",
      "player": "Player",
      "lab": "Laboratorium",
      "progress": "Postępy",
      "about": "O Projekcie"
    }
  },
  "radio": {
    "controls": {
      "play": "Odtwórz",
      "pause": "Pauza", 
      "stop": "Stop",
      "next": "Następny",
      "previous": "Poprzedni",
      "shuffle": "Losowo",
      "repeat": "Powtarzaj",
      "volume": "Głośność"
    },
    "moodTitle": "Wybierz Nastrój",
    "moods": {
      "ambient": "Ambient",
      "focus": "Koncentracja",
      "relax": "Relaks",
      "energetic": "Energetyczny",
      "dark": "Ciemny"
    }
  },
  "manipulation": {
    "title": "Laboratorium Manipulacji",
    "subtitle": "Ucz się rozpoznawać techniki manipulacyjne",
    "techniques": {
      "gaslighting": "Gaslighting",
      "projection": "Projekcja",
      "triangulation": "Triangulacja",
      "lovebombing": "Love Bombing",
      "silenttreatment": "Milczące leczenie"
    },
    "scenarios": {
      "workplace": "Miejsce pracy",
      "relationship": "Związek",
      "family": "Rodzina",
      "social": "Sytuacje społeczne"
    }
  },
  "common": {
    "loading": "Ładowanie...",
    "error": "Wystąpił błąd",
    "success": "Sukces",
    "retry": "Spróbuj ponownie",
    "close": "Zamknij",
    "save": "Zapisz",
    "cancel": "Anuluj",
    "continue": "Kontynuuj",
    "back": "Wstecz",
    "next": "Dalej"
  }
}
```

### Dzień 5-7: Code Quality Improvements

**Task 1.5: JavaScript Modularization Start**
```javascript
// src/app.js - Główna aplikacja z modularną strukturą
import { ErrorHandler } from './core/ErrorHandler.js';
import { I18nManager } from './modules/i18n/I18nManager.js';
import { AudioPlayer } from './modules/audio/AudioPlayer.js';
import { UIManager } from './modules/ui/UIManager.js';
import { PWAManager } from './modules/pwa/PWAManager.js';

class RadioAdamowoApp {
    constructor() {
        this.errorHandler = new ErrorHandler();
        this.i18nManager = null;
        this.audioPlayer = null;
        this.uiManager = null;
        this.pwaManager = null;
        
        this.initialized = false;
        this.loadingPromises = [];
    }
    
    async init() {
        try {
            console.log('Initializing Radio Adamowo App...');
            
            // Initialize core modules first
            await this.initializeCoreModules();
            
            // Initialize feature modules
            await this.initializeFeatureModules();
            
            // Setup inter-module communication
            this.setupModuleCommunication();
            
            // Mark as initialized
            this.initialized = true;
            
            console.log('Radio Adamowo App initialized successfully');
            
            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('app:ready'));
            
        } catch (error) {
            this.errorHandler.logError('App Initialization Failed', error);
            this.showFallbackUI();
        }
    }
    
    async initializeCoreModules() {
        // I18n Manager - Critical for UI
        this.i18nManager = new I18nManager();
        await this.i18nManager.init();
        
        // UI Manager - Critical for interactions
        this.uiManager = new UIManager(this.i18nManager);
        await this.uiManager.init();
        
        // PWA Manager - Enhanced experience
        this.pwaManager = new PWAManager();
        await this.pwaManager.init();
    }
    
    async initializeFeatureModules() {
        // Audio Player - Can be lazy loaded
        try {
            this.audioPlayer = new AudioPlayer(this.i18nManager);
            await this.audioPlayer.init();
        } catch (error) {
            console.warn('Audio player initialization failed:', error);
            this.showAudioUnavailableMessage();
        }
    }
    
    setupModuleCommunication() {
        // Event-based communication between modules
        document.addEventListener('language:changed', (event) => {
            this.handleLanguageChange(event.detail.language);
        });
        
        document.addEventListener('audio:error', (event) => {
            this.handleAudioError(event.detail.error);
        });
    }
    
    handleLanguageChange(newLanguage) {
        if (this.audioPlayer) {
            this.audioPlayer.updateLanguage(newLanguage);
        }
        if (this.uiManager) {
            this.uiManager.updateLanguage(newLanguage);
        }
    }
    
    handleAudioError(error) {
        this.errorHandler.logError('Audio Error', error);
        this.uiManager.showAudioErrorMessage();
    }
    
    showFallbackUI() {
        document.body.innerHTML = `
            <div class="fallback-ui">
                <h1>Radio Adamowo</h1>
                <p>Aplikacja ładuje się... Jeśli problem się powtarza, odśwież stronę.</p>
                <button onclick="location.reload()">Odśwież stronę</button>
            </div>
        `;
    }
    
    showAudioUnavailableMessage() {
        const message = this.i18nManager.t('audio.unavailable') || 
                       'Funkcje audio są tymczasowo niedostępne';
        this.uiManager.showNotification(message, 'warning');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.radioApp = new RadioAdamowoApp();
    window.radioApp.init();
});

// Export for testing
export { RadioAdamowoApp };
```

---

## 📅 WEEK 2-4: ARCHITECTURE REFACTORING

### Task 2.1: Module System Implementation

**Directory Structure Setup**
```bash
mkdir -p src/{core,modules/{audio,i18n,ui,pwa,manipulation},services,utils}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs/{api,guides,examples}
```

**Core Module: Event Bus**
```javascript
// src/core/EventBus.js
class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Set();
        this.debugMode = process.env.NODE_ENV === 'development';
    }
    
    on(event, callback, options = {}) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const handler = {
            callback,
            priority: options.priority || 0,
            once: options.once || false
        };
        
        this.events.get(event).add(handler);
        
        if (this.debugMode) {
            console.log(`EventBus: Registered handler for ${event}`);
        }
        
        // Return unsubscribe function
        return () => this.off(event, callback);
    }
    
    off(event, callback) {
        if (!this.events.has(event)) return;
        
        const handlers = this.events.get(event);
        for (const handler of handlers) {
            if (handler.callback === callback) {
                handlers.delete(handler);
                break;
            }
        }
        
        if (handlers.size === 0) {
            this.events.delete(event);
        }
    }
    
    emit(event, data, options = {}) {
        if (!this.events.has(event)) {
            if (this.debugMode) {
                console.warn(`EventBus: No handlers for event ${event}`);
            }
            return Promise.resolve([]);
        }
        
        const handlers = Array.from(this.events.get(event))
            .sort((a, b) => b.priority - a.priority);
        
        const promises = handlers.map(async (handler) => {
            try {
                const result = await handler.callback(data);
                
                if (handler.once) {
                    this.off(event, handler.callback);
                }
                
                return result;
            } catch (error) {
                console.error(`EventBus: Error in handler for ${event}:`, error);
                return null;
            }
        });
        
        if (options.waitForAll) {
            return Promise.all(promises);
        }
        
        return Promise.resolve(promises);
    }
    
    once(event, callback, options = {}) {
        return this.on(event, callback, { ...options, once: true });
    }
}

export { EventBus };
```

### Task 2.2: Build System Implementation

**webpack.config.js**
```javascript
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    
    return {
        entry: {
            app: './src/app.js',
            worker: './sw.js'
        },
        
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash].js' : '[name].js',
            chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
            publicPath: '/'
        },
        
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src'),
                '@core': path.resolve(__dirname, 'src/core'),
                '@modules': path.resolve(__dirname, 'src/modules'),
                '@utils': path.resolve(__dirname, 'src/utils')
            }
        },
        
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    targets: {
                                        browsers: ['> 1%', 'last 2 versions']
                                    }
                                }]
                            ]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: [
                        isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
                        'css-loader',
                        'postcss-loader'
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg|ico)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'images/[name][ext][query]'
                    }
                },
                {
                    test: /\.(woff|woff2|eot|ttf)$/,
                    type: 'asset/resource',
                    generator: {
                        filename: 'fonts/[name][ext][query]'
                    }
                }
            ]
        },
        
        plugins: [
            new CleanWebpackPlugin(),
            
            new HtmlWebpackPlugin({
                template: './index.html',
                filename: 'index.html',
                chunks: ['app'],
                minify: isProduction
            }),
            
            ...(isProduction ? [
                new MiniCssExtractPlugin({
                    filename: '[name].[contenthash].css',
                    chunkFilename: '[name].[contenthash].chunk.css'
                })
            ] : [])
        ],
        
        optimization: {
            splitChunks: {
                chunks: 'all',
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        chunks: 'all',
                        priority: 10
                    },
                    common: {
                        name: 'common',
                        minChunks: 2,
                        chunks: 'all',
                        priority: 5
                    }
                }
            },
            
            ...(isProduction ? {
                minimizer: [
                    new TerserPlugin({
                        terserOptions: {
                            compress: {
                                drop_console: true
                            }
                        }
                    }),
                    new CssMinimizerPlugin()
                ]
            } : {})
        },
        
        devServer: {
            static: {
                directory: path.join(__dirname, 'dist')
            },
            compress: true,
            port: 3000,
            hot: true,
            open: true,
            historyApiFallback: true
        },
        
        devtool: isProduction ? 'source-map' : 'eval-source-map'
    };
};
```

**package.json Scripts**
```json
{
  "name": "radio-adamowo",
  "version": "1.0.0",
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production",
    "build:analyze": "webpack --mode production --analyze",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "lint": "eslint src/ --fix",
    "lint:css": "stylelint src/**/*.css --fix",
    "format": "prettier --write \"src/**/*.{js,css,html}\"",
    "security-audit": "npm audit --audit-level moderate",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "babel-loader": "^9.1.0",
    "css-loader": "^6.7.0",
    "css-minimizer-webpack-plugin": "^4.2.0",
    "eslint": "^8.30.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "html-webpack-plugin": "^5.5.0",
    "husky": "^8.0.0",
    "jest": "^29.3.0",
    "mini-css-extract-plugin": "^2.7.0",
    "playwright": "^1.28.0",
    "postcss": "^8.4.0",
    "postcss-loader": "^7.0.0",
    "prettier": "^2.8.0",
    "style-loader": "^3.3.0",
    "stylelint": "^14.16.0",
    "terser-webpack-plugin": "^5.3.0",
    "webpack": "^5.75.0",
    "webpack-cli": "^5.0.0",
    "webpack-dev-server": "^4.11.0"
  }
}
```

---

## 🧪 TESTING IMPLEMENTATION

### Task 3.1: Unit Testing Setup

**Jest Configuration (jest.config.js)**
```javascript
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/vendor/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1'
  }
};
```

**Example Unit Tests**
```javascript
// tests/unit/ErrorHandler.test.js
import { ErrorHandler } from '@core/ErrorHandler.js';

describe('ErrorHandler', () => {
  let errorHandler;
  let mockConsoleError;
  
  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    mockConsoleError.mockRestore();
  });
  
  test('should log errors correctly', () => {
    const testError = new Error('Test error');
    
    errorHandler.logError('Test Type', testError);
    
    expect(errorHandler.errorQueue).toHaveLength(1);
    expect(errorHandler.errorQueue[0]).toMatchObject({
      type: 'Test Type',
      details: expect.objectContaining({
        message: 'Test error'
      })
    });
  });
  
  test('should show user-friendly error messages', () => {
    const testMessage = 'Test error message';
    
    errorHandler.showUserError(testMessage);
    
    const errorToast = document.querySelector('.error-toast');
    expect(errorToast).toBeTruthy();
    expect(errorToast.textContent).toBe(testMessage);
  });
  
  test('should handle global errors', () => {
    const spy = jest.spyOn(errorHandler, 'logError');
    
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'Global test error',
      filename: 'test.js',
      lineno: 1
    }));
    
    expect(spy).toHaveBeenCalledWith('JavaScript Error', expect.objectContaining({
      message: 'Global test error'
    }));
  });
});
```

### Task 3.2: Integration Testing

**Playwright E2E Tests**
```javascript
// tests/e2e/app.spec.js
import { test, expect } from '@playwright/test';

test.describe('Radio Adamowo App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });
  
  test('should load main page without errors', async ({ page }) => {
    // Check if main elements are present
    await expect(page.locator('h1')).toContainText('Radio Adamowo');
    await expect(page.locator('.radio-player')).toBeVisible();
    await expect(page.locator('.tab-navigation')).toBeVisible();
  });
  
  test('should switch languages', async ({ page }) => {
    // Test language switching
    await page.click('[data-i18n-lang="en"]');
    await expect(page.locator('[data-i18n="header.title"]')).toContainText('Radio Adamowo');
    
    await page.click('[data-i18n-lang="pl"]');
    await expect(page.locator('[data-i18n="header.title"]')).toContainText('Radio Adamowo');
  });
  
  test('should handle audio player interactions', async ({ page }) => {
    // Test audio player
    const playButton = page.locator('.play-btn');
    await expect(playButton).toBeVisible();
    
    await playButton.click();
    
    // Check if UI updates correctly (even if audio doesn't play)
    await expect(playButton).toHaveClass(/playing/);
  });
  
  test('should work on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check mobile navigation
    const mobileMenuButton = page.locator('.mobile-menu-toggle');
    await expect(mobileMenuButton).toBeVisible();
    
    await mobileMenuButton.click();
    await expect(page.locator('.mobile-nav')).toBeVisible();
  });
  
  test('should handle errors gracefully', async ({ page }) => {
    // Test error handling
    await page.evaluate(() => {
      throw new Error('Test error');
    });
    
    // Should not crash the app
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

---

## 📊 MONITORING AND METRICS

### Task 4.1: Performance Monitoring

**Performance Observer Implementation**
```javascript
// src/core/PerformanceMonitor.js
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
        this.thresholds = {
            fcp: 2500,      // First Contentful Paint
            lcp: 4000,      // Largest Contentful Paint
            fid: 100,       // First Input Delay
            cls: 0.1        // Cumulative Layout Shift
        };
        
        this.init();
    }
    
    init() {
        if (!('PerformanceObserver' in window)) {
            console.warn('PerformanceObserver not supported');
            return;
        }
        
        this.observeWebVitals();
        this.observeResourceTiming();
        this.observeUserTiming();
    }
    
    observeWebVitals() {
        // First Contentful Paint
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                this.recordMetric('fcp', entry.startTime);
            }
        }).observe({ entryTypes: ['paint'] });
        
        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                this.recordMetric('lcp', entry.startTime);
            }
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                this.recordMetric('fid', entry.processingStart - entry.startTime);
            }
        }).observe({ entryTypes: ['first-input'] });
        
        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
            let clsValue = 0;
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            }
            this.recordMetric('cls', clsValue);
        }).observe({ entryTypes: ['layout-shift'] });
    }
    
    recordMetric(name, value) {
        this.metrics.set(name, value);
        
        // Check against thresholds
        const threshold = this.thresholds[name];
        if (threshold && value > threshold) {
            console.warn(`Performance threshold exceeded for ${name}: ${value} > ${threshold}`);
            this.reportSlowMetric(name, value);
        }
        
        // Send to analytics
        this.sendToAnalytics(name, value);
    }
    
    reportSlowMetric(metric, value) {
        // Report to monitoring service
        fetch('/api/v1/metrics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'performance',
                metric,
                value,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            })
        }).catch(error => {
            console.error('Failed to report performance metric:', error);
        });
    }
    
    sendToAnalytics(metric, value) {
        // Google Analytics 4 example
        if (typeof gtag !== 'undefined') {
            gtag('event', 'web_vitals', {
                metric_name: metric,
                metric_value: value,
                metric_threshold: this.thresholds[metric]
            });
        }
    }
    
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
}

export { PerformanceMonitor };
```

### Task 4.2: Error Reporting Integration

**Sentry Integration Example**
```javascript
// src/core/ErrorReporting.js
import * as Sentry from '@sentry/browser';

class ErrorReporting {
    constructor() {
        this.initialized = false;
        this.init();
    }
    
    init() {
        if (process.env.NODE_ENV === 'production') {
            Sentry.init({
                dsn: process.env.SENTRY_DSN,
                environment: process.env.NODE_ENV,
                integrations: [
                    new Sentry.Integrations.BrowserTracing(),
                ],
                tracesSampleRate: 1.0,
                beforeSend(event) {
                    // Filter out noise
                    if (event.exception) {
                        const error = event.exception.values[0];
                        if (error && error.type === 'NetworkError') {
                            return null; // Don't report network errors
                        }
                    }
                    return event;
                }
            });
            
            this.initialized = true;
        }
    }
    
    reportError(error, context = {}) {
        if (this.initialized) {
            Sentry.captureException(error, {
                tags: context.tags || {},
                extra: context.extra || {},
                user: context.user || {}
            });
        } else {
            console.error('Error (not reported):', error, context);
        }
    }
    
    reportMessage(message, level = 'info', context = {}) {
        if (this.initialized) {
            Sentry.captureMessage(message, level);
        } else {
            console.log(`${level.toUpperCase()}: ${message}`, context);
        }
    }
    
    setUserContext(user) {
        if (this.initialized) {
            Sentry.setUser(user);
        }
    }
    
    addBreadcrumb(message, category = 'default', level = 'info') {
        if (this.initialized) {
            Sentry.addBreadcrumb({
                message,
                category,
                level,
                timestamp: Date.now() / 1000
            });
        }
    }
}

export { ErrorReporting };
```

---

## 🎯 SUCCESS METRICS AND VALIDATION

### Weekly Progress Checkpoints

**Week 1 Validation:**
- [ ] Zero critical security vulnerabilities in security scan
- [ ] All API endpoints return proper error codes
- [ ] Service Worker registers without errors
- [ ] Language switching works for at least 20 UI elements
- [ ] Performance score improvement: +15 points minimum

**Week 2-4 Validation:**
- [ ] Code quality score > 60/100  
- [ ] Test coverage > 70%
- [ ] Bundle size reduced by 30%
- [ ] Time to Interactive < 4 seconds
- [ ] All console.log statements removed from production

### Testing Automation

**GitHub Actions CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [16.x, 18.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run security audit
      run: npm run security-audit
    
    - name: Run unit tests
      run: npm run test
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Build production
      run: npm run build
    
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        
  lighthouse:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Lighthouse CI
      run: |
        npm install -g @lhci/cli@0.9.x
        lhci autorun
      env:
        LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

---

**Status:** 📋 Ready for Implementation  
**Estimated Timeline:** 4 weeks for core stabilization  
**Next Action:** Security emergency response (48 hours)  
**Review Frequency:** Daily standups, weekly milestone reviews

---

*Ten plan działania zapewnia konkretne, wykonalne kroki dla stabilizacji i ulepszenia projektu Radio Adamowo. Każde zadanie ma jasne kryteria sukcesu i może być śledzony w systemie zarządzania projektami.*