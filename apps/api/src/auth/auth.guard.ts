import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err ?? new UnauthorizedException(
        info?.name === 'TokenExpiredError' ? 'Token muddati tugagan' : 'Token yaroqsiz',
      );
    }
    return user;
  }
}
