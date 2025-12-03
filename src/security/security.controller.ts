import { Controller, Get } from '@nestjs/common';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('privacy')
  async getPrivacy() {
    const list = await this.securityService.getPrivacyPolicyList();
    return {
      success: true,
      count: list.length,
      content: list,
    };
  }

  @Get('terms')
  async getTerms() {
    const list = await this.securityService.getTermsList();
    return {
      success: true,
      count: list.length,
      content: list,
    };
  }
}
