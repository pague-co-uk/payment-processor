import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from "class-validator";

export class VerifyPaymentOtpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  publicId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  otp!: string;
}