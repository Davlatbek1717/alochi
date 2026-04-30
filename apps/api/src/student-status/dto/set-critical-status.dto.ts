import { SetPersonalStatusDto } from './set-personal-status.dto';

// Same shape as personal-status; kept as a separate class so the two
// endpoints can diverge later (e.g. extra fields for critical events).
export class SetCriticalStatusDto extends SetPersonalStatusDto {}
