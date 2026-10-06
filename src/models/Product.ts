import mongoose, { Model, Schema } from "mongoose";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  quantity: number;
  description: string | null;
  image_url: string | null;
  image_public_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ProductInput = Pick<Product, "name" | "category" | "price" | "quantity"> &
  Partial<Pick<Product, "description" | "image_url" | "image_public_id">>;
export interface ProductFields extends Omit<Product, "id"> {}

const productSchema = new Schema<ProductFields>({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  category: { type: String, required: true, trim: true, maxlength: 100 },
  price: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0, min: 0 },
  description: { type: String, default: null },
  image_url: { type: String, default: null },
  image_public_id: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

export const ProductModel: Model<ProductFields> = mongoose.models.Product as Model<ProductFields> ||
  mongoose.model<ProductFields>("Product", productSchema);
