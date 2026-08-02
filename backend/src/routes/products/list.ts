import { listProducts } from '../../queries/products/index.js';

export async function list() {
  return listProducts();
}
