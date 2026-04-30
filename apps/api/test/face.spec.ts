import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EnrollFaceDto } from '../src/face/dto/enroll.dto';

/**
 * PDPL §533: enrollment must reject any payload that contains the
 * legacy `images_base64` field. The global ValidationPipe is
 * configured with `forbidNonWhitelisted: true` so class-validator
 * will refuse the request before it ever reaches the controller.
 */
describe('EnrollFaceDto (PDPL compliance)', () => {
  // proper v4 UUIDs (third group starts with 4, fourth with 8/9/a/b)
  const VALID_USER = '11111111-1111-4111-8111-111111111111';
  const VALID_TENANT = '22222222-2222-4222-8222-222222222222';

  it('accepts valid embeddings payload', async () => {
    const dto = plainToInstance(EnrollFaceDto, {
      user_id: VALID_USER,
      tenant_id: VALID_TENANT,
      embeddings: [Array.from({ length: 128 }, (_, i) => i / 128)],
      enrolled_via: 'web',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects payload without embeddings', async () => {
    const dto = plainToInstance(EnrollFaceDto, {
      user_id: VALID_USER,
      tenant_id: VALID_TENANT,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'embeddings')).toBe(true);
  });

  it('rejects payload with invalid uuids', async () => {
    const dto = plainToInstance(EnrollFaceDto, {
      user_id: 'not-a-uuid',
      tenant_id: 'also-not-a-uuid',
      embeddings: [[0.1, 0.2]],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'user_id')).toBe(true);
    expect(errors.some((e) => e.property === 'tenant_id')).toBe(true);
  });

  it('rejects payload with empty embeddings array', async () => {
    const dto = plainToInstance(EnrollFaceDto, {
      user_id: VALID_USER,
      tenant_id: VALID_TENANT,
      embeddings: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'embeddings')).toBe(true);
  });

  it('does not declare images_base64 as a property — forbidNonWhitelisted will reject it', () => {
    const props = Object.keys(new EnrollFaceDto());
    expect(props).not.toContain('images_base64');
  });
});
