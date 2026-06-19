/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Перцептивный хэш картинок (Average Hash) и расстояние Хэмминга в браузере

/**
 * Вычисляет Average Hash изображения по его URL с помощью HTML5 Canvas
 */
export function computePHash(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve('0000000000000000');
          return;
        }

        // Рисуем уменьшенное изображение
        ctx.drawImage(img, 0, 0, 8, 8);

        // Получаем пиксели
        const imgData = ctx.getImageData(0, 0, 8, 8);
        const data = imgData.data;

        // Конвертируем в оттенки серого и считаем среднее
        const grays = new Uint8Array(64);
        let sum = 0;
        for (let i = 0; i < 64; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
          grays[i] = gray;
          sum += gray;
        }

        const avg = sum / 64;

        // Строим 64-битный хэш
        let hashBin = '';
        for (let i = 0; i < 64; i++) {
          hashBin += grays[i] >= avg ? '1' : '0';
        }

        // Переводим в HEX (16 символов)
        let hashHex = '';
        for (let i = 0; i < 64; i += 4) {
          const chunk = hashBin.substring(i, i + 4);
          hashHex += parseInt(chunk, 2).toString(16);
        }

        resolve(hashHex.padStart(16, '0'));
      } catch (err) {
        // На случай CORS ограничений, возвращаем простейший хэш на базе URL
        resolve(fallbackHash(imageUrl));
      }
    };

    img.onerror = () => {
      resolve(fallbackHash(imageUrl));
    };

    img.src = imageUrl;
  });
}

function fallbackHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padEnd(16, 'f');
  return hex.substring(0, 16);
}

/**
 * Вычисляет расстояние Хэмминга между двумя HEX хэшами (количество различающихся бит от 0 до 64)
 */
export function hammingDistance(h1: string, h2: string): number {
  if (h1.length !== h2.length) return 64;

  let distance = 0;
  for (let i = 0; i < h1.length; i++) {
    const b1 = parseInt(h1[i], 16);
    const b2 = parseInt(h2[i], 16);
    
    // Битовое исключающее ИЛИ (XOR)
    let xor = b1 ^ b2;
    
    // Подсчет единичных бит
    while (xor > 0) {
      if ((xor & 1) === 1) distance++;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Оценка схожести (процент совпадения от 0 до 100)
 */
export function similarityPercentage(h1: string, h2: string): number {
  const dist = hammingDistance(h1, h2);
  return Math.round(((64 - dist) / 64) * 100);
}
