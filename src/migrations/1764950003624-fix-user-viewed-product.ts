import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUserViewedProduct1764950003624 implements MigrationInterface {
  name = 'FixUserViewedProduct1764950003624';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Null bo'lgan qiymatlarni hozirgi vaqt bilan to'ldirish
    await queryRunner.query(`
            UPDATE "user_viewed_product"
            SET "viewedAt" = NOW()
            WHERE "viewedAt" IS NULL
        `);

    // 2. Ustunni NOT NULL qilish
    await queryRunner.query(`
            ALTER TABLE "user_viewed_product"
            ALTER COLUMN "viewedAt" SET NOT NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: ustunni nullable qilamiz
    await queryRunner.query(`
            ALTER TABLE "user_viewed_product"
            ALTER COLUMN "viewedAt" DROP NOT NULL
        `);
  }
}
