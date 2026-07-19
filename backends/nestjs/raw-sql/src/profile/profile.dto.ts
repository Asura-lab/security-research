// ⚠️ Alpha impl-т ValidationPipe нь `whitelist: false` тохиргоотой ажиллах бөгөөд
// mekдэгдээгүй талбарууд (`role`, `is_admin`, `targets`) чимээгүй accept болдог.
//
// Beta impl-д `whitelist: true, forbidNonWhitelisted: true` тохируулна.

import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class OverpostTargetDto {
  @IsString()
  label!: string;

  @IsString()
  value!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Overposting variant 1 — role escalation
  @IsOptional()
  @IsString()
  role?: string;

  // Overposting variant 2 — admin escalation
  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;

  // Overposting variant 3 — profile_targets-т шууд бичих
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OverpostTargetDto)
  targets?: OverpostTargetDto[];
}
