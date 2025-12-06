import { Injectable, NotFoundException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SecurityService {
  private readOdtFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`${filePath} topilmadi`);
    }

    const zip = new AdmZip(filePath);
    const xml = zip.readAsText('content.xml');

    const matches = xml.match(/<text:p[^>]*>(.*?)<\/text:p>/g);
    if (!matches) return '';

    return matches.map((m) => m.replace(/<[^>]+>/g, '')).join('\n');
  }

  private parseSecurityJson(raw: string) {
    if (!raw) throw new NotFoundException('ODT dan matn olinmadi');

    let cleaned = raw
      .replace(/&quot;/g, '"')
      .replace(/\[cite_start\]/g, '')
      .replace(/\[cite:[^\]]+\]/g, '')
      .replace(/\n/g, ' ')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('JSON Parse Error:', e);
      throw new NotFoundException('ODT ichidagi JSON noto‘g‘ri formatda');
    }
  }

  async getPrivacyPolicyList() {
    const filePath = path.join(process.cwd(), 'files/privacy.odt');
    const rawText = this.readOdtFile(filePath);
    const parsed = this.parseSecurityJson(rawText);

    if (!parsed?.data?.privacy_policy) {
      throw new NotFoundException('privacy_policy list topilmadi');
    }

    return parsed.data.privacy_policy;
  }

  async getTermsList() {
    const filePath = path.join(process.cwd(), 'files/terms.odt');
    const rawText = this.readOdtFile(filePath);
    const parsed = this.parseSecurityJson(rawText);

    if (!parsed?.data?.terms_of_use) {
      throw new NotFoundException('terms list topilmadi');
    }

    return parsed.data.terms_of_use;
  }
}
