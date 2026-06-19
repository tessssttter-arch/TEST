export interface ProductItem {
  product_id: string;
  price: number;
  description: string;
  sizes: string[];
  main_image: string;
  images: string[];
  group_products: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  selectedSize?: string;
}

export interface UserProfile {
  name: string;
  telegram: string;
  phone?: string;
  address?: string;
}
