import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsArray,
  ArrayNotEmpty,
  IsDateString,
} from 'class-validator';

/**
 * tenantId, branchId and fromUserId are intentionally absent — the controller
 * always injects them from req.user so a caller can't forge a delegation on
 * behalf of another admin or into another tenant.
 */
export class CreateDelegationDto {
  @IsString()
  @IsNotEmpty()
  toUserId: string;

  @IsIn(['filadmin', 'manager'])
  delegatedRole: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissions: string[];

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}
