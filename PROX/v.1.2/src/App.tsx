import React, { useState, useEffect, useMemo } from 'react';
import { 
  Server, KeyRound, AlertCircle, Copy, Download, RefreshCw, 
  Trash2, Plus, Users, Shield, Search, Database,
  Check, Settings, X, Activity, Cpu
} from 'lucide-react';

interface Account {
  alias: string;
  token: string;
}

interface GroupResult {
  token_alias: string;
  token: string;
  status: 'success' | 'error';
  error_message?: string;
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
  profile: {
    bandwidth_limit: number;
    bandwidth_used: number;
    plan_name?: string | null;
    plan_price?: number | null;
    plan_currency?: string;
    auto_prolong?: boolean;
    next_billing_date?: string | null;
    latency_ms?: number;
    last_updated?: string;
  } | null;
  proxies: any[];
}

interface AggregatedSummary {
  total_proxies: number;
  total_valid: number;
  total_invalid: number;
  total_bandwidth_used: number;
  total_bandwidth_limit: number;
}

export default function App() {
  // Accounts state (persisted in localStorage)
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('webshare_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse accounts from localStorage', e);
      }
    }
    return [
      { alias: "Основной пул", token: "" }
    ];
  });

  // Track accounts changes and save to localStorage
  useEffect(() => {
    localStorage.setItem('webshare_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // UI state
  const [activeTab, setActiveTab] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<{ summary: AggregatedSummary; groups: GroupResult[] } | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  // Multi-Token Management form modals/inputs
  const [showTokenMgr, setShowTokenMgr] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [newToken, setNewToken] = useState('');
  const [bulkTokensInput, setBulkTokensInput] = useState('');

  // Rotation panel states
  const [showRotationPanel, setShowRotationPanel] = useState<string | null>(null); // holds alias of active token
  const [rotateUser, setRotateUser] = useState('');
  const [rotatePass, setRotatePass] = useState('');
  const [isRotating, setIsRotating] = useState(false);
  const [rotationMsg, setRotationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Success indicator for copy actions
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // [AI-EDIT] История bandwidth для прогноза исчерпания | 2026-06-17
  const [bwHistory, setBwHistory] = useState<Record<string, { ts: number; used: number; limit: number }[]>>(() => {
    const saved = localStorage.getItem('webshare_bw_history');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('webshare_bw_history', JSON.stringify(bwHistory));
  }, [bwHistory]);
  // [AI-END]

  // Trigger load on mounting if we have stored accounts with actual tokens
  useEffect(() => {
    const validTokens = accounts.filter(a => a.token.trim() !== '');
    if (validTokens.length > 0) {
      loadBulkData();
    }
  }, []);

  const loadBulkData = async () => {
    const validAccounts = accounts.filter(a => a.token.trim() !== '');
    if (validAccounts.length === 0) {
      setResultsData(null);
      setError('Нет активных токенов для загрузки. Пожалуйста, добавьте ваши Webshare API токены.');
      return;
    }

    setLoading(true);
    setError(null);
    const start = Date.now();

    try {
      const response = await fetch('/api/proxy/fetch-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: validAccounts })
      });

      if (!response.ok) {
        throw new Error(`Внутренняя ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      setResultsData(data);

      // [AI-EDIT] Сохраняем срезы bandwidth в историю | 2026-06-17
      setBwHistory(prev => {
        const next: Record<string, { ts: number; used: number; limit: number }[]> = { ...prev };
        (data.groups || []).forEach((g: any) => {
          if (g.status === 'success' && g.profile) {
            const prevArr = next[g.token_alias] || [];
            next[g.token_alias] = [...prevArr.slice(-4), {
              ts: Date.now(),
              used: g.profile.bandwidth_used,
              limit: g.profile.bandwidth_limit
            }];
          }
        });
        return next;
      });
      // [AI-END]

      setLatency(Date.now() - start);
      setError(null);
    } catch (err: any) {
      setError(`Ошибка загрузки данных: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Process Add single account
  const handleAddAccount = () => {
    if (!newAlias.trim() || !newToken.trim()) {
      alert('Пожалуйста, введите и Имя, и Токен.');
      return;
    }
    const updated = [...accounts, { alias: newAlias.trim(), token: newToken.trim() }];
    setAccounts(updated);
    setNewAlias('');
    setNewToken('');
  };

  // Process Bulk import
  const handleBulkImport = () => {
    if (!bulkTokensInput.trim()) {
      alert('Данные не введены.');
      return;
    }
    
    const lines = bulkTokensInput.split('\n');
    const parsedAccounts: Account[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      const parts = trimmed.split(':');
      if (parts.length >= 2) {
        const alias = parts[0].trim();
        const tokenVal = parts.slice(1).join(':').trim();
        parsedAccounts.push({ alias, token: tokenVal });
      } else {
        parsedAccounts.push({ alias: `Куратор ${parsedAccounts.length + accounts.length + 1}`, token: trimmed });
      }
    });

    if (parsedAccounts.length > 0) {
      setAccounts([...accounts, ...parsedAccounts]);
      setBulkTokensInput('');
      alert(`Успешно импортировано ${parsedAccounts.length} аккаунтов!`);
    } else {
      alert('Не удалось распарсить строки.');
    }
  };

  // Process delete single account
  const handleDeleteAccount = (index: number) => {
    if (confirm('Удалить эту учетную запись?')) {
      const updated = [...accounts];
      updated.splice(index, 1);
      setAccounts(updated);
      if (activeTab !== 'all' && !updated.find(a => a.token === activeTab)) {
        setActiveTab('all');
      }
    }
  };

  // Proxies computation depending on selected tab
  const activeProxies = useMemo(() => {
    if (!resultsData) return [];

    if (activeTab === 'all') {
      return resultsData.groups.flatMap(g => g.proxies.map(p => ({ ...p, account_alias: g.token_alias })));
    } else {
      const found = resultsData.groups.find(g => g.token === activeTab);
      return found ? found.proxies.map(p => ({ ...p, account_alias: found.token_alias })) : [];
    }
  }, [resultsData, activeTab]);

  // Formatting helper for individual proxies
  const formatProxyRow = (p: any) => {
    const port = p.ports ? p.ports.http : '80';
    return `${p.proxy_address}:${port}:${p.username}:${p.password}`;
  };

  // Raw text export compilation
  const rawExportText = useMemo(() => {
    if (activeProxies.length === 0) return '';
    return activeProxies
      .filter((p: any) => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'valid' ? p.valid : !p.valid;
      })
      .map(p => formatProxyRow(p))
      .join('\n');
  }, [activeProxies, statusFilter]);

  // Filter and Search results for interactive list table
  const filteredTableProxies = useMemo(() => {
    return activeProxies
      .filter((p: any) => {
        const matchesSearch = p.proxy_address.includes(searchQuery) || 
          p.country_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.username?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' 
          ? true 
          : statusFilter === 'valid' ? p.valid : !p.valid;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => Number(b.valid) - Number(a.valid));
  }, [activeProxies, searchQuery, statusFilter]);

  // Individual row copy action
  const copyRow = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  // Global list copy action
  const copyAllText = () => {
    if (!rawExportText) return;
    navigator.clipboard.writeText(rawExportText).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }).catch(err => {
      console.error('Failed to copy list:', err);
    });
  };

  // Download export as TXT
  const downloadTxt = () => {
    if (!rawExportText) return;
    const blob = new Blob([rawExportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `webshare_pool_${activeTab === 'all' ? 'combined' : 'selected'}_${new Date().toISOString().slice(0,10)}.txt`;
    anchor.href = url;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // Rotate configuration credentials handler
  const handleUpdateConfigCredentials = async (accToken: string, accAlias: string) => {
    if (!rotateUser.trim() || !rotatePass.trim()) {
      setRotationMsg({ type: 'error', text: 'Заполните оба поля!' });
      return;
    }

    setIsRotating(true);
    setRotationMsg(null);

    try {
      const response = await fetch('/api/proxy/update-credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accToken,
          username: rotateUser.trim(),
          password: rotatePass.trim()
        })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.error || 'Ошибка при обновлении учетных данных');
      }

      setRotationMsg({ type: 'success', text: `Доступы для «${accAlias}» успешно обновлены!` });
      setRotateUser('');
      setRotatePass('');
      
      setTimeout(() => {
        loadBulkData();
      }, 1000);
    } catch (err: any) {
      setRotationMsg({ type: 'error', text: `Ошибка: ${err.message}` });
    } finally {
      setIsRotating(false);
    }
  };

  // On-demand IP replacement trigger
  const handleRequestIpReplacement = async (accToken: string, accAlias: string) => {
    if (!confirm(`Вы действительно хотите инициировать ротацию (замену) всех адресов для: ${accAlias}?`)) {
      return;
    }

    setIsRotating(true);
    setRotationMsg(null);

    try {
      const response = await fetch('/api/proxy/replace-ips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accToken,
          replacement_all: true
        })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.error || 'Ошибка при замене IP');
      }

      setRotationMsg({ type: 'success', text: `Запрос на полную ротацию IP для «${accAlias}» успешно отослан!` });
      
      setTimeout(() => {
        loadBulkData();
      }, 1500);
    } catch (err: any) {
      setRotationMsg({ type: 'error', text: `Ошибка: ${err.message}` });
    } finally {
      setIsRotating(false);
    }
  };

  // Convert bytes size to human format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 GB';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const val = bytes / (k * k * k);
    return `${val.toFixed(dm)} GB`;
  };

  // [AI-EDIT] Оценка дней до исчерпания трафика по каждому токену | 2026-06-17
  const getDaysRemaining = (alias: string): number | null => {
    const hist = bwHistory[alias];
    if (!hist || hist.length < 2) return null;

    const latest = hist[hist.length - 1];
    const prev = hist[0];
    const usedDelta = latest.used - prev.used;
    const timeDeltaHours = (latest.ts - prev.ts) / (1000 * 60 * 60);

    if (timeDeltaHours <= 0 || usedDelta <= 0) {
      return latest.limit - latest.used <= 0 ? 0 : null;
    }

    const hourlyRate = usedDelta / timeDeltaHours;
    const remaining = latest.limit - latest.used;

    if (hourlyRate <= 0 || remaining <= 0) {
      return remaining <= 0 ? 0 : null;
    }

    return +(remaining / (hourlyRate * 24)).toFixed(1);
  };
  // [AI-END]

  // [AI-EDIT] Скорость расхода трафика (GB/день) | 2026-06-17
  const getConsumptionRate = (alias: string): string | null => {
    const hist = bwHistory[alias];
    if (!hist || hist.length < 2) return null;

    const latest = hist[hist.length - 1];
    const prev = hist[0];
    const usedDelta = latest.used - prev.used;
    const timeDeltaHours = (latest.ts - prev.ts) / (1000 * 60 * 60);

    if (timeDeltaHours <= 0 || usedDelta <= 0) return null;
    const gbPerDay = (usedDelta / (1024 * 1024 * 1024) / timeDeltaHours) * 24;
    return `${gbPerDay.toFixed(2)} GB/д`;
  };
  // [AI-END]

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-[#E0E0E0] font-sans overflow-hidden py-0">
      
      {/* GLOBAL HEADER */}
      <header className="h-[70px] flex items-center justify-between px-6 border-b border-[#111115] bg-[#0A0A0C] shrink-0 z-40 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.355)] relative overflow-hidden">
            <span className="font-bold text-white text-sm relative z-10 font-mono tracking-tighter">WS</span>
            <div className="absolute inset-0 bg-white/10 filter blur-xs"></div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white uppercase font-mono">Webshare Multi-Token Control</h1>
              <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono uppercase">v1.1.2 PRO</span>
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Enterprise Proxy Deployment Console</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowTokenMgr(true)}
            className="bg-[#111] hover:bg-[#1A1A22] text-gray-300 text-xs py-2 px-4 rounded-lg flex items-center gap-2 border border-[#222] transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-gray-500 animate-pulse" />
            <span>Управление токенами</span>
          </button>

          <button 
            onClick={loadBulkData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.45)] cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'ЗАГРУЗКА...' : 'ОБНОВИТЬ ВСЕ'}</span>
          </button>
        </div>
      </header>

      {/* SYSTEM ERRORS FLASHLIGHT */}
      {error && (
        <div className="absolute top-[80px] right-6 bg-rose-950/25 border border-rose-500/30 p-4 rounded-lg z-50 w-96 max-w-[calc(100vw-3rem)] shadow-2xl backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[11px] font-bold text-rose-500 uppercase font-mono tracking-wider">SYSTEM WARNING</h4>
              <p className="text-[10px] text-rose-300/80 leading-normal mt-1 pr-4">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => setError(null)}
            className="absolute top-2 right-2 text-rose-500/50 hover:text-rose-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MAIN WORKSPACE GRID */}
      <div className="flex-1 flex overflow-hidden min-h-0 bg-[#060608]">
        
        {/* SIDEBAR: ACTIVE ACCOUNT GROUPS & METRICS */}
        <aside className="w-[300px] bg-[#0A0A0C] border-r border-[#111115] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          
          <div className="p-4 border-b border-[#111115] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Глобальная статистика</span>
              <Activity className="w-3.5 h-3.5 text-gray-500" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#111] p-2.5 rounded border border-[#191922] flex flex-col justify-between">
                <span className="text-[9px] text-gray-500 uppercase">IP всего</span>
                <span className="text-xl font-bold font-mono text-white mt-1">
                  {resultsData ? resultsData.summary.total_proxies : 0}
                </span>
              </div>
              <div className="bg-[#111] p-2.5 rounded border border-[#191922] flex flex-col justify-between">
                <span className="text-[9px] text-emerald-500/80 uppercase">ЖИВЫХ (OK)</span>
                <span className="text-xl font-bold font-mono text-emerald-500 mt-1">
                  {resultsData ? resultsData.summary.total_valid : 0}
                </span>
              </div>
              <div className="bg-[#111] p-2.5 rounded border border-[#191922] flex flex-col justify-between">
                <span className="text-[9px] text-rose-500/80 uppercase font-mono">Ошибки (ERR)</span>
                <span className="text-xl font-bold font-mono text-rose-500 mt-1">
                  {resultsData ? resultsData.summary.total_invalid : 0}
                </span>
              </div>
              <div className="bg-[#111] p-2.5 rounded border border-[#191922] flex flex-col justify-between">
                <span className="text-[9px] text-blue-400/80 uppercase">Успешность</span>
                <span className="text-xl font-bold font-mono text-blue-400 mt-1">
                  {resultsData && resultsData.summary.total_proxies > 0
                    ? `${Math.round((resultsData.summary.total_valid / resultsData.summary.total_proxies) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {resultsData && resultsData.summary.total_bandwidth_limit > 0 && (
              <div className="bg-[#111] p-3 rounded border border-[#191922] space-y-2">
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-gray-500 uppercase">ОБЩИЙ ТРАФИК:</span>
                  <span className="text-zinc-300 font-bold">
                    {formatBytes(resultsData.summary.total_bandwidth_used)} / {formatBytes(resultsData.summary.total_bandwidth_limit)}
                  </span>
                </div>
                <div className="w-full bg-[#222] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (resultsData.summary.total_bandwidth_used / resultsData.summary.total_bandwidth_limit) * 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 space-y-3">
            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono block mb-2">Группы токенов</span>

            <button
              onClick={() => setActiveTab('all')}
              className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'all'
                  ? 'bg-blue-600/10 border-blue-600 text-white shadow-sm'
                  : 'bg-[#0E0E12] border-[#181822] text-gray-400 hover:text-white hover:border-[#2C2C3F]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold">Все токены разом</span>
              </div>
              <span className="text-[10px] bg-[#1a1a24] text-gray-300 px-2 py-0.5 rounded border border-[#2c2c3e] font-mono">
                {resultsData ? resultsData.summary.total_proxies : 0} IP
              </span>
            </button>

            <div className="space-y-2 pt-1 border-t border-[#111115]">
              {resultsData ? (
                resultsData.groups.map((group, idx) => (
                  <div key={idx} className="group relative">
                    <button
                      onClick={() => setActiveTab(group.token)}
                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex flex-col ${
                        activeTab === group.token
                          ? 'bg-[#111118]/70 border-blue-600 text-white'
                          : 'bg-[#08080C] border-[#15151F] text-gray-400 hover:text-white hover:border-[#2C2C3F]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs font-medium truncate max-w-[150px]">{group.token_alias}</span>
                        </div>
                        {group.status === 'success' ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        ) : (
                          <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2.5 w-full text-[10px] font-mono text-gray-500">
                        <span>
                          {group.stats.valid} / {group.stats.total} VALID
                        </span>
                        <span>
                          {group.profile ? `${formatBytes(group.profile.bandwidth_used, 1)} / ${formatBytes(group.profile.bandwidth_limit, 1)}` : '0 GB'}
                        </span>
                      </div>
                      {(group.profile && (group.profile.plan_name || group.profile.next_billing_date)) && (
                        <div className="text-[9px] font-mono text-gray-500 mt-0.5">
                          {group.profile.plan_name && <span>{group.profile.plan_name}</span>}
                          {group.profile.plan_price && (
                            <span className="ml-1">— {group.profile.plan_price} {group.profile.plan_currency || '$'}/mo</span>
                          )}
                          {group.profile.next_billing_date && (
                            <span className="text-gray-600 ml-1">| {new Date(group.profile.next_billing_date).toLocaleDateString('ru')}</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-1 w-full text-[9px] font-mono text-gray-600">
                        <span>
                          {group.latency_ms !== undefined ? `${group.latency_ms}ms` : ''}
                        </span>
                        <span>
                          {group.last_updated ? new Date(group.last_updated).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 w-full text-[9px] font-mono">
                        <span className="text-blue-500">{getConsumptionRate(group.token_alias) || '\u00A0'}</span>
                        {(() => {
                          const days = getDaysRemaining(group.token_alias);
                          return days !== null ? (
                            <span className={`${days < 3 ? 'text-rose-400' : days < 7 ? 'text-amber-400' : 'text-gray-500'}`}>≈ {days}д</span>
                          ) : null;
                        })()}
                      </div>
                    </button>

                    {group.status === 'success' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowRotationPanel(showRotationPanel === group.token_alias ? null : group.token_alias);
                        }}
                        title="Управление ротацией"
                        className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 bg-[#1A1A24] border border-[#2d2d3e] hover:border-indigo-500 text-gray-400 hover:text-indigo-400 p-1 rounded transition-all cursor-pointer z-20"
                      >
                        <Shield className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                accounts.map((acc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-[#08080C] border border-[#15151F] rounded-lg text-xs text-gray-500">
                    <span className="truncate max-w-[150px] font-mono">{acc.alias}</span>
                    <span className="text-[10px] text-gray-600 italic">Ожидает загрузки</span>
                  </div>
                ))
              )}
            </div>

          </div>
        </aside>

        {/* WORKSPACE RIGHT PANEL */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* IF ROTATION CONTROL BOX IS VISIBLE */}
          {showRotationPanel && (
            (() => {
              const targetAcc = accounts.find(a => a.alias === showRotationPanel);
              if (!targetAcc) return null;

              return (
                <div className="bg-[#0D0D13] p-4 border-b border-[#1C1C29] relative z-30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                        Ротация доступов & Смена IP: <span className="text-indigo-400 font-sans">{showRotationPanel}</span>
                      </h3>
                    </div>
                    <button 
                      onClick={() => {
                        setShowRotationPanel(null);
                        setRotationMsg(null);
                      }} 
                      className="text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Change user/pass */}
                    <div className="bg-black/20 p-3 rounded border border-[#1C1C29] space-y-3">
                      <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">1. Смена логина и пароля прокси</h4>
                        <p className="text-[9px] text-gray-500 leading-normal mt-0.5">Это обновит логин/пароль для текущей пачки IP-адресов.</p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          type="text" 
                          value={rotateUser}
                          onChange={e => setRotateUser(e.target.value)}
                          placeholder="Новый Логин"
                          className="bg-[#111118] border border-[#232332] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono w-full"
                        />
                        <input 
                          type="text" 
                          value={rotatePass}
                          onChange={e => setRotatePass(e.target.value)}
                          placeholder="Новый Пароль"
                          className="bg-[#111118] border border-[#232332] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono w-full"
                        />
                        <button
                          onClick={() => handleUpdateConfigCredentials(targetAcc.token, targetAcc.alias)}
                          disabled={isRotating}
                          className="bg-[#2D2D3E] hover:bg-indigo-600 disabled:opacity-50 text-white text-[10px] font-bold px-4 py-1.5 rounded transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Обновить Креденшалы
                        </button>
                      </div>
                    </div>

                    {/* Right: Trigger full IP replacements */}
                    <div className="bg-black/20 p-3 rounded border border-[#1C1C29] flex flex-col justify-between">
                      <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono font-mono">2. Смена пула адресов (Rotations)</h4>
                        <p className="text-[9px] text-gray-500 leading-normal mt-0.5">Отправит запрос Webshare API для полной замены всех IP на новые (если поддерживается вашим тарифом).</p>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                        <button
                          onClick={() => handleRequestIpReplacement(targetAcc.token, targetAcc.alias)}
                          disabled={isRotating}
                          className="bg-emerald-700/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 font-bold text-[10px] px-4 py-2 rounded transition-colors cursor-pointer w-full uppercase"
                        >
                          Инициировать Замену IP пула
                        </button>
                      </div>
                    </div>
                  </div>

                  {rotationMsg && (
                    <div className={`mt-3 p-2 rounded text-[10px] flex items-center gap-2 ${
                      rotationMsg.type === 'success' ? 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-400' : 'bg-rose-950/20 border border-rose-500/20 text-rose-400'
                    }`}>
                      <span className="font-semibold">{rotationMsg.text}</span>
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* MAIN PROXIES VIEWER CONTAINER */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            
            {/* LEFT SIDE: TABLE */}
            <section className="flex-[2] flex flex-col overflow-hidden border-r border-[#111115]">
              
              <div className="p-4 bg-[#08080A] border-b border-[#111115] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Быстрый поиск по IP, стране..." 
                    className="bg-[#111115] border border-[#1E1E26] rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-300 w-full focus:outline-none focus:border-[#2C2C3F] transition-all placeholder:text-gray-600"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-1 bg-[#111115] p-1 rounded-lg border border-[#1E1E26] text-[10px] shrink-0 font-mono">
                  {(['all', 'valid', 'invalid'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setStatusFilter(type)}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        statusFilter === type 
                          ? 'bg-[#1C1C24] text-white border border-[#2d2d3e] font-bold' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {type === 'all' ? 'ВСЕ' : type === 'valid' ? 'ЖИВЫЕ' : 'ОШИБКИ'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar bg-[#050507]">
                {resultsData === null ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 bg-black/20">
                    <Cpu className="w-10 h-10 text-gray-700 mb-3 animate-pulse" />
                    <p className="text-xs font-mono max-w-sm font-semibold tracking-wide uppercase text-gray-400">Информация не синхронизирована.</p>
                    <p className="text-[10px] text-gray-600 max-w-sm mt-1 leading-normal">
                      Настройте ваши авторизационные API-ключи в панели «Управление токенами», затем нажмите кнопку «ОБНОВИТЬ ВСЕ» для загрузки пулов.
                    </p>
                  </div>
                ) : filteredTableProxies.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-6 text-center text-gray-500">
                    <p className="text-xs font-mono">Прокси не найдены.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="text-[9px] text-gray-500 bg-[#09090C] font-mono tracking-widest uppercase sticky top-0 border-b border-[#111115] z-10">
                      <tr>
                        <th className="p-3.5 font-medium pl-4">Endpoint Address</th>
                        <th className="p-3.5 font-medium">Группа / Токен</th>
                        <th className="p-3.5 font-medium text-center">Протокол</th>
                        <th className="p-3.5 font-medium text-center">Страна</th>
                        <th className="p-3.5 font-medium text-center">Статус</th>
                        <th className="p-3.5 font-medium text-right pr-4">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono divide-y divide-[#101015]">
                      {filteredTableProxies.map((p: any, idx) => {
                        const port = p.ports ? p.ports.http : '80';
                        const fullString = formatProxyRow(p);
                        
                        return (
                          <tr key={idx} className="hover:bg-[#111118]/40 transition-colors group">
                            <td className="p-3.5 pl-4 font-bold text-blue-400 select-all">
                              {p.proxy_address}:{port}
                            </td>

                            <td className="p-3.5 text-indigo-400 font-semibold truncate max-w-[120px]">
                              {p.account_alias || 'Неизвестно'}
                            </td>

                            <td className="p-3.5 text-center text-gray-500">
                              HTTP/SOCKS5
                            </td>

                            <td className="p-3.5 text-center">
                              {p.country_code ? (
                                <span className="bg-[#12121A] border border-[#20202F] px-1.5 py-0.5 rounded text-[10px] text-gray-400 uppercase tracking-widest">
                                  {p.country_code}
                                </span>
                              ) : '—'}
                            </td>

                            <td className="p-3.5 text-center">
                              {p.valid ? (
                                <span className="text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">OK</span>
                              ) : (
                                <span className="text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">FAIL</span>
                              )}
                            </td>

                            <td className="p-3.5 text-right pr-4">
                              <button
                                onClick={() => copyRow(fullString, idx)}
                                title="Скопировать строку (IP:PORT:USER:PASS)"
                                className={`p-1.5 rounded border transition-all cursor-pointer inline-flex items-center justify-center ${
                                  copiedIndex === idx
                                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                                    : 'bg-transparent border-[#1E1E26] text-gray-500 hover:text-white hover:border-[#2C2C3F] opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {copiedIndex === idx ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* RIGHT SIDE: TXT BUFFERS */}
            <section className="w-full lg:w-[320px] bg-[#08080B] flex flex-col overflow-hidden">
              <div className="p-4 bg-[#08080A] border-b border-[#111115] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Буфер экспорта</h3>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">IP:PORT:USER:PASS</p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={copyAllText}
                    title="Скопировать весь список"
                    disabled={!rawExportText}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      copiedAll
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                        : 'bg-[#1C1C23] border-[#2c2c3e] text-gray-300 hover:text-white hover:bg-[#2c2c3c] disabled:opacity-30'
                    }`}
                  >
                    {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  
                  <button 
                    onClick={downloadTxt}
                    title="Скачать файлом .TXT"
                    disabled={!rawExportText}
                    className="p-2 bg-emerald-700/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-30 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 flex flex-col justify-between overflow-hidden">
                <textarea
                  readOnly
                  value={rawExportText}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  placeholder="Здесь появится сгенерированный список прокси для софта..."
                  className="flex-1 w-full bg-black/40 border-none p-4 rounded-lg font-mono text-[10px] text-zinc-400 leading-relaxed overflow-auto custom-scrollbar focus:outline-none resize-none select-all"
                />

                <div className="bg-blue-950/10 border border-blue-500/10 p-3 rounded-lg mt-3 shrink-0">
                  <h4 className="text-[9px] font-bold text-blue-450 uppercase mb-1 font-mono">РЕКОМЕНДАЦИЯ</h4>
                  <p className="text-[9px] text-blue-300/60 leading-normal">
                    Нажмите сочетание Ctrl+A внутри окна буфера, чтобы моментально скопировать выделенный пул.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>

      {/* API TOKENS MANAGER MODAL */}
      {showTokenMgr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0A0A0C] border border-[#1C1C25] rounded-xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
            
            <div className="px-6 py-4 border-b border-[#15151F] bg-[#0E0E14] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-blue-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">Настройка API Ключей (Webshare)</h2>
              </div>
              <button 
                onClick={() => {
                  setShowTokenMgr(false);
                  loadBulkData();
                }}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5 text-xs">
              
              {/* Add Single Token */}
              <div className="bg-black/20 p-4 border border-[#1A1A25] rounded-lg space-y-3">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono block">1. Добавить ключ вручную</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1 font-mono">АЛИАС КУРАТОРА / ИМЯ</label>
                    <input 
                      type="text" 
                      value={newAlias}
                      onChange={e => setNewAlias(e.target.value)}
                      placeholder="Например: Сеть А или Бот №1"
                      className="bg-[#111] border border-[#222] rounded-lg w-full px-3 py-2 text-white placeholder:text-gray-700 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1 font-mono">TOKEN ВЕБШЕРА</label>
                    <input 
                      type="text" 
                      value={newToken}
                      onChange={e => setNewToken(e.target.value)}
                      placeholder="token_value"
                      className="bg-[#111] border border-[#222] rounded-lg w-full px-3 py-2 text-white placeholder:text-gray-700 outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddAccount}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] px-4 py-2 rounded-md tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить в список
                  </button>
                </div>
              </div>

              {/* Bulk import keys */}
              <div className="bg-black/20 p-4 border border-[#1A1A25] rounded-lg space-y-3">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono block">2. Массовый импорт</span>
                  <span className="text-[9px] text-gray-500">Укажите формат <code className="text-indigo-400">Имя_Куратора:Токен</code> (каждая учетная запись с новой строки)</span>
                </div>

                <textarea
                  value={bulkTokensInput}
                  onChange={e => setBulkTokensInput(e.target.value)}
                  placeholder="Бот_Сеть_1:ca562ab...8b27ad&#10;Бот_Сеть_2:e56c12b...ca90ad"
                  className="w-full h-24 bg-[#111] border border-[#222] rounded-lg p-3 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleBulkImport}
                    className="bg-[#2D2D3E] hover:bg-zinc-800 text-white font-bold text-[10px] px-4 py-2 rounded-md tracking-wider uppercase transition-colors cursor-pointer"
                  >
                    Импортировать список
                  </button>
                </div>
              </div>

              {/* Active keys List */}
              <div className="space-y-2">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono block">Список активных ключей ({accounts.length})</span>
                
                <div className="border border-[#1A1A25] rounded-lg overflow-hidden divide-y divide-[#1A1A25]">
                  {accounts.map((acc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-black/10 hover:bg-black/25 transition-colors">
                      <div className="min-w-0 pr-4">
                        <p className="font-bold text-white text-xs select-all">{acc.alias}</p>
                        <p className="font-mono text-[9px] text-gray-500 truncate mt-0.5 select-all max-w-[400px]">
                          {acc.token ? `${acc.token.slice(0, 8)}••••••••••••••••${acc.token.slice(-8)}` : 'Токен отсутствует'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAccount(index)}
                        className="text-gray-500 hover:text-rose-500 p-1.5 rounded transition-colors cursor-pointer"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-[#15151F] bg-[#0E0E14] flex justify-end">
              <button
                onClick={() => {
                  setShowTokenMgr(false);
                  loadBulkData();
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold tracking-wider px-6 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                СОХРАНИТЬ И СИНХРОНИЗИРОВАТЬ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COMPACT FOOTER */}
      <footer className="h-8 bg-[#050505] border-t border-[#111115] flex items-center px-6 justify-between text-[9px] text-gray-600 font-mono shrink-0">
        <div className="flex items-center space-x-2">
          <span>ENVIRONMENT: PRODUCTION</span>
          <span className="text-gray-800">|</span>
          <span className="text-blue-500 font-bold uppercase">Multiclient API v1.1.2</span>
        </div>
        <div className="flex items-center space-x-4">
          {latency !== null && (
            <span>SWEEP LATENCY: {latency}MS</span>
          )}
          <span>UPTIME: 99.98%</span>
          <span className="text-emerald-950 font-bold flex items-center gap-1">
            <span className="h-1.5 w-1.5 bg-emerald-950 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.1)]"></span>
            ALL SYSTEMS SECURED
          </span>
        </div>
      </footer>

    </div>
  );
}
