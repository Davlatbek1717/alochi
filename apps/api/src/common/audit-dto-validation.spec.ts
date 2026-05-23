import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDelegationDto } from '../delegations/dto/create-delegation.dto';
import { GiveWarningDto } from '../warnings/dto/give-warning.dto';
import { UpdateDeviceDto } from '../devices/dto/update-device.dto';

/**
 * #6 — the controllers used to accept `@Body() any`, letting callers spread
 * arbitrary fields into Prisma. These DTOs constrain the shape. We assert the
 * field-level constraints here; `forbidNonWhitelisted` (rejecting unknown
 * fields) is enforced globally by the ValidationPipe in main.ts.
 */
async function errorsFor(cls: any, payload: object): Promise<string[]> {
  const instance = plainToInstance(cls, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((e) => e.property);
}

describe('audit #6 — DTO validation', () => {
  describe('CreateDelegationDto', () => {
    const valid = {
      toUserId: 'u-1',
      delegatedRole: 'manager',
      permissions: ['warnings'],
      reason: 'vacation cover',
      startsAt: '2026-05-01T00:00:00.000Z',
      endsAt: '2026-05-10T00:00:00.000Z',
    };

    it('passes for a valid payload', async () => {
      expect(await errorsFor(CreateDelegationDto, valid)).toEqual([]);
    });

    it('rejects a delegatedRole outside filadmin/manager', async () => {
      const errs = await errorsFor(CreateDelegationDto, {
        ...valid,
        delegatedRole: 'superadmin',
      });
      expect(errs).toContain('delegatedRole');
    });

    it('rejects an empty permissions array', async () => {
      const errs = await errorsFor(CreateDelegationDto, {
        ...valid,
        permissions: [],
      });
      expect(errs).toContain('permissions');
    });

    it('rejects a non-date startsAt', async () => {
      const errs = await errorsFor(CreateDelegationDto, {
        ...valid,
        startsAt: 'not-a-date',
      });
      expect(errs).toContain('startsAt');
    });
  });

  describe('GiveWarningDto', () => {
    it('passes for a valid payload', async () => {
      expect(
        await errorsFor(GiveWarningDto, {
          reasonType: 'discipline',
          reasonText: 'late again',
        }),
      ).toEqual([]);
    });

    it('rejects a blank reasonText', async () => {
      const errs = await errorsFor(GiveWarningDto, {
        reasonType: 'discipline',
        reasonText: '',
      });
      expect(errs).toContain('reasonText');
    });
  });

  describe('UpdateDeviceDto', () => {
    it('passes for whitelisted fields', async () => {
      expect(
        await errorsFor(UpdateDeviceDto, {
          model: 'Galaxy Tab',
          status: 'active',
          batteryLevel: 80,
        }),
      ).toEqual([]);
    });

    it('rejects an out-of-range batteryLevel', async () => {
      const errs = await errorsFor(UpdateDeviceDto, { batteryLevel: 250 });
      expect(errs).toContain('batteryLevel');
    });

    it('rejects an invalid status enum', async () => {
      const errs = await errorsFor(UpdateDeviceDto, { status: 'on-fire' });
      expect(errs).toContain('status');
    });
  });
});
