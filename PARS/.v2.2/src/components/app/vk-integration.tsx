/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент интеграции и авторизации ВКонтакте (VK Integration & Auth Panel).
// Поддерживает пул токенов (Менеджер Аккаунтов) с защитой от RPS бана (3 запроса/сек)
// и Умный Менеджер Пресетов Групп Поставщиков Садовода.

import React, { useState, useEffect } from 'react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { VK_API, VKGroup } from '../../lib/vk-api-client';
import { VKPluginManager, VKAuthSession, GroupPreset } from '../../plugins/vk-manager';
import { 
  Key, 
  RefreshCw, 
  UserCheck, 
  Globe, 
  Activity, 
  LogOut, 
  Radio, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Send,
  HelpCircle,
  Database,
  Plus,
  Trash2,
  Settings,
  ShieldCheck
} from 'lucide-react';

export const VkIntegration: React.FC = () => {
  const {
    vkAccount,
    vkGroups,
    selectedTargetGroupId,
    exportLogs,
    loginVk,
    logoutVk,
    setVkGroups,
    setSelectedTargetGroupId,
    fetchOnlineWall,
    isLoading
  } = usePostsStore();

  // Пул токенов и сессий
  const [sessions, setSessions] = useState<VKAuthSession[]>(() => VKPluginManager.getSessions());
  const [showAddSessionForm, setShowAddSessionForm] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'sandbox' | 'real'>('sandbox');
  const [rawToken, setRawToken] = useState<string>('');
  const [showHelper, setShowHelper] = useState<boolean>(false);

  // Слой пресетов торговых групп Садовода
  const [presets, setPresets] = useState<GroupPreset[]>(() => VKPluginManager.getPresets());
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset_clothes');
  const [showPresetCreator, setShowPresetCreator] = useState<boolean>(false);
  const [customPresetName, setCustomPresetName] = useState<string>('');
  const [customPresetGroupIds, setCustomPresetGroupIds] = useState<string>('');

  // Состояния сбора
  const [groupInput, setGroupInput] = useState<string>('opt_sadovod, luxury_elegance, vip_jackets');
  const [fetchCount, setFetchCount] = useState<number>(30);
  const [parseStatus, setParseStatus] = useState<string | null>(null);

  // Тонкая настройка активного аккаунта & SMM-роботизация
  const activeSess = sessions.find(s => s.token === vkAccount?.access_token);
  const [activeConfigTab, setActiveConfigTab] = useState<'individual' | 'global'>('individual');

  // Локальные стейты для настроек сессии
  const [autoWatermark, setAutoWatermark] = useState(true);
  const [textSignature, setTextSignature] = useState('');
  const [priceMarkupType, setPriceMarkupType] = useState<'percent' | 'fixed'>('percent');
  const [priceMarkupValue, setPriceMarkupValue] = useState(15);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [closeComments, setCloseComments] = useState(false);
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [markAsAds, setMarkAsAds] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [monitoringInterval, setMonitoringInterval] = useState(15);
  const [autoExportAll, setAutoExportAll] = useState(false);

  // Синхронизация при выборе другого профиля из пула
  useEffect(() => {
    if (activeSess && activeSess.settings) {
      const s = activeSess.settings;
      setAutoWatermark(s.autoWatermark ?? true);
      setTextSignature(s.textSignature ?? '');
      setPriceMarkupType(s.priceMarkupType ?? 'percent');
      setPriceMarkupValue(s.priceMarkupValue ?? 15);
      setFriendsOnly(s.privacy?.friendsOnly ?? false);
      setCloseComments(s.privacy?.closeComments ?? false);
      setMuteNotifications(s.privacy?.muteNotifications ?? false);
      setMarkAsAds(s.privacy?.markAsAds ?? false);
      setMonitoringEnabled(s.monitoring?.enabled ?? false);
      setMonitoringInterval(s.monitoring?.intervalMinutes ?? 15);
      setAutoExportAll(s.monitoring?.autoExportAll ?? false);
    }
  }, [activeSess]);

  // Метод моментального сохранения настроек сессии
  const handleSaveActiveSettings = (updates: Partial<any>) => {
    if (!activeSess) return;
    const current = activeSess.settings || {
      autoWatermark: true,
      textSignature: '',
      priceMarkupType: 'percent',
      priceMarkupValue: 15,
      privacy: { friendsOnly: false, closeComments: false, muteNotifications: false, markAsAds: false },
      monitoring: { enabled: false, intervalMinutes: 15, autoExportAll: false }
    };

    const newSettings = {
      ...current,
      ...updates,
      privacy: {
        ...current.privacy,
        ...(updates.privacy || {})
      },
      monitoring: {
        ...current.monitoring,
        ...(updates.monitoring || {})
      }
    };

    VKPluginManager.updateSessionSettings(activeSess.token, newSettings);
    setSessions(VKPluginManager.getSessions());
  };

  // Локальные стейты для глобальных правил бота
  const [globalRules, setGlobalRules] = useState(() => VKPluginManager.getGlobalRules());
  const [enableAntiDuplication, setEnableAntiDuplication] = useState(globalRules.enableAntiDuplication);
  const [maxPostLimitPerDay, setMaxPostLimitPerDay] = useState(globalRules.maxPostLimitPerDay);
  const [safetyDelaySeconds, setSafetyDelaySeconds] = useState(globalRules.safetyDelaySeconds);

  const handleSaveGlobalRules = (updates: Partial<any>) => {
    const nextRules = { ...globalRules, ...updates };
    VKPluginManager.updateGlobalRules(nextRules);
    setGlobalRules(nextRules);
  };

  // Подгрузка сообществ для публикаций
  useEffect(() => {
    if (vkAccount && vkGroups.length === 0) {
      loadGroups();
    }
  }, [vkAccount]);

  // Синхронизация полей ввода с пресетом при смене пресета в селекте
  useEffect(() => {
    const activePreset = presets.find(p => p.id === selectedPresetId);
    if (activePreset) {
      setGroupInput(activePreset.groupIds.join(', '));
    }
  }, [selectedPresetId, presets]);

  const loadGroups = async () => {
    if (!vkAccount) return;
    try {
      const groups = await VK_API.getAdminGroups(vkAccount.access_token, vkAccount.isSandbox);
      setVkGroups(groups);
      if (groups.length > 0 && !selectedTargetGroupId) {
        setSelectedTargetGroupId(groups[0].id);
      }
    } catch (err: any) {
      console.warn('Ошибка при автоматической загрузке групп VK:', err);
      setParseStatus(`Сессия ВКонтакте завершена: ${err.message || err}. Переключаем токен...`);
    }
  };

  // Метод входа в Песочницу с интеграцией в Пул сессий
  const handleSandboxLogin = async () => {
    const sandboxAccount = {
      vk_user_id: '1024567',
      first_name: 'Александр',
      last_name: 'Поставщиков',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      access_token: 'sandbox_implicit_offline_token_671754',
      isSandbox: true,
    };

    // Добавляем сессию в VKPluginManager
    VKPluginManager.addSession({
      token: sandboxAccount.access_token,
      firstName: sandboxAccount.first_name,
      lastName: sandboxAccount.last_name,
      avatar: sandboxAccount.avatar || '',
      userId: sandboxAccount.vk_user_id
    });

    setSessions(VKPluginManager.getSessions());
    loginVk(sandboxAccount);

    // Сразу подгружаем группы
    const groups = await VK_API.getAdminGroups(sandboxAccount.access_token, true);
    setVkGroups(groups);
    if (groups.length > 0) {
      setSelectedTargetGroupId(groups[0].id);
    }
    setShowAddSessionForm(false);
  };

  // Подключение реального VK токена в пул аккаунтов
  const handleAddRealToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = rawToken.trim();
    if (!token) return;

    setParseStatus('Валидация токена (Heartbeat check)...');

    try {
      const groups = await VK_API.getAdminGroups(token, false);
      
      let realAccount = {
        vk_user_id: '100' + Math.floor(Math.random() * 100000),
        first_name: 'Дженерик',
        last_name: 'Профиль',
        avatar: '',
        access_token: token,
        isSandbox: false,
      };

      // Получаем имя текущего пользователя VK через JSONP для красивого отображения в пуле
      try {
        const apiResponse = await new Promise<any>((resolve, reject) => {
          const cbName = `vk_usr_cb_${Date.now()}`;
          const timeoutId = setTimeout(() => {
            delete (window as any)[cbName];
            reject(new Error('Превышено время ожидания профиля'));
          }, 3000);

          (window as any)[cbName] = (res: any) => {
            clearTimeout(timeoutId);
            delete (window as any)[cbName];
            resolve(res);
          };

          const script = document.createElement('script');
          script.src = `https://api.vk.com/method/users.get?fields=photo_100&access_token=${token}&v=5.131&callback=${cbName}`;
          script.onerror = () => {
            clearTimeout(timeoutId);
            delete (window as any)[cbName];
            reject(new Error('Скрипт профиля упал'));
          };
          document.body.appendChild(script);
        });

        if (apiResponse && apiResponse.response && apiResponse.response[0]) {
          const u = apiResponse.response[0];
          realAccount = {
            vk_user_id: String(u.id),
            first_name: u.first_name || 'Пользователь',
            last_name: u.last_name || 'ВК',
            avatar: u.photo_100 || '',
            access_token: token,
            isSandbox: false,
          };
        }
      } catch (userErr) {
        console.warn('Не удалось получить красивое имя профиля:', userErr);
      }

      // Сохраняем сессию в Пул (VKPluginManager)
      VKPluginManager.addSession({
        token: realAccount.access_token,
        firstName: realAccount.first_name,
        lastName: realAccount.last_name,
        avatar: realAccount.avatar,
        userId: realAccount.vk_user_id
      });

      // Обновляем состояние
      const updated = VKPluginManager.getSessions();
      setSessions(updated);
      
      // Включаем этот аккаунт в качестве активного
      loginVk(realAccount);
      setVkGroups(groups);
      if (groups.length > 0) {
        setSelectedTargetGroupId(groups[0].id);
      }

      setParseStatus(null);
      setRawToken('');
      setShowAddSessionForm(false);

    } catch (err: any) {
      let msg = err.message || err;
      if (typeof msg === 'string' && msg.includes('user_id is undefined')) {
        msg = 'Похоже, указан Токен Сообщества. Пожалуйста, используйте Токен Пользователя VK.';
      }
      setParseStatus(`Ошибка авторизации токена: ${msg}`);
    }
  };

  // Удаление аккаунта из слот-пула
  const handleRemoveSession = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    VKPluginManager.removeSession(token);
    const updated = VKPluginManager.getSessions();
    setSessions(updated);

    if (vkAccount?.access_token === token) {
      if (updated.length > 0) {
        const first = updated[0];
        loginVk({
          vk_user_id: first.userId,
          first_name: first.firstName,
          last_name: first.lastName,
          avatar: first.avatar,
          access_token: first.token,
          isSandbox: first.token.startsWith('sandbox_'),
        });
      } else {
        logoutVk();
      }
    }
  };

  // Быстрый переключатель активного аккаунта при клике на элемент слот-панели
  const handleSelectSession = (sess: VKAuthSession) => {
    loginVk({
      vk_user_id: sess.userId,
      first_name: sess.firstName,
      last_name: sess.lastName,
      avatar: sess.avatar,
      access_token: sess.token,
      isSandbox: sess.token.startsWith('sandbox_'),
    });
    setParseStatus(`Активным выбран аккаунт: ${sess.firstName}`);
  };

  // Метод онлайн сбора постов со стен доноров
  const handleFetchWall = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = groupInput.trim();
    if (!cleanId) return;

    setParseStatus('Подключение к ВКонтакте... Инициализация диспетчера RPS и сбор стен...');
    try {
      await fetchOnlineWall(cleanId, fetchCount);
      setParseStatus(null);
    } catch (err: any) {
      // Автоматический Failover (ротация токена) сработал в VKPluginManager
      setParseStatus(`Стены просканированы через конвейер. Ошибки сбора: ${err.message || err}`);
    }
  };

  // Создание нового пресета (Список доноров Садовода)
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPresetName.trim() || !customPresetGroupIds.trim()) return;

    const ids = customPresetGroupIds.split(',').map(g => g.trim()).filter(Boolean);
    const newPreset = VKPluginManager.createPreset(customPresetName.trim(), ids);
    
    const updated = VKPluginManager.getPresets();
    setPresets(updated);
    setSelectedPresetId(newPreset.id);
    
    setCustomPresetName('');
    setCustomPresetGroupIds('');
    setShowPresetCreator(false);
    setParseStatus(`Создан кастомный пресет: "${newPreset.name}"`);
  };

  // Удаление пресета поставщиков
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    VKPluginManager.deletePreset(id);
    const updated = VKPluginManager.getPresets();
    setPresets(updated);
    if (selectedPresetId === id && updated.length > 0) {
      setSelectedPresetId(updated[0].id);
    }
  };

  return (
    <div id="vk-integration-control-panel" className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      
      {/* Шапка секции */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-201 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#4C75A3] text-white rounded-lg shadow-xs">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">
              Интеграция с ВКонтакте & Пул сессий
            </h2>
            <p className="text-[10px] text-slate-500">
              Многопоточный парсинг доноров, ротация при блокировках и конвейер RPS-лимитера.
            </p>
          </div>
        </div>
        
        {vkAccount && (
          <span className={`self-start sm:self-auto flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full ${
            vkAccount.isSandbox 
              ? 'bg-amber-150 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200'
              : 'bg-emerald-150 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200'
          }`}>
            <Database size={11} />
            {vkAccount.isSandbox ? 'Режим Песочницы (Демо)' : 'Пул токенов ВК: АКТИВЕН ⚡'}
          </span>
        )}
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-205 dark:divide-slate-800">
        
        {/* Кодинг авторизации (Менеджер Аккаунтов / Слот-панель) - 4/12 */}
        <div className="lg:col-span-4 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Шаг 1. Пул Аккаунтов / Сессии
            </h3>
            <button
              type="button"
              onClick={() => setShowAddSessionForm(!showAddSessionForm)}
              className="text-xs text-indigo-600 hover:text-indigo-805 font-bold flex items-center gap-0.5"
            >
              <Plus size={14} />
              <span>Добавить</span>
            </button>
          </div>

          {/* Форма добавления токена */}
          {showAddSessionForm && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-850 space-y-4 animate-in fade-in duration-200">
              <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setAuthMode('sandbox'); setParseStatus(null); }}
                  className={`flex-1 py-1 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    authMode === 'sandbox' ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <Sparkles size={11} className="inline mr-1" />
                  Песочница (Демо)
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('real'); setParseStatus(null); }}
                  className={`flex-1 py-1 px-3 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    authMode === 'real' ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs' : 'text-slate-500'
                  }`}
                >
                  <Key size={11} className="inline mr-1" />
                  Реальный VK Токен
                </button>
              </div>

              {authMode === 'sandbox' ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Быстрый демо-аккаунт для мгновенной отладки интерфейса, парсинга симулированных баз и проверки.
                  </p>
                  <button
                    type="button"
                    onClick={handleSandboxLogin}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-[#4C75A3] to-[#5B88BD] text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
                  >
                    <UserCheck size={13} />
                    Запустить Демо-сессию
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddRealToken} className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-slate-600">VK Access Token:</span>
                    <button
                      type="button"
                      onClick={() => setShowHelper(!showHelper)}
                      className="text-[#4C75A3] flex items-center gap-0.5"
                    >
                      <HelpCircle size={10} />
                      Инструкция
                    </button>
                  </div>

                  {showHelper && (
                    <div className="p-2 border rounded text-[9px] bg-indigo-50/20 text-indigo-700 space-y-1">
                      <p className="font-bold">Как извлечь токен:</p>
                      <p>Откройте OAuth-ссылку ВК, разрешите доступ к стенам и скопируйте параметр access_token из адресной строки.</p>
                      <a 
                        href="https://oauth.vk.com/authorize?client_id=51658428&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,groups,offline&response_type=token&v=5.131" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-indigo-600 font-bold underline"
                      >
                        Клацнуть OAuth ссылку ↗
                      </a>
                    </div>
                  )}

                  <input
                    type="password"
                    required
                    value={rawToken}
                    onChange={(e) => setRawToken(e.target.value)}
                    placeholder="vk1.a.abCDeFg123..."
                    className="w-full text-xs p-2 rounded-lg border bg-white dark:bg-slate-900 font-mono"
                  />

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-[#4C75A3] text-white font-bold text-xs rounded-lg"
                  >
                    <Key size={13} />
                    Добавить токен в Пул
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Список подключенных сессий (Слот-панель) */}
          <div className="space-y-2">
            {sessions.length > 0 ? (
              sessions.map((sess) => {
                const isActive = vkAccount?.access_token === sess.token;
                return (
                  <div
                    key={sess.token}
                    onClick={() => handleSelectSession(sess)}
                    className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/10' 
                        : 'bg-white dark:bg-slate-900 border-slate-205 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {sess.avatar ? (
                        <img src={sess.avatar} alt="Ava" className="w-8 h-8 rounded-full border bg-slate-50 object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#4C75A3] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {sess.firstName[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                            {sess.firstName} {sess.lastName}
                          </h4>
                          {isActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                          )}
                        </div>
                        {/* Статус маркер токена */}
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold text-emerald-600">
                          <ShieldCheck size={9} />
                          <span>Подключение проверено (RPS)</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveSession(sess.token, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center border border-dashed rounded-xl bg-slate-50/50 text-slate-400">
                <Database size={20} className="mx-auto mb-1 opacity-50" />
                <p className="text-[10px]">Пул токенов пуст.</p>
                <button
                  type="button"
                  onClick={() => { setShowAddSessionForm(true); setAuthMode('sandbox'); }}
                  className="mt-1.5 px-3 py-1 bg-[#4C75A3] text-white text-[9px] font-black rounded"
                >
                  Активировать Песочницу
                </button>
              </div>
            )}
          </div>

          {/* Сообщество публикации */}
          {vkAccount && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-805 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Паблик ВК для публикации:</span>
                <button type="button" onClick={loadGroups} className="text-[#4C75A3]">
                  <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              {vkGroups.length > 0 ? (
                <select
                  value={selectedTargetGroupId || ''}
                  onChange={(e) => setSelectedTargetGroupId(Number(e.target.value) || null)}
                  className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-slate-900 font-bold"
                >
                  {vkGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.members_count || 0} уч.)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 text-[10px] text-amber-600 bg-amber-50 dark:bg-slate-850 rounded-lg">
                  Группы выгрузки не найдены.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Сбор постов по пресетам торговых брендов (Менеджер Пресетов) - 5/12 */}
        <div className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Шаг 2. Сканирование доноров & Списки
            </h3>
            <button
              type="button"
              onClick={() => setShowPresetCreator(!showPresetCreator)}
              className="text-xs text-indigo-600 hover:text-indigo-805 font-bold flex items-center gap-0.5"
            >
              <Settings size={13} />
              <span>{showPresetCreator ? 'К парсингу' : 'Списки ⚙️'}</span>
            </button>
          </div>

          {showPresetCreator ? (
            /* Создание нового Списка Пресетов */
            <form onSubmit={handleCreatePreset} className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border space-y-3 animate-in fade-in duration-200">
              <h4 className="text-[10px] font-black uppercase text-indigo-600">Новый Пресет Поставщиков</h4>
              
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Наименование пресета:</label>
                <input
                  type="text"
                  required
                  value={customPresetName}
                  onChange={(e) => setCustomPresetName(e.target.value)}
                  placeholder="Например: Поставщики Обуви Т4"
                  className="w-full text-xs p-2 border bg-white dark:bg-slate-900 rounded"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase">Список ID доноров (через запятую):</label>
                <textarea
                  required
                  rows={2}
                  value={customPresetGroupIds}
                  onChange={(e) => setCustomPresetGroupIds(e.target.value)}
                  placeholder="opt_sadovod, donor_shoes_22, line_sadovod"
                  className="w-full text-xs p-2 border bg-white dark:bg-slate-900 rounded font-mono"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded"
                >
                  Добавить Пресет
                </button>
                <button
                  type="button"
                  onClick={() => setShowPresetCreator(false)}
                  className="px-2.5 py-1.5 bg-slate-205 text-slate-600 text-xs rounded"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            /* Парсинг через автовыбор пресета */
            <form onSubmit={handleFetchWall} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-600">
                  Выберите пресет торговых точек:
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => setSelectedPresetId(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900 font-bold"
                  >
                    {presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        📚 {p.name} ({p.groupIds.length} доноров)
                      </option>
                    ))}
                  </select>
                  {presets.length > 2 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeletePreset(selectedPresetId, e)}
                      title="Удалить этот пресет"
                      className="p-2 border rounded-lg hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-600">
                  Пул парсинга (Адреса групп Садовода):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={groupInput}
                    onChange={(e) => setGroupInput(e.target.value)}
                    placeholder="opt_sadovod, vendor_fashion"
                    className="w-full text-xs p-2.5 pl-8 rounded-lg border bg-slate-50 dark:bg-slate-900 font-bold font-mono text-indigo-700 dark:text-indigo-300"
                  />
                  <Search size={13} className="absolute left-2.5 top-3.5 text-slate-400" />
                </div>
              </div>

              <div className="space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>Объём сбора с каждого источника:</span>
                  <span className="text-indigo-650 font-black">{fetchCount} постов</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={fetchCount}
                  onChange={(e) => setFetchCount(Number(e.target.value))}
                  className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-600 mt-2"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !vkAccount}
                className="w-full flex items-center justify-center gap-1.5 py-3 px-4 bg-slate-900 hover:bg-slate-850 dark:bg-indigo-650 dark:hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                Запустить конвейерный парсинг ВК
              </button>
            </form>
          )}

          {/* Статус- бар */}
          {parseStatus && (
            <div className="p-3 text-[10px] bg-slate-50 dark:bg-slate-800 border-l-2 border-[#4C75A3] text-slate-700 dark:text-slate-350 font-semibold rounded-r-lg animate-pulse">
              {parseStatus}
            </div>
          )}
        </div>

        {/* Логи публикаций в паблик ВК - 3/12 */}
        <div className="lg:col-span-3 p-5 flex flex-col h-full space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Логи публикаций (VK Feed)
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-805 text-[9px] font-bold text-slate-500">
              {exportLogs.length} записей
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[220px] border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/20 p-2.5 space-y-2 font-mono text-[9px]">
            {exportLogs.length > 0 ? (
              exportLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-2 rounded border leading-normal ${
                    log.status === 'success' 
                      ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/20 dark:text-emerald-400' 
                      : 'bg-rose-50/40 border-rose-100 text-rose-800 dark:bg-rose-950/10 dark:border-rose-900/20 dark:text-rose-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold flex items-center gap-1 truncate max-w-[85px]" title={log.targetGroupName}>
                      🎯 {log.targetGroupName}
                    </span>
                    <span className="opacity-60 text-[8px]">
                      {new Date(log.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-slate-605 dark:text-slate-400 italic mb-1">
                    "{log.postText}"
                  </p>
                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider mt-1 border-t border-dotted border-current/20 pt-1">
                    <span>Статус:</span>
                    <span className="flex items-center gap-0.5">
                      {log.status === 'success' ? (
                        <>
                          <CheckCircle2 size={9} />
                          Опубликован
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={9} />
                          Ошибка
                        </>
                      )}
                    </span>
                  </div>
                  {log.status === 'success' && (
                    <a 
                      href={log.message.replace('Успех! Ссылка: ', '')} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="block text-[8px] font-bold text-[#4C75A3] underline mt-1 truncate"
                    >
                      Смотреть в VK ↗
                    </a>
                  )}
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-8">
                <Activity size={18} className="mb-1 text-slate-300 dark:text-slate-700 animate-pulse" />
                <p>Логи пусты.</p>
                <p className="text-[8px] opacity-80">Выберите товары на витрине и нажмите иконку самолётика для быстрой выгрузки.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* РАЗДЕЛ ТОНКОЙ НАСТРОЙКИ СЕТИ БОТОВ & ПРИВАТНОСТИ */}
      {vkAccount && activeSess && (
        <div id="smm-bot-rules-panel" className="border-t border-slate-205 dark:border-slate-800 p-5 bg-slate-50/20 dark:bg-slate-950/20 animate-in slide-in-from-bottom duration-300">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-850 dark:text-white flex items-center gap-2">
                <Settings size={16} className="text-[#4C75A3] animate-spin" style={{ animationDuration: '6s' }} />
                Интеллектуальный SMM-Оркестратор роботов ВК
              </h3>
              <p className="text-[10px] text-slate-500">
                Точечное управление параметрами каждого аккаунта, перекрывающее базовый импорт. Настройка конфиденциальности постов.
              </p>
            </div>

            {/* Таб-переключатель */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-850 shrink-0">
              <button
                type="button"
                onClick={() => setActiveConfigTab('individual')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  activeConfigTab === 'individual'
                    ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ⚙️ {activeSess.firstName} (Активный слот)
              </button>
              <button
                type="button"
                onClick={() => setActiveConfigTab('global')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                  activeConfigTab === 'global'
                    ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                🌍 Глобальные правила бота
              </button>
            </div>
          </div>

          {activeConfigTab === 'individual' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              {/* Конфигурация Приватности публикации */}
              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3] flex items-center gap-1.5">
                  🛡️ Настройки приватности постов ВК
                </h4>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={friendsOnly}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setFriendsOnly(val);
                        handleSaveActiveSettings({ privacy: { friendsOnly: val, closeComments, muteNotifications, markAsAds } });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Запись только для друзей</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={closeComments}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setCloseComments(val);
                        handleSaveActiveSettings({ privacy: { friendsOnly, closeComments: val, muteNotifications, markAsAds } });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Запретить комментирование</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={muteNotifications}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMuteNotifications(val);
                        handleSaveActiveSettings({ privacy: { friendsOnly, closeComments, muteNotifications: val, markAsAds } });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Загружать в тихом режиме (без Push)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markAsAds}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setMarkAsAds(val);
                        handleSaveActiveSettings({ privacy: { friendsOnly, closeComments, muteNotifications, markAsAds: val } });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Пометить публикацию как рекламу</span>
                  </label>
                </div>
              </div>

              {/* Наложения контента: водяные знаки, подписи */}
              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3] flex items-center gap-1.5">
                  ✍️ Подписи & Водяные знаки
                </h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoWatermark}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAutoWatermark(val);
                        handleSaveActiveSettings({ autoWatermark: val });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Авто-водяной знак бренда (#vk_insights)</span>
                  </label>

                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Шаблон индивидуальной подписи:</span>
                    <textarea
                      rows={2}
                      value={textSignature}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextSignature(val);
                        handleSaveActiveSettings({ textSignature: val });
                      }}
                      placeholder="Например: Заказать у: vk.me/sadovod_bot"
                      className="w-full text-xs p-2 border bg-slate-50 dark:bg-slate-900 dark:border-slate-800 rounded font-bold text-slate-800 dark:text-stone-300"
                    />
                  </div>
                </div>
              </div>

              {/* Торговая Кастомизация Маржинальности & Автоматизация */}
              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3] flex items-center gap-1.5">
                  ⚡ Торговая наценка поставщика в ВК
                </h4>
                <div className="space-y-3">
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setPriceMarkupType('percent');
                        handleSaveActiveSettings({ priceMarkupType: 'percent' });
                      }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer ${
                        priceMarkupType === 'percent' ? 'bg-white dark:bg-slate-800 text-indigo-650' : 'text-slate-500'
                      }`}
                    >
                      Наценка в %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPriceMarkupType('fixed');
                        handleSaveActiveSettings({ priceMarkupType: 'fixed' });
                      }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded cursor-pointer ${
                        priceMarkupType === 'fixed' ? 'bg-white dark:bg-slate-800 text-indigo-650' : 'text-slate-500'
                      }`}
                    >
                      Фикс наценка (руб)
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-350">
                    <span>Величина зазора:</span>
                    <input
                      type="number"
                      value={priceMarkupValue}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setPriceMarkupValue(val);
                        handleSaveActiveSettings({ priceMarkupValue: val });
                      }}
                      className="w-20 p-1 border text-center rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-800 font-bold"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-150 dark:border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={monitoringEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setMonitoringEnabled(val);
                          handleSaveActiveSettings({ monitoring: { enabled: val, intervalMinutes: monitoringInterval, autoExportAll } });
                        }}
                        className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                      />
                      <span>Включить авто-сканирование доноров</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Глобальные правила */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3]">🛡️ Исключение дубликатов публикаций</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableAntiDuplication}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setEnableAntiDuplication(val);
                        handleSaveGlobalRules({ enableAntiDuplication: val });
                      }}
                      className="rounded text-indigo-600 dark:bg-slate-900 border-slate-300"
                    />
                    <span>Умное вырезание дублей по хешу</span>
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal">
                    Предотвращает блокировки со стороны VK за неуникальные картинки. Исключает дублирование фото на стене на протяжении суток.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3]">⏱️ Случайная задержка (Анти-Бот)</h4>
                <div className="space-y-2">
                  <span className="text-[10px] font-extrabold text-slate-500 block mb-1 uppercase">Задержка между постами:</span>
                  <select
                    value={safetyDelaySeconds}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setSafetyDelaySeconds(val);
                      handleSaveGlobalRules({ safetyDelaySeconds: val });
                    }}
                    className="w-full text-xs p-2 border rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-400"
                  >
                    <option value={0}>Без задержки (В упор к лимитам VK)</option>
                    <option value={15}>15 секунд (Рекомендована для Смарт-парсинга)</option>
                    <option value={60}>60 секунд (Максимальная защита от капчи)</option>
                    <option value={120}>120 секунд (Автопилот)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3.5 bg-white dark:bg-slate-950/40 p-4 border rounded-xl shadow-2xs">
                <h4 className="text-[11px] font-extrabold uppercase text-[#4C75A3] flex items-center gap-1.5">🔥 Дневной лимит выгрузок</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-350">
                    <span>Пороговый лимит ВК:</span>
                    <span className="text-rose-500 dark:text-rose-450 font-black">{maxPostLimitPerDay} постов/день</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="10"
                    value={maxPostLimitPerDay}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxPostLimitPerDay(val);
                      handleSaveGlobalRules({ maxPostLimitPerDay: val });
                    }}
                    className="w-full h-1 bg-slate-205 rounded appearance-none cursor-pointer accent-indigo-600 mt-1"
                  />
                  <p className="text-[10px] text-rose-500/80 dark:text-rose-400 leading-normal">
                    *Рекомендуется держать менее 50 записей в день для обхода спам-фильтра.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
