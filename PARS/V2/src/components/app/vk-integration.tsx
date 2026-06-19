/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Компонент интеграции и авторизации ВКонтакте (VK Integration & Auth Panel).
// Поддерживает мгновенный демонстрационный режим (Sandbox) и полноценный режим реального VK API.
// Все комментарии написаны на русском языке.

import React, { useState, useEffect } from 'react';
import { usePostsStore } from '../../hooks/use-posts-store';
import { VK_API, VKGroup } from '../../lib/vk-api-client';
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
  Database
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

  // Локальные состояния формы авторизации
  const [authMode, setAuthMode] = useState<'sandbox' | 'real'>('sandbox');
  const [rawToken, setRawToken] = useState<string>('');
  const [showHelper, setShowHelper] = useState<boolean>(false);

  // Состояния для парсинга стены напрямую
  const [groupInput, setGroupInput] = useState<string>('opt_sadovod');
  const [fetchCount, setFetchCount] = useState<number>(30);
  const [parseStatus, setParseStatus] = useState<string | null>(null);

  // При первой загрузке, пре-подгружаем группы если вошли в систему и список пуст
  useEffect(() => {
    if (vkAccount && vkGroups.length === 0) {
      loadGroups();
    }
  }, [vkAccount]);

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
      if (!vkAccount.isSandbox) {
        // Если личный токен не действителен, деликатно разлогиниваем,
        // чтобы предотвратить постоянные ошибки в консоли на каждый чих приложения
        setParseStatus(`Сессия ВКонтакте завершена: ${err.message || err}. Пожалуйста, войдите снова.`);
        logoutVk();
      }
    }
  };

  const handleSandboxLogin = async () => {
    const sandboxAccount = {
      vk_user_id: '1024567',
      first_name: 'Александр',
      last_name: 'Поставщиков',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      access_token: 'sandbox_implicit_offline_token_671754',
      isSandbox: true,
    };
    loginVk(sandboxAccount);
    // Сразу подгружаем группы
    const groups = await VK_API.getAdminGroups(sandboxAccount.access_token, true);
    setVkGroups(groups);
    if (groups.length > 0) {
      setSelectedTargetGroupId(groups[0].id);
    }
  };

  const handleRealLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = rawToken.trim();
    if (!token) return;

    setParseStatus('Проверка токена и загрузка профиля...');

    try {
      // 1. Пытаемся получить сообщества, где пользователь админ. Если вызов упадет - токен точно невалидный.
      // Это делает ровно один вызов к getAdminGroups, исключая дублирование в catch блоках.
      const groups = await VK_API.getAdminGroups(token, false);
      
      // 2. Инициируем дефолтные значения аккаунта на случай, если users.get заблокирован или упадет
      let realAccount = {
        vk_user_id: 'unknown',
        first_name: 'Аккаунт',
        last_name: 'Связанный',
        avatar: '',
        access_token: token,
        isSandbox: false,
      };

      // 3. Пытаемся получить имя пользователя через users.get JSONP
      try {
        const apiResponse = await new Promise<any>((resolve, reject) => {
          const cbName = `vk_usr_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const timeoutId = setTimeout(() => {
            delete (window as any)[cbName];
            reject(new Error('Превышено время ожидания профиля пользователя'));
          }, 4000);

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
            reject(new Error('Скрипт профиля не смог загрузиться'));
          };
          document.body.appendChild(script);
        });

        if (apiResponse && apiResponse.response && apiResponse.response[0]) {
          const u = apiResponse.response[0];
          realAccount = {
            vk_user_id: String(u.id),
            first_name: u.first_name || 'Пользователь',
            last_name: u.last_name || '',
            avatar: u.photo_100 || '',
            access_token: token,
            isSandbox: false,
          };
        }
      } catch (userErr: any) {
        console.warn('Не удалось получить детальный профиль пользователя VK (используем дефолтные имена):', userErr);
      }

      // Сохраняем успешную сессию
      loginVk(realAccount);
      setVkGroups(groups);
      if (groups.length > 0) {
        setSelectedTargetGroupId(groups[0].id);
      }
      setParseStatus(null);
      setRawToken('');

    } catch (err: any) {
      console.warn('Ошибка авторизации VK:', err);
      // Обогащаем ошибку user_id is undefined понятной подсказкой на русском языке
      let userFriendlyMessage = err.message || err;
      if (typeof userFriendlyMessage === 'string' && userFriendlyMessage.includes('user_id is undefined')) {
        userFriendlyMessage = 'Неверный тип токена. Похоже, Вы указали Токен Сообщества вместо Токена Пользователя. Пожалуйста, используйте VK OAuth Flow для личного токена.';
      }
      setParseStatus(`Ошибка авторизации: ${userFriendlyMessage}`);
    }
  };

  const handleFetchWall = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = groupInput.trim();
    if (!cleanId) return;

    setParseStatus('Подключение к ВКонтакте...');
    try {
      await fetchOnlineWall(cleanId, fetchCount);
      setParseStatus(null);
    } catch (err: any) {
      setParseStatus(`Ошибка парсинга: ${err.message || err}`);
    }
  };

  return (
    <div id="vk-integration-control-panel" className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      
      {/* Шапка секции */}
      <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-205 dark:border-slate-800 p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#4C75A3] text-white rounded-lg">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">
              Интеграция с ВКонтакте
            </h2>
            <p className="text-[10px] text-slate-500">
              Управление связью с API, автоматический живой парсинг и обратная выгрузка товаров.
            </p>
          </div>
        </div>
        
        {vkAccount && (
          <span className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full ${
            vkAccount.isSandbox 
              ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
              : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
          }`}>
            <Database size={11} />
            {vkAccount.isSandbox ? 'Режим Песочницы (Демо)' : 'Живое подключение'}
          </span>
        )}
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-205 dark:divide-slate-800">
        
        {/* Кодинг авторизации (колонка 1 - 5/12) */}
        <div className="lg:col-span-5 p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Шаг 1. Авторизация аккаунта
          </h3>

          {!vkAccount ? (
            <div className="space-y-4">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setAuthMode('sandbox'); setParseStatus(null); }}
                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    authMode === 'sandbox'
                      ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                >
                  <Sparkles size={12} className="inline mr-1" />
                  Песочница (Демо)
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('real'); setParseStatus(null); }}
                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    authMode === 'real'
                      ? 'bg-white dark:bg-slate-900 text-[#4C75A3] shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                  }`}
                >
                  <Key size={12} className="inline mr-1" />
                  Мой VK Токен
                </button>
              </div>

              {authMode === 'sandbox' ? (
                <div className="space-y-3.5 pt-1">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal">
                    Идеально для тестирования! Авторизуйтесь под демонстрационным аккаунтом. Вам мгновенно откроется весь функционал: парсинг четырех торговых точек Садовода и симуляция публикации товаров.
                  </p>
                  <button
                    type="button"
                    onClick={handleSandboxLogin}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[#4C75A3] to-[#5B88BD] hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <UserCheck size={15} />
                    Войти в Песочницу за 1 клик
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRealLogin} className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Введите Ваш VK Access Token:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowHelper(!showHelper)}
                      className="text-[10px] text-slate-400 hover:text-[#4C75A3] flex items-center gap-0.5 cursor-pointer"
                    >
                      <HelpCircle size={11} />
                      Как получить?
                    </button>
                  </div>

                  {showHelper && (
                    <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 text-[10px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                      <p className="font-semibold text-slate-800 dark:text-indigo-400">Инструкция по получению токена:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>
                          Перейдите по ссылке авторизации{' '}
                          <a 
                            href="https://oauth.vk.com/authorize?client_id=51658428&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=wall,photos,groups,offline&response_type=token&v=5.131" 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-blue-500 underline font-bold"
                          >
                            VK OAuth Flow
                          </a>.
                        </li>
                        <li>Разрешите доступ к стене и группам.</li>
                        <li>Скопируйте длинную строку <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">access_token=...</code> из адресной строки открывшейся страницы и вставьте сюда.</li>
                      </ol>
                    </div>
                  )}

                  <input
                    type="password"
                    required
                    value={rawToken}
                    onChange={(e) => setRawToken(e.target.value)}
                    placeholder="vk1.a.abCDeFg12345..."
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-[#4C75A3] font-mono"
                  />

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-[#4C75A3] hover:bg-[#3f638c] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
                  >
                    <Key size={13} />
                    Подключить по Токену
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Профиль подключенного аккаунта */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-205 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {vkAccount.avatar ? (
                    <img src={vkAccount.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-255 shadow-xs bg-slate-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-300 dark:bg-slate-800 text-xs font-bold text-slate-650 dark:text-slate-400 flex items-center justify-center">
                      {vkAccount.first_name[0]}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                      {vkAccount.first_name} {vkAccount.last_name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono">
                      ID: {vkAccount.vk_user_id}
                    </p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={logoutVk}
                  title="Выйти из аккаунта VK"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                </button>
              </div>

              {/* Выбор целевого сообщества публикации */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                  <span>Выгружать товары в группу:</span>
                  <button 
                    type="button"
                    onClick={loadGroups} 
                    title="Обновить список групп"
                    className="text-slate-400 hover:text-[#4C75A3] cursor-pointer"
                  >
                    <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </label>
                
                {vkGroups.length > 0 ? (
                  <select
                    value={selectedTargetGroupId || ''}
                    onChange={(e) => setSelectedTargetGroupId(Number(e.target.value) || null)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-[#4C75A3] font-semibold"
                  >
                    {vkGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} {group.members_count ? `(${group.members_count.toLocaleString()} уч.)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 text-[10px] text-amber-600 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 rounded-lg">
                    🚫 Не найдено сообществ, где Вы администратор. Измените настройки разрешений токена.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Статус- бар ошибок или успехов */}
          {parseStatus && (
            <div className="p-3 text-[10px] bg-slate-50 dark:bg-slate-800 border-l-2 border-[#4C75A3] text-slate-750 dark:text-slate-300 font-semibold animate-in fade-in duration-200 rounded-r-lg">
              {parseStatus}
            </div>
          )}
        </div>

        {/* Парсинг живых стен напрямую из ВК (колонка 2 - 4/12) */}
        <div className="lg:col-span-4 p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Шаг 2. Парсинг напрямую из VK
          </h3>

          <form onSubmit={handleFetchWall} className="space-y-4">
            <p className="text-[11px] text-slate-500 leading-normal">
              Введите домен или ID группы поставщика поставщиков Садовода, чтобы загрузить свежие посты.
            </p>

            {vkAccount?.isSandbox && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 space-y-1.5">
                <span className="text-[9px] font-bold text-[#4C75A3] uppercase tracking-wider block">Пресеты Песочницы:</span>
                <div className="flex flex-wrap gap-1">
                  <button 
                    type="button" 
                    onClick={() => setGroupInput('opt_sadovod')} 
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all cursor-pointer ${groupInput === 'opt_sadovod' ? 'bg-[#4C75A3] text-white border-transparent' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-205'}`}
                  >
                    Одежда 👗
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setGroupInput('shoes_wholesale')} 
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all cursor-pointer ${groupInput === 'shoes_wholesale' ? 'bg-[#4C75A3] text-white border-transparent' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-205'}`}
                  >
                    Обувь 👟
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setGroupInput('luxury_elegance')} 
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all cursor-pointer ${groupInput === 'luxury_elegance' ? 'bg-[#4C75A3] text-white border-transparent' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-205'}`}
                  >
                    Костюмы 👑
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setGroupInput('vip_jackets')} 
                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all cursor-pointer ${groupInput === 'vip_jackets' ? 'bg-[#4C75A3] text-white border-transparent' : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-205'}`}
                  >
                    Куртки 🧥
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">ID стены сообщества:</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  placeholder="Например: opt_sadovod"
                  className="w-full text-xs p-2.5 pl-8 rounded-lg border border-slate-205 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-[#4C75A3] font-bold"
                />
                <Search size={13} className="absolute left-2.5 top-3 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-605 dark:text-slate-400">
                <span>Кол-во записей:</span>
                <span className="text-[#4C75A3]">{fetchCount} шт</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={fetchCount}
                onChange={(e) => setFetchCount(Number(e.target.value))}
                className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#4C75A3]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !vkAccount}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-900 hover:bg-slate-850 dark:bg-indigo-600 dark:hover:bg-indigo-505 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              Запустить парсинг VK
            </button>
          </form>
        </div>

        {/* Логи истории экспорта (колонка 3 - 3/12) */}
        <div className="lg:col-span-3 p-5 flex flex-col h-full space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Логи публикаций
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-500">
              {exportLogs.length} записей
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[190px] border border-slate-205 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-905/30 p-2.5 space-y-2 font-mono text-[9px]">
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
                  <p className="line-clamp-2 text-slate-600 dark:text-slate-350 italic mb-1">
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
                <Activity size={18} className="mb-1 text-slate-300 dark:text-slate-700" />
                <p>Нет логов за текущую сессию.</p>
                <p className="text-[8px] opacity-80">Выберите товары из таблицы и нажмите "Опубликовать в VK".</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
