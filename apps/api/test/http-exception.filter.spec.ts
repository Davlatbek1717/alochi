import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { ERROR_CODES } from '../src/common/errors/codes';

function makeHost(): { host: ArgumentsHost; capture: () => unknown } {
  let captured: unknown;
  let statusCode = 0;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return {
    host,
    capture: () => ({ statusCode, body: captured }),
  };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('emits enriched envelope when exception carries a code', () => {
    const { host, capture } = makeHost();
    filter.catch(
      new BadRequestException({
        code: ERROR_CODES.LESSON_LOCKED,
        message: 'Bu dars qulflangan',
        details: { required_lesson_id: 'l-1' },
      }),
      host,
    );
    const { statusCode, body } = capture() as {
      statusCode: number;
      body: {
        success: boolean;
        error: { code: string; message: string; details: unknown };
      };
    };
    expect(statusCode).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LESSON_LOCKED');
    expect(body.error.message).toBe('Bu dars qulflangan');
    expect(body.error.details).toEqual({ required_lesson_id: 'l-1' });
  });

  it('falls back to status-derived code for legacy exceptions', () => {
    const { host, capture } = makeHost();
    filter.catch(new BadRequestException('plain message'), host);
    const { body } = capture() as {
      body: { success: boolean; error: { code: string; message: string } };
    };
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('plain message');
  });

  it('handles non-HttpException with INTERNAL_ERROR', () => {
    const { host, capture } = makeHost();
    filter.catch(new Error('boom'), host);
    const { statusCode, body } = capture() as {
      statusCode: number;
      body: { success: boolean; error: { code: string; message: string } };
    };
    expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('boom');
  });

  it('preserves class-validator string-array messages', () => {
    const { host, capture } = makeHost();
    filter.catch(
      new HttpException(
        { message: ['email must be a string', 'password too short'] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );
    const { body } = capture() as {
      body: {
        error: { code: string; message: string; errors?: { field: string }[] };
      };
    };
    expect(body.error.message).toContain('email must be a string');
    expect(body.error.errors).toBeDefined();
  });
});
