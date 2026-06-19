/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Heart, 
  MessageSquare, 
  Calendar, 
  ExternalLink, 
  Trash2
} from "lucide-react";
import { Product } from "../types";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { ProductPriceEditor } from "./ProductPriceEditor";
import { ProductTextEditor } from "./ProductTextEditor";
import { ProductMetaBar } from "./ProductMetaBar";

interface ProductCardProps {
  product: Product;
  onUpdate: (updatedProduct: Product) => void;
  onOpenLightbox: (images: string[], index: number) => void;
  onDelete: (productId: string) => void;
  viewMode?: "grid" | "list";
}

export const ProductCard = React.memo(function ProductCard({
  product,
  onUpdate,
  onOpenLightbox,
  onDelete,
  viewMode = "list",
}: ProductCardProps) {
  
  // Переключатели быстрой отметки в галерее
  const handleToggleSelect = () => {
    onUpdate({
      ...product,
      selected: !product.selected
    });
  };

  const handleToggleStar = () => {
    onUpdate({
      ...product,
      starred: !product.starred
    });
  };

  // Валидация общей измененности товара для плашки «Правка»
  const checkIfSizesDiffer = (cur: string[], orig: string[]) => {
    if (!cur || !orig) return true;
    if (cur.length !== orig.length) return true;
    const sortedCur = [...cur].sort();
    const sortedOrig = [...orig].sort();
    return !sortedCur.every((val, index) => val === sortedOrig[index]);
  };

  const checkIfCurrentlyModified = (
    priceVal: number,
    sizesList: string[],
    descVal: string,
    origTextVal: string
  ): boolean => {
    const isPriceChanged = priceVal !== product.original_price;
    const areSizesChanged = checkIfSizesDiffer(sizesList, product.sizes_original || []);
    
    const origDesc = product.original_description ?? product.description ?? "";
    const isDescChanged = descVal.trim() !== origDesc.trim();

    const origText = product.original_text_original ?? product.original_text ?? "";
    const isTextChanged = origTextVal.trim() !== origText.trim();

    return isPriceChanged || areSizesChanged || isDescChanged || isTextChanged;
  };

  // Метод сохранения цены
  const handleSavePrice = (newPrice: number) => {
    const isModified = checkIfCurrentlyModified(
      newPrice,
      product.sizes || [],
      product.description || "",
      product.original_text || ""
    );
    onUpdate({
      ...product,
      price: newPrice,
      is_modified: isModified
    });
  };

  // Метод сохранения кураторского описания
  const handleSaveDesc = (newDesc: string) => {
    const isModified = checkIfCurrentlyModified(
      product.price,
      product.sizes || [],
      newDesc,
      product.original_text || ""
    );
    onUpdate({
      ...product,
      description: newDesc,
      is_modified: isModified
    });
  };

  // Метод сохранения оригинального текста парсера
  const handleSaveOriginalText = (newText: string) => {
    const isModified = checkIfCurrentlyModified(
      product.price,
      product.sizes || [],
      product.description || "",
      newText
    );
    onUpdate({
      ...product,
      original_text: newText,
      is_modified: isModified
    });
  };

  // Метод сохранения размерного ряда
  const handleUpdateSizes = (newSizes: string[]) => {
    const isModified = checkIfCurrentlyModified(
      product.price,
      newSizes,
      product.description || "",
      product.original_text || ""
    );
    onUpdate({
      ...product,
      sizes: newSizes,
      is_modified: isModified
    });
  };

  // Метод сохранения кураторских тегов
  const handleUpdateTags = (newTags: string[]) => {
    onUpdate({
      ...product,
      tags: newTags
    });
  };

  const resolvedImages = product.images && product.images.length > 0 
    ? product.images 
    : [product.main_image].filter(Boolean) as string[];

  // ----------------------------------------------------
  // GRID LAYOUT
  // ----------------------------------------------------
  if (viewMode === "grid") {
    return (
      <div
        id={`product-card-${product.product_id}`}
        className={`relative bg-white border rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full text-left ${
          product.selected ? "border-stone-800 ring-1 ring-stone-800/20" : "border-stone-200"
        }`}
      >
        {/* Медиа-галерея для Grid */}
        <ProductMediaGallery
          productId={product.product_id}
          images={resolvedImages}
          mainImage={product.main_image}
          selected={product.selected}
          starred={product.starred}
          isModified={product.is_modified}
          onToggleSelect={handleToggleSelect}
          onToggleStar={handleToggleStar}
          onOpenLightbox={onOpenLightbox}
          viewMode="grid"
        />

        {/* Сводка инфо о товаре */}
        <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
          <div className="space-y-1.5">
            {/* Группа / дата */}
            <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
              <span className="bg-stone-105 bg-stone-100 text-stone-705 text-stone-700 font-bold px-1.5 py-0.5 rounded border border-stone-200 tracking-wide uppercase truncate max-w-[120px]">
                {product.group_products || "Разное"}
              </span>
              <span>{product.date ? product.date.split(",")[0] : "нет даты"}</span>
            </div>

            {/* Цены и тренды */}
            <ProductPriceEditor
              price={product.price}
              originalPrice={product.original_price}
              onSavePrice={handleSavePrice}
              viewMode="grid"
            />

            {/* Описание (разворачиваемое в 2 строки) */}
            <ProductTextEditor
              productId={product.product_id}
              description={product.description}
              onSaveDesc={handleSaveDesc}
              onSaveOriginalText={handleSaveOriginalText}
              viewMode="grid"
            />
          </div>

          {/* Полоса метаданных (размеры + теги) */}
          <ProductMetaBar
            productId={product.product_id}
            sizes={product.sizes || []}
            sizesOriginal={product.sizes_original || []}
            tags={product.tags || []}
            onUpdateSizes={handleUpdateSizes}
            onUpdateTags={handleUpdateTags}
            viewMode="grid"
          />

          {/* Футер карточки в сетке */}
          <div className="flex items-center justify-between pt-1.5 text-[10px] font-mono text-stone-400 border-t border-stone-100/50">
            <div className="flex items-center gap-2 select-none">
              <span className="flex items-center gap-0.5" title="Лайки">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-50" /> {product.likes_count ?? 0}
              </span>
              <span className="flex items-center gap-0.5" title="Комментарии">
                <MessageSquare className="w-3 h-3" /> {product.comments_count ?? 0}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {product.source_url && (
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-400 hover:text-stone-800 p-0.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => onDelete(product.product_id)}
                className="text-stone-400 hover:text-red-600 p-0.5 transition-colors cursor-pointer border-0 bg-transparent"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // LIST LAYOUT
  // ----------------------------------------------------
  return (
    <div
      id={`product-card-${product.product_id}`}
      className={`relative bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 grid grid-cols-1 md:grid-cols-4 text-left ${
        product.selected ? "border-stone-800 ring-1 ring-stone-800/20" : "border-stone-200"
      }`}
    >
      {/* Медиа-галерея для List */}
      <ProductMediaGallery
        productId={product.product_id}
        images={resolvedImages}
        mainImage={product.main_image}
        selected={product.selected}
        starred={product.starred}
        isModified={product.is_modified}
        onToggleSelect={handleToggleSelect}
        onToggleStar={handleToggleStar}
        onOpenLightbox={onOpenLightbox}
        viewMode="list"
      />

      <div className="md:col-span-3 p-5 flex flex-col justify-between gap-5 col-span-1 text-left">
        <div>
          {/* Верхняя модераторская панелька */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 mb-4 select-none">
            <div className="flex items-center gap-2">
              <span className="bg-stone-200 text-stone-800 text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-stone-300">
                {product.group_products || "Разное"}
              </span>
              <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {product.date || "нет даты"}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {product.source_url && (
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-400 hover:text-stone-800 p-1.5 rounded-md hover:bg-stone-50 transition-colors"
                  title="Ссылка-источник"
                >
                  <ExternalLink className="w-4.5 h-4.5" />
                </a>
              )}
              <button
                id={`delete-btn-${product.product_id}`}
                onClick={() => onDelete(product.product_id)}
                className="text-stone-400 hover:text-red-650 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer border-0 bg-transparent"
                title="Удалить карточку"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Текстовый редактор для списочного режима */}
            <div className="lg:col-span-2">
              <ProductTextEditor
                productId={product.product_id}
                description={product.description}
                originalText={product.original_text}
                onSaveDesc={handleSaveDesc}
                onSaveOriginalText={handleSaveOriginalText}
                viewMode="list"
              />
            </div>

            {/* Редактор цены для списочного режима */}
            <div className="lg:border-l lg:border-stone-100 lg:pl-5">
              <ProductPriceEditor
                price={product.price}
                originalPrice={product.original_price}
                onSavePrice={handleSavePrice}
                viewMode="list"
              />
            </div>
          </div>
        </div>

        {/* Размерная сетка и система тегов */}
        <ProductMetaBar
          productId={product.product_id}
          sizes={product.sizes || []}
          sizesOriginal={product.sizes_original || []}
          tags={product.tags || []}
          onUpdateSizes={handleUpdateSizes}
          onUpdateTags={handleUpdateTags}
          viewMode="list"
        />
      </div>
    </div>
  );
});

export default ProductCard;
