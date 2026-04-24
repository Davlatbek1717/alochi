import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { of } from 'rxjs';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  it('wraps data in { success, data, meta }', (done) => {
    const mockCtx = {} as any;
    const mockNext = { handle: () => of({ id: '1', name: 'Test' }) };

    interceptor.intercept(mockCtx, mockNext).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '1', name: 'Test' });
      expect(result.meta.timestamp).toBeDefined();
      done();
    });
  });
});
