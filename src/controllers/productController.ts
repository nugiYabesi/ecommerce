import { Request, Response } from "express";
import { Types } from "mongoose";
import cloudinary from "../config/cloudinary";
import { Product, ProductInput, ProductModel } from "../models/Product";

function toProduct(document: InstanceType<typeof ProductModel>): Product {
  return { id: document._id.toString(), name: document.name, category: document.category,
    price: document.price, quantity: document.quantity, description: document.description,
    image_url: document.image_url, image_public_id: document.image_public_id,
    created_at: document.created_at, updated_at: document.updated_at };
}

function uploadImage(file: Express.Multer.File): Promise<{ url: string; publicId: string }> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return Promise.reject(new Error("Cloudinary is not configured"));
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "ecommerce-products", resource_type: "image" }, (error, result) => {
      if (error || !result) return reject(error || new Error("Image upload failed"));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(file.buffer);
  });
}

async function removeImage(publicId: string): Promise<void> {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary is not configured");
  }
  const result = await cloudinary.uploader.destroy(publicId);
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary image could not be deleted");
  }
}

function parseProductFields(body: Request["body"], partial = false): Partial<ProductInput> | null {
  const fields: Partial<ProductInput> = {};
  for (const key of ["name", "category", "description"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string" || (key !== "description" && !body[key].trim())) return null;
      (fields as Record<string, unknown>)[key] = key === "description" ? body[key] : body[key].trim();
    }
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return null;
    fields.price = String(price);
  }
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) return null;
    fields.quantity = quantity;
  }
  if (!partial && (!fields.name || !fields.category || fields.price === undefined)) return null;
  return fields;
}

function validId(value: string | string[]): string | null {
  if (Array.isArray(value)) return null;
  return Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value) ? value : null;
}

export async function create(request: Request, response: Response): Promise<void> {
  const fields = parseProductFields(request.body);
  if (!fields) {
    response.status(400).json({ message: "Name, category, and a non-negative price are required; quantity must be non-negative" });
    return;
  }

  let image: { url: string; publicId: string } | undefined;
  try {
    if (request.file) image = await uploadImage(request.file);
    const document = await ProductModel.create({
      name: fields.name!, category: fields.category!, price: fields.price!, quantity: fields.quantity ?? 0,
      description: fields.description, image_url: image?.url, image_public_id: image?.publicId,
    });
    const product = toProduct(document);
    response.status(201).json({ message: "Product created successfully", product });
  } catch (error) {
    if (image) {
      try { await removeImage(image.publicId); } catch (cleanupError) { console.error("Image cleanup failed:", cleanupError); }
    }
    console.error("Product creation failed:", error);
    response.status(500).json({ message: error instanceof Error && error.message === "Cloudinary is not configured" ? error.message : "Unable to create product" });
  }
}

export async function list(_request: Request, response: Response): Promise<void> {
  try {
    const documents = await ProductModel.find().sort({ created_at: 1, _id: 1 }).exec();
    response.json({ products: documents.map(toProduct) });
  }
  catch (error) { console.error("Product listing failed:", error); response.status(500).json({ message: "Unable to retrieve products" }); }
}

export async function getOne(request: Request, response: Response): Promise<void> {
  const id = validId(request.params.id);
  if (!id) { response.status(400).json({ message: "Product ID must be a valid MongoDB ObjectId" }); return; }
  try {
    const document = await ProductModel.findById(id).exec();
    if (!document) { response.status(404).json({ message: "Product not found" }); return; }
    response.json({ product: toProduct(document) });
  } catch (error) { console.error("Product lookup failed:", error); response.status(500).json({ message: "Unable to retrieve product" }); }
}

export async function update(request: Request, response: Response): Promise<void> {
  const id = validId(request.params.id);
  if (!id) { response.status(400).json({ message: "Product ID must be a valid MongoDB ObjectId" }); return; }
  const fields = parseProductFields(request.body, true);
  if (!fields) { response.status(400).json({ message: "Product fields are invalid" }); return; }

  let newImage: { url: string; publicId: string } | undefined;
  try {
    const existingDocument = await ProductModel.findById(id).exec();
    if (!existingDocument) { response.status(404).json({ message: "Product not found" }); return; }
    const existing = toProduct(existingDocument);
    if (request.file) {
      newImage = await uploadImage(request.file);
      fields.image_url = newImage.url;
      fields.image_public_id = newImage.publicId;
    }

    const currentPrice = Number(existing.price);
    const price = fields.price === undefined ? currentPrice : Number(fields.price);
    const name = fields.name ?? existing.name;
    const category = fields.category ?? existing.category;
    if (!name.trim() || !category.trim() || !Number.isFinite(price) || price < 0) {
      if (newImage) await removeImage(newImage.publicId);
      response.status(400).json({ message: "Name and category are required and price must be non-negative" });
      return;
    }

    const updatedDocument = await ProductModel.findByIdAndUpdate(id,
      { ...fields, updated_at: new Date() }, { new: true, runValidators: true }).exec();
    if (!updatedDocument) { response.status(404).json({ message: "Product not found" }); return; }
    const product = toProduct(updatedDocument);
    if (newImage && existing.image_public_id) {
      try { await removeImage(existing.image_public_id); }
      catch (cleanupError) { console.error("Old image cleanup failed:", cleanupError); }
    }
    response.json({ message: "Product updated successfully", product });
  } catch (error) {
    if (newImage) {
      try { await removeImage(newImage.publicId); } catch (cleanupError) { console.error("Image cleanup failed:", cleanupError); }
    }
    console.error("Product update failed:", error);
    response.status(500).json({ message: error instanceof Error && error.message === "Cloudinary is not configured" ? error.message : "Unable to update product" });
  }
}

export async function remove(request: Request, response: Response): Promise<void> {
  const id = validId(request.params.id);
  if (!id) { response.status(400).json({ message: "Product ID must be a valid MongoDB ObjectId" }); return; }
  try {
    const existingDocument = await ProductModel.findById(id).exec();
    if (!existingDocument) { response.status(404).json({ message: "Product not found" }); return; }
    const product = toProduct(existingDocument);
    if (product.image_public_id) await removeImage(product.image_public_id);
    await ProductModel.findByIdAndDelete(id).exec();
    response.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Product deletion failed:", error);
    response.status(500).json({ message: error instanceof Error && error.message === "Cloudinary is not configured" ? error.message : "Unable to delete product" });
  }
}

// Keep this import visible to beginners as the complete database row shape.
export type { Product };
