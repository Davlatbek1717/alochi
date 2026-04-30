import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

/**
 * Face enrollment payload — PDPL §533 compliance.
 *
 * The frontend computes 128-dim face descriptors locally with face-api.js
 * and sends only the math vectors. Raw images NEVER touch the server.
 *
 * Legacy `images_base64` is no longer accepted; the global ValidationPipe
 * runs with `forbidNonWhitelisted: true` so any request with that field
 * is rejected with HTTP 400.
 */
export class EnrollFaceDto {
  @IsUUID()
  user_id!: string;

  @IsUUID()
  tenant_id!: string;

  /**
   * Array of face descriptor vectors. Validated as `number[][]` by hand
   * (class-validator does not have first-class number-matrix support).
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  embeddings!: number[][];

  @IsOptional()
  @IsString()
  enrolled_via?: string;
}

export class RecognizeFaceDto {
  @IsUUID()
  tenant_id!: string;

  @IsUUID()
  branch_id!: string;

  @IsString()
  deviceToken!: string;

  @IsArray()
  @ArrayMinSize(64)
  @ArrayMaxSize(512)
  @IsNumber({}, { each: true })
  embedding!: number[];
}
