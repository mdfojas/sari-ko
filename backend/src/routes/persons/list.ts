import { listPersons } from '../../queries/persons/index.js';

export async function list() {
  return listPersons();
}
