import { Injectable } from '@nestjs/common';

@Injectable()
export class OtpService {
  private sentOtps: Record<string, string> = {};

  generateOtp(): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  }

  sendOtp(phone: string): Promise<string> {
    const otpCode = this.generateOtp();
    this.sentOtps[phone] = otpCode;
    console.log(`OTP to ${phone}: ${otpCode}`);
    // Real applicationda SMS yuborish logikasi bu yerda bo'lishi kerak
    return Promise.resolve(otpCode);
  }

  verifyOtp(phone: string, code: string): boolean {
    return this.sentOtps[phone] === code;
  }
}
