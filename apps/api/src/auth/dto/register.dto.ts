import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'hanako@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    example: 'correct-horse-battery',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ maxLength: 100, example: 'Yamada Hanako' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
