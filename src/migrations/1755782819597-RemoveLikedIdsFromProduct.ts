import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLikedIdsFromProduct1755782779164
  implements MigrationInterface
{
  name = 'RemoveLikedIdsFromProduct1755782779164';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `liked_ids` ustunini o'chirish
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "liked_ids"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `down` metodi migratsiyani bekor qilish uchun.
    // Bu qism xatolik yuzaga kelganida yoki migratsiyani ortga qaytarishda kerak bo'ladi.
    await queryRunner.query(
      `ALTER TABLE "product" ADD "liked_ids" text[] NOT NULL DEFAULT '{}'`,
    );
  }
}
