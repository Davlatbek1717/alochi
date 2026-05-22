import { IsString, IsNotEmpty } from 'class-validator';

/**
 * studentId, tenantId, givenBy and delegationId are intentionally absent —
 * the controller injects them from the route param and req.user so a caller
 * can't attribute a warning to someone else or target another tenant.
 *
 * reasonType is a free-form string (not an enum) because different admin
 * surfaces send different vocabularies (snake_case codes vs. Uzbek phrases).
 */
export class GiveWarningDto {
  @IsString()
  @IsNotEmpty()
  reasonType: string;

  @IsString()
  @IsNotEmpty()
  reasonText: string;
}
