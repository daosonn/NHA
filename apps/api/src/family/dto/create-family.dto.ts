import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFamilyDto {
  @ApiProperty({ maxLength: 100, example: '山田家' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
