/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Оркестратор VKPluginManager.
// Управляет пулом токенов авторизации (ротация и failover), пресетами поставщиков,
// и очередью запросов с регулировкой RPS (лимит 3 запроса в секунду для VK API).

export interface AccountSettings {
  autoWatermark: boolean;         // Добавлять ли маркер/хештег бота в конец постов
  textSignature: string;          // Индивидуальная подпись под постом (например, "Заказать у: vk.me/club...")
  priceMarkupType: 'percent' | 'fixed'; // Индивидуальный тип наценки
  priceMarkupValue: number;       // Величина наценки (например, 20% или 500 руб)
  
  // Настройки приватности и публикации (VK API Privacy)
  privacy: {
    friendsOnly: boolean;         // Запись видна только друзьям (friends_only)
    closeComments: boolean;       // Запретить комментирование к этому посту (close_comments)
    muteNotifications: boolean;   // Опубликовать без пуш-уведомлений подписчикам (mute_notifications)
    markAsAds: boolean;           // Пометить запись как рекламную (mark_as_ads)
  };
  
  // Автоматические правила робота (Automated Bot Tasks)
  monitoring: {
    enabled: boolean;             // Фоновое сканирование доноров
    intervalMinutes: number;      // Интервал опроса в минутах
    autoExportAll: boolean;       // Авто-перенос новых постов в целевой паблик
  };
}

export interface VKAuthSession {
  token: string;
  firstName: string;
  lastName: string;
  avatar: string;
  userId: string;
  settings?: AccountSettings; // Индивидуальные точечные настройки для аккаунта
}

export interface GroupPreset {
  id: string;
  name: string;
  groupIds: string[]; // Список доменов/ид доноров, например: ["opt_sadovod", "shoes_wholesale"]
}

export interface GlobalBotRules {
  enableAntiDuplication: boolean; // Фильтровать pHash дубликаты перед публикацией
  maxPostLimitPerDay: number;     // Лимит выгрузок в день для защиты от спам-фильтра
  safetyDelaySeconds: number;     // Рандомизированная задержка (сек) для имитации человека
}

class VKPluginManagerClass {
  private sessions: VKAuthSession[] = [];
  private currentSessionIndex = 0;
  private presets: GroupPreset[] = [];
  
  // Глобальные правила по умолчанию
  private globalRules: GlobalBotRules = {
    enableAntiDuplication: true,
    maxPostLimitPerDay: 50,
    safetyDelaySeconds: 15,
  };

  // Очередь RPS-лимитера
  private queue: { task: () => Promise<any>; resolve: (v: any) => void; reject: (err: any) => void }[] = [];
  private isProcessingQueue = false;
  private rpsDelayMs = 350; // Безопасная пауза ~333мс (3 запроса в сек)

  constructor() {
    this.loadFromStorage();
    // Инициализация пресетов по умолчанию, если пусто
    if (this.presets.length === 0) {
      this.presets = [
        {
          id: 'preset_clothes',
          name: 'Линия Одежды Садовод',
          groupIds: ['opt_sadovod', 'luxury_elegance', 'vip_jackets'],
        },
        {
          id: 'preset_shoes',
          name: 'Линия Обуви Садовод',
          groupIds: ['shoes_wholesale', 'opt_sadovod'],
        }
      ];
      this.savePresetsToStorage();
    }
  }

  // --- Управление Сессиями / Пул токенов ---

  public getSessions(): VKAuthSession[] {
    return this.sessions;
  }

  // Инициализация дефолтных настроек робота для аккаунта
  private createDefaultSettings(): AccountSettings {
    return {
      autoWatermark: true,
      textSignature: '📦 Для заказа пишите в сообщения сообщества!',
      priceMarkupType: 'percent',
      priceMarkupValue: 15,
      privacy: {
        friendsOnly: false,
        closeComments: false,
        muteNotifications: false,
        markAsAds: false,
      },
      monitoring: {
        enabled: false,
        intervalMinutes: 15,
        autoExportAll: false,
      }
    };
  }

  public addSession(session: VKAuthSession): void {
    // Избегаем дубликатов токена
    const existing = this.sessions.find(s => s.token === session.token);
    
    // Переносим настройки, если уже были настроены
    const settings = existing?.settings || session.settings || this.createDefaultSettings();
    
    this.sessions = this.sessions.filter(s => s.token !== session.token);
    this.sessions.push({
      ...session,
      settings
    });
    this.saveSessionsToStorage();
  }

  public updateSessionSettings(token: string, settings: AccountSettings): void {
    this.sessions = this.sessions.map(s => {
      if (s.token === token) {
        return { ...s, settings };
      }
      return s;
    });
    this.saveSessionsToStorage();
  }

  public removeSession(token: string): void {
    this.sessions = this.sessions.filter(s => s.token !== token);
    if (this.currentSessionIndex >= this.sessions.length) {
      this.currentSessionIndex = 0;
    }
    this.saveSessionsToStorage();
  }

  /**
   * Возвращает первый доступный или активный токен
   */
  public getActiveToken(): string | null {
    if (this.sessions.length === 0) return null;
    return this.sessions[this.currentSessionIndex]?.token || null;
  }

