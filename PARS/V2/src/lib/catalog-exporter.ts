/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// [AI-EDIT] Исправление типов каталога под текущую модель VKPost | 2026-06-16 | Не атомарные поля sizes

import { VKPost } from '../types/vk';

export interface CatalogProduct {
  product_id: string;
  title: string;
  price: number;
  original_price?: number | null;
  main_image: string;
  images: string[];
  original_text: string;
  description: string;
  source_url: string;
  group_products: string[];
  sizes: string[];
  sizes_original: string[];
  date?: string;
  photos_count?: number;
  comments_count?: number;
  likes_count?: number;
  starred?: boolean;
  selected?: boolean;
  is_modified?: boolean;
  tags?: string[];
}

export const mapVkPostToCatalogProduct = (post: VKPost): CatalogProduct => {
  const isModified = post.text_edited !== post.text_original || post.price_edited !== post.price_original;

  const sizes: string[] = [];
  const sizesOriginal: string[] = [];

  const title = post.text_edited
    ? post.text_edited.split('\n')[0].substring(0, 100) + (post.text_edited.length > 100 ? '...' : '')
    : post.text_original.split('\n')[0].substring(0, 100) + (post.text_original.length > 100 ? '...' : '');

  const price = post.price_edited ?? post.price_original ?? 0;
  const images = post.images.map((img) => img.url);
  const mainImage = images.length > 0 ? images[0] : '';

  return {
    product_id: `vk_${post.owner_id}_${post.id}`,
    title,
    price,
    original_price: post.price_original,
    main_image: mainImage,
    images,
    original_text: post.text_original,
    description: post.text_edited || post.text_original,
    source_url: post.source_url,
    group_products: ['vk_parsed'],
    sizes,
    sizes_original: sizesOriginal,
    date: post.date_formatted,
    photos_count: post.images.length,
    comments_count: post.comments,
    likes_count: post.likes,
    starred: post.is_favorite,
    selected: false,
    is_modified: isModified,
    tags: post.hashtags || [],
  };
};

export const exportPostsToCatalogJson = (posts: VKPost[], filename = 'catalog_import.json') => {
  const products = posts.map(mapVkPostToCatalogProduct);
  const dataStr = JSON.stringify(products, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
