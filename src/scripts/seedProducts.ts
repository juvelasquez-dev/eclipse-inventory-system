import { supabase } from "../lib/supabase";
import { products } from "../mock/products";

export async function seedProducts() {
  const { data, error } = await supabase
    .from("products")
    .insert(
      products.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category: product.category,
        unit: product.unit,
        minimum_stock: product.minimumStock,
      }))
    )
    .select();

  if (error) {
    console.error("Error seeding products:", error);
    return;
  }

  console.log("Products successfully seeded:", data);
}