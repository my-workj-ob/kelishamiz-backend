import { Injectable } from '@nestjs/common';

@Injectable()
export class OtpService {
  private readonly FAKE_OTP = '8888';
  private sentOtps: Record<string, string> = {};

  sendOtp(phone: string): Promise<string> {
    this.sentOtps[phone] = this.FAKE_OTP;
    console.log(`OTP to ${phone}: ${this.FAKE_OTP}`);
    return Promise.resolve(this.FAKE_OTP);
  }

  verifyOtp(phone: string, code: string): boolean {
    return this.sentOtps[phone] === code;
  }
}
