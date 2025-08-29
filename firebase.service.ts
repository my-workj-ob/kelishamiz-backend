// src/firebase/firebase.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    if (!admin.apps.length) {
      try {
        const serviceAccountPath = path.resolve(
          process.cwd(),
          'src/firebase-service-account.json',
        );

        const serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, 'utf8'),
        ) as admin.ServiceAccount;

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase initialized');
      } catch (err) {
        console.error('❌ Failed to initialize Firebase:', err);
      }
    }
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<string> {
    const message: admin.messaging.Message = {
      token,
      notification: { title, body },
      data,
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('✅ Notification sent:', response);
      return response;
    } catch (error) {
      console.error('❌ Notification error:', error);
      throw new Error(`Notification failed: ${(error as Error).message}`);
    }
  }
}
