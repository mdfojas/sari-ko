export interface CreatePersonBody {
  name?: string;
  contact?: string | null;
}

export function validateCreatePerson(body: CreatePersonBody): string | null {
  if (!body.name) {
    return 'name is required';
  }
  return null;
}
