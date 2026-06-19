/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Главный входной компонент приложения. Оборачивает интерфейс в PostsStoreProvider.
// Все комментарии написаны на русском языке.

import React from 'react';
import { PostsStoreProvider } from './hooks/use-posts-store';
import { VkAnalyzer } from './components/app/vk-analyzer';

export default function App() {
  return (
    <PostsStoreProvider>
      <VkAnalyzer />
    </PostsStoreProvider>
  );
}
