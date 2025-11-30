import { Controller, Get } from '@nestjs/common';
import * as path from 'path';
import AdmZip from 'adm-zip';
import * as fs from 'fs';

@Controller('security')
export class SecurityController {
  private readOdtFile(filePath: string): string {
    if (!fs.existsSync(filePath)) return 'Fayl topilmadi';
    const zip = new AdmZip(filePath);
    const contentXml = zip.readAsText('content.xml');
    const textMatches = contentXml.match(/<text:p[^>]*>(.*?)<\/text:p>/g);
    if (!textMatches) return '';
    return textMatches.map((m) => m.replace(/<[^>]+>/g, '')).join('\n');
  }

  // Privacy Policy endpoint
  @Get('privacy')
  getPrivacy() {
    const privacyPath = path.join(process.cwd(), 'files/privacy.odt');
    const privacyText = this.readOdtFile(privacyPath);
    return privacyText;
  }

  // Terms & Conditions endpoint
  @Get('terms')
  getTerms() {
    const termsPath = path.join(process.cwd(), 'files/terms.odt');
    const termsText = this.readOdtFile(termsPath);
    return termsText;
  }
}
