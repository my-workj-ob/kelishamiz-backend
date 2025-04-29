import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

export class BaseFilterService<T extends ObjectLiteral> {
  constructor(private readonly repository: Repository<T>) {}

  async filter(options: {
    filters: Record<string, any>;
    relations?: string[];
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    take?: number;
    skip?: number;
    whereCallback?: (qb: SelectQueryBuilder<T>, filters: any) => void;
  }): Promise<T[]> {
    const {
      filters,
      relations = [],
      sortBy,
      sortOrder = 'ASC',
      take = 10,
      skip = 0,
      whereCallback,
    } = options;

    const qb = this.repository.createQueryBuilder('entity');

    // Dynamic JOIN
    for (const relation of relations) {
      qb.leftJoinAndSelect(`entity.${relation}`, relation);
    }

    // Dynamic WHERE
    if (whereCallback) {
      whereCallback(qb, filters);
    }

    // Dynamic ORDER BY
    if (sortBy) {
      qb.orderBy(`entity.${sortBy}`, sortOrder);
    }

    // Pagination
    qb.skip(Math.max(skip, 0)).take(Math.max(take, 1));

    return qb.getMany();
  }
}
