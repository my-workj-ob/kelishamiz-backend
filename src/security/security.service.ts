import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Security } from './entities/security.entity';
import AdmZip from 'adm-zip';
import * as path from 'path';

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(Security)
    private readonly securityRepo: Repository<Security>,
  ) {}

  // ODT fayldan matn olish
  private readOdtFile(filePath: string): string {
    const zip = new AdmZip(filePath);
    const contentXml = zip.readAsText('content.xml');
    const textMatches = contentXml.match(/<text:p[^>]*>(.*?)<\/text:p>/g);
    if (!textMatches) return '';
    return textMatches.map((m) => m.replace(/<[^>]+>/g, '')).join('\n');
  }

  // DB-ga saqlash yoki yangilash
  async upsertSecurityFiles(
    privacyOdtPath: string,
    termsOdtPath: string,
  ): Promise<Security> {
    const privacyPolicy = this.readOdtFile(privacyOdtPath);
    const terms = this.readOdtFile(termsOdtPath);

    let record = await this.securityRepo.findOne({ where: { id: 1 } });
    if (!record) {
      record = this.securityRepo.create({ privacyPolicy, terms });
    } else {
      record.privacyPolicy = privacyPolicy;
      record.terms = terms;
    }
    return this.securityRepo.save(record);
  }

  // DB-dan olish
  async getSecurityContent(): Promise<Security> {
    const record = await this.securityRepo.findOne({ where: { id: 1 } });
    if (!record) {
      throw new NotFoundException('Security content not found');
    }
    return record;
  }
}
