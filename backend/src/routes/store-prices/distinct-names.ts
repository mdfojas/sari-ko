import { listDistinctStoreNames } from '../../queries/store-prices/index.js';

export async function distinctNames() {
  return listDistinctStoreNames();
}
