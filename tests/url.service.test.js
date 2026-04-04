/**
 * Unit tests for url.service.js
 * Dependencies (DB + Redis) are mocked.
 */

jest.mock('../src/config/redis');
jest.mock('../src/repositories/url.repository');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const redis = require('../src/config/redis');
const urlRepo = require('../src/repositories/url.repository');
const urlService = require('../src/services/url.service');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createShortUrl', () => {
  it('creates a short URL with a generated code', async () => {
    urlRepo.shortCodeExists.mockResolvedValue(false);
    urlRepo.createUrl.mockResolvedValue({
      id: 1,
      short_code: 'abc1234',
      original_url: 'https://example.com',
      title: null,
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    });
    redis.set.mockResolvedValue('OK');

    const result = await urlService.createShortUrl({
      originalUrl: 'https://example.com',
    });

    expect(result.shortCode).toBeDefined();
    expect(result.shortUrl).toContain(result.shortCode);
    expect(urlRepo.createUrl).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it('uses a custom alias when provided', async () => {
    urlRepo.shortCodeExists.mockResolvedValue(false);
    urlRepo.createUrl.mockResolvedValue({
      id: 2,
      short_code: 'my-link',
      original_url: 'https://example.com',
      title: null,
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    });
    redis.set.mockResolvedValue('OK');

    const result = await urlService.createShortUrl({
      originalUrl: 'https://example.com',
      customAlias: 'my-link',
    });

    expect(result.shortCode).toBe('my-link');
  });

  it('throws 409 when custom alias is already taken', async () => {
    urlRepo.shortCodeExists.mockResolvedValue(true);

    await expect(
      urlService.createShortUrl({ originalUrl: 'https://example.com', customAlias: 'taken' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 400 for an invalid URL', async () => {
    await expect(
      urlService.createShortUrl({ originalUrl: 'not-a-url' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for localhost URLs (SSRF prevention)', async () => {
    await expect(
      urlService.createShortUrl({ originalUrl: 'http://localhost/secret' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('resolveShortCode', () => {
  it('returns originalUrl from cache on cache hit', async () => {
    redis.get.mockResolvedValue('https://example.com');

    const result = await urlService.resolveShortCode('abc1234');

    expect(result.originalUrl).toBe('https://example.com');
    expect(result.fromCache).toBe(true);
    expect(urlRepo.findByShortCode).not.toHaveBeenCalled();
  });

  it('falls back to DB on cache miss and backfills cache', async () => {
    redis.get.mockResolvedValue(null);
    urlRepo.findByShortCode.mockResolvedValue({
      id: 1,
      short_code: 'abc1234',
      original_url: 'https://example.com',
      expires_at: new Date(Date.now() + 86400000),
    });
    redis.set.mockResolvedValue('OK');

    const result = await urlService.resolveShortCode('abc1234');

    expect(result.originalUrl).toBe('https://example.com');
    expect(result.fromCache).toBe(false);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when short code does not exist', async () => {
    redis.get.mockResolvedValue(null);
    urlRepo.findByShortCode.mockResolvedValue(null);

    await expect(urlService.resolveShortCode('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('deactivateUrl', () => {
  it('deactivates URL and invalidates cache', async () => {
    urlRepo.deactivateUrl.mockResolvedValue({ id: 1, short_code: 'abc1234' });
    redis.del.mockResolvedValue(1);

    await urlService.deactivateUrl('abc1234');

    expect(urlRepo.deactivateUrl).toHaveBeenCalledWith('abc1234');
    expect(redis.del).toHaveBeenCalledWith('abc1234');
  });

  it('throws 404 when URL not found', async () => {
    urlRepo.deactivateUrl.mockResolvedValue(null);

    await expect(urlService.deactivateUrl('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