  /**
   * Возвращает сессию по токену
   */
  public getSessionByToken(token: string): VKAuthSession | undefined {
    return this.sessions.find(s => s.token === token);
  }

  /**
   * Ротация токена при падении запроса (Failover)
   */
  public rotateToken(): string | null {
    if (this.sessions.length <= 1) return this.getActiveToken();
    this.currentSessionIndex = (this.currentSessionIndex + 1) % this.sessions.length;
    console.warn(`Внимание: токен заблокирован или вызвал ошибку. Изменяем сессию на слот #${this.currentSessionIndex}`);
    return this.getActiveToken();
  }

  // --- Глобальные настройки бота ---

  public getGlobalRules(): GlobalBotRules {
    return this.globalRules;
  }

  public updateGlobalRules(rules: GlobalBotRules): void {
    this.globalRules = rules;
    try {
      localStorage.setItem('vk_insights_global_rules', JSON.stringify(rules));
    } catch (e) {
      console.error(e);
    }
  }

  // --- Пресеты групп (Группы поставщиков) ---

  public getPresets(): GroupPreset[] {
    return this.presets;
  }

  public createPreset(name: string, groupIds: string[]): GroupPreset {
    const newPreset: GroupPreset = {
      id: `preset_${Date.now()}`,
      name,
      groupIds,
    };
    this.presets.push(newPreset);
    this.savePresetsToStorage();
    return newPreset;
  }

  public deletePreset(presetId: string): void {
    this.presets = this.presets.filter(p => p.id !== presetId);
    this.savePresetsToStorage();
  }

  // --- RPS Лимитер Очереди ---

  /**
   * Добавить запрос к VK API в очередь для защиты от RPS-блокировок
   */
  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.queue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        const result = await item.task();
        item.resolve(result);
      } catch (err: any) {
        // Проверяем: если ошибка вызвана токеном, делаем ротацию и пробуем выполнить задачу снова
        if (this.isTokenError(err)) {
          const nextToken = this.rotateToken();
          if (nextToken) {
            console.log('Попытка перезапустить запрос с новым токеном ротации...');
            try {
              const retryResult = await item.task();
              item.resolve(retryResult);
              continue;
            } catch (retryErr) {
              item.reject(retryErr);
            }
          } else {
            item.reject(err);
          }
        } else {
          item.reject(err);
        }
      }

      // Соблюдаем интервал между сетевыми вызовами
      await new Promise(r => setTimeout(r, this.rpsDelayMs));
    }

    this.isProcessingQueue = false;
  }

  private isTokenError(err: any): boolean {
    const errMsg = String(err.message || err).toLowerCase();
    return errMsg.includes('token') || errMsg.includes('auth') || errMsg.includes('user_id is undefined') || errMsg.includes('401');
  }

  // --- Локальное хранение конфигураций ---

  private loadFromStorage() {
    try {
      const savedSessions = localStorage.getItem('vk_insights_plugin_sessions');
      if (savedSessions) {
        this.sessions = JSON.parse(savedSessions);
      }
      const savedPresets = localStorage.getItem('vk_insights_plugin_presets');
      if (savedPresets) {
        this.presets = JSON.parse(savedPresets);
      }
      const savedRules = localStorage.getItem('vk_insights_global_rules');
      if (savedRules) {
        this.globalRules = JSON.parse(savedRules);
      }
    } catch (e) {
      console.error('Ошибка восстановления данных VKPluginManager:', e);
    }
  }

  private saveSessionsToStorage() {
    try {
      localStorage.setItem('vk_insights_plugin_sessions', JSON.stringify(this.sessions));
    } catch (e) {
      console.error(e);
    }
  }

  private savePresetsToStorage() {
    try {
      localStorage.setItem('vk_insights_plugin_presets', JSON.stringify(this.presets));
    } catch (e) {
      console.error(e);
    }
  }

  // --- Управление кастомными паттернами поставщиков ---

  public getSupplierPatterns(): Record<string, SupplierPattern> {
    try {
      const saved = localStorage.getItem('vk_supplier_patterns');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Ошибка чтения vk_supplier_patterns:', e);
      return {};
    }
  }

  public saveSupplierPattern(pattern: SupplierPattern): void {
    try {
      const patterns = this.getSupplierPatterns();
      patterns[pattern.ownerId] = pattern;
      localStorage.setItem('vk_supplier_patterns', JSON.stringify(patterns));
    } catch (e) {
      console.error('Ошибка записи vk_supplier_patterns:', e);
    }
  }

  public deleteSupplierPattern(ownerId: string): void {
    try {
      const patterns = this.getSupplierPatterns();
      delete patterns[ownerId];
      localStorage.setItem('vk_supplier_patterns', JSON.stringify(patterns));
    } catch (e) {
      console.error('Ошибка удаления vk_supplier_patterns:', e);
    }
  }
}

export interface SupplierPattern {
  ownerId: string;            // ID группы поставщика в VK
  pricePattern?: string;      // Сгенерированная регулярка для цены
  sizePattern?: string;       // Сгенерированная регулярка для размеров
}

export const VKPluginManager = new VKPluginManagerClass();
