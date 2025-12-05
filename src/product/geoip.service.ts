// src/common/geoip/geoip.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as maxmind from 'maxmind';
import type { Reader } from 'maxmind';

@Injectable()
export class GeoIpService implements OnModuleInit {
  private reader: Reader<any> | null = null;

  async onModuleInit() {
    const dbPath = process.env.GEOLITE_DB_PATH || 'GeoLite2-Country.mmdb';
    try {
      this.reader = await maxmind.open(dbPath);
    } catch (err) {
      this.reader = null;
      console.warn('GeoIP DB could not be opened:', err?.message || err);
    }
  }

  getCountryByIp(ip?: string): string | null {
    if (!this.reader || !ip) return null;
    try {
      const res = this.reader.get(ip);
      return res?.country?.names?.en || null;
    } catch (e) {
      return null;
    }
  }
}
