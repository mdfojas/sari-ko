import { listStores } from '../../queries/stores/index.js';

export async function list() {
  return listStores();
}
