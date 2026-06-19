/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Главный модуль приложения React. Оборачивает анализатор VK Insights в глобальный Context-провайдер состояния.
// Все комментарии написаны на русском языке.

import { PostsStoreProvider } from './hooks/use-posts-store';
import { VkAnalyzer } from './components/app/vk-analyzer';

export default function App() {
  return (
    <PostsStoreProvider>
      <div id="app-root-container" className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-950 dark:text-slate-100 transition-colors duration-200">
        <main className="w-full">
          <VkAnalyzer />
        </main>
      </div>
    </PostsStoreProvider>
  );
}

