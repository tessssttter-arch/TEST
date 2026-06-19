import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://vintage-archive.com', // Замените на ваш домен
  output: 'static'
});
