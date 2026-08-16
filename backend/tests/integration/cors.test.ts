import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('CORS', () => {
  const originalFrontendOrigin = process.env.FRONTEND_ORIGIN;

  afterEach(() => {
    process.env.FRONTEND_ORIGIN = originalFrontendOrigin;
  });

  it('allows a request from an origin listed in FRONTEND_ORIGIN', async () => {
    process.env.FRONTEND_ORIGIN = 'https://sariko.example.com';
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://sariko.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('https://sariko.example.com');
  });

  it('does not allow a request from an origin not listed in FRONTEND_ORIGIN', async () => {
    process.env.FRONTEND_ORIGIN = 'https://sariko.example.com';
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('supports multiple comma-separated origins', async () => {
    process.env.FRONTEND_ORIGIN =
      'https://sariko.example.com,https://staging.sariko.example.com';
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://staging.sariko.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://staging.sariko.example.com'
    );
  });

  it('handles a CORS preflight request for an allowed origin', async () => {
    process.env.FRONTEND_ORIGIN = 'https://sariko.example.com';
    const app = buildApp();

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://sariko.example.com',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe('https://sariko.example.com');
  });
});
