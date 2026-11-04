import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, authHeaderFor } from '../../../helpers.js';
import { pool } from '../../../../src/shared/db.js';
import { resetDatabase } from '../../../reset-db.js';

describe('GET /persons', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('rejects a request with no auth', async () => {
    const response = await app.inject({ method: 'GET', url: '/persons' });
    expect(response.statusCode).toBe(401);
  });

  it('lists all persons', async () => {
    await pool.query(`INSERT INTO persons (name) VALUES ('Juan Dela Cruz')`);

    const response = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].has_account).toBe(false);
  });

  it('includes each persons balance: loans minus payments, and 0 with no history', async () => {
    const { rows: owing } = await pool.query(`INSERT INTO persons (name) VALUES ('Owes Money') RETURNING id`);
    await pool.query(`INSERT INTO persons (name) VALUES ('No History')`);
    const { rows: loan } = await pool.query(`INSERT INTO loans (person_id) VALUES ($1) RETURNING id`, [owing[0].id]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'rice', 1225)`, [loan[0].id]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'soap', 300)`, [loan[0].id]);
    await pool.query(`INSERT INTO payments (person_id, amount) VALUES ($1, 1000)`, [owing[0].id]);

    const response = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });

    const byName = Object.fromEntries(response.json().map((p: { name: string; balance: number }) => [p.name, p.balance]));
    expect(byName['Owes Money']).toBe(525);
    expect(byName['No History']).toBe(0);
  });

  it('reports the same balance as GET /persons/:id/balance, which is the ledgers last running balance', async () => {
    const { rows } = await pool.query(`INSERT INTO persons (name) VALUES ('Juan') RETURNING id`);
    const personId = rows[0].id;
    const { rows: loan } = await pool.query(`INSERT INTO loans (person_id, created_at) VALUES ($1, '2026-01-01') RETURNING id`, [personId]);
    await pool.query(`INSERT INTO loan_line_items (loan_id, description, amount) VALUES ($1, 'a', 700)`, [loan[0].id]);
    await pool.query(`INSERT INTO payments (person_id, amount, created_at) VALUES ($1, 250, '2026-01-02')`, [personId]);
    await pool.query(`INSERT INTO payments (person_id, amount, created_at) VALUES ($1, 600, '2026-01-03')`, [personId]);

    const list = await app.inject({ method: 'GET', url: '/persons', headers: authHeaderFor('admin') });
    const balance = await app.inject({ method: 'GET', url: `/persons/${personId}/balance`, headers: authHeaderFor('admin') });

    expect(balance.json().balance).toBe(-150);
    expect(list.json()[0].balance).toBe(balance.json().balance);
  });
});
