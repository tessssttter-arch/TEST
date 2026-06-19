/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { catalogAPI } from '../services/catalog-db';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  constructor(props: Props) {
    super(props);
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Обновляем состояние для рендеринга резервного UI при следующем проходе
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Необработанная ошибка приложения:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetDB = async () => {
    if (confirm('Внимание! Это действие полностью очистит локальную IndexedDB базу данных и сбросит все кураторские правки. Вы уверены?')) {
      try {
        await catalogAPI.clear();
        localStorage.clear();
        window.location.href = window.location.pathname; // Сброс URL параметров и перезагрузка
      } catch (err) {
        console.error('Ошибка очистки БД во время восстановления:', err);
        alert('Не удалось автоматически очистить БД. Закройте вкладку и попробуйте снова.');
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div id="crash-screen-wrapper" className="min-h-screen bg-stone-50 flex items-center justify-center p-6 select-none">
          <div id="crash-screen" className="bg-white border border-stone-200 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto text-2xl">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2 text-left">
              <h2 className="text-base font-bold text-stone-900 font-sans text-center">Произошла непредвиденная ошибка</h2>
              <p className="text-xs text-stone-500 leading-relaxed font-sans text-center">
                Интерфейс не смог отобразить данные. Возможной причиной является конфликт схемы IndexedDB или ошибка рендеринга состояния.
              </p>
              
              {this.state.error && (
                <div className="bg-stone-50 border border-stone-150 rounded-xl p-3 mt-3 overflow-auto max-h-36">
                  <p className="text-[10px] font-mono text-rose-600 font-semibold leading-relaxed">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="text-[9px] font-mono text-stone-400 mt-2 whitespace-pre-wrap leading-normal">
                      {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto h-11 px-5 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Перезагрузить страницу</span>
              </button>

              <button
                onClick={this.handleResetDB}
                className="w-full sm:w-auto h-11 px-5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Сбросить и очистить БД</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
