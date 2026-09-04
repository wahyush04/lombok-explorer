import {
  Prisma,
  LombokRegion,
  DifficultyLevel,
  DestinationStatus,
  Category,
  DestinationImage,
  Destination,
} from '@prisma/client';
import { prisma } from '../../database/prisma';

export type DestinationWithRelations = Destination & {
  category?: Category | null;
  images?: (DestinationImage | string)[] | null;
  favorites?: { id: string }[];
};

export interface DestinationSearchParams {
  search?: string;
  category?: string;
  region?: LombokRegion;
  difficulty?: DifficultyLevel;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  isFeatured?: boolean;
  tag?: string;
  status?: DestinationStatus;
  includeDeleted?: boolean;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
  userId?: string;
}

export interface DestinationSearchResult {
  items: DestinationWithRelations[];
  total: number;
}

export class DestinationsSearchService {
  /**
   * Sanitizes search input and prepares prefix tokens for PostgreSQL to_tsquery
   */
  private prepareTsQueryTokens(query: string): string {
    const cleanTokens = query
      .toLowerCase()
      .replace(/[^\w\s\u00C0-\u024F]/g, ' ') // keep alphanumeric and accented characters
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (cleanTokens.length === 0) {
      return '';
    }

    // Prefix match for every token combined with AND: token1:* & token2:*
    return cleanTokens.map((t) => `${t}:*`).join(' & ');
  }

  /**
   * Executes high-performance PostgreSQL Full-Text Search (FTS) + pg_trgm fuzzy matching
   * with multi-field weighted ranking and relevance scoring.
   */
  public async search(params: DestinationSearchParams): Promise<DestinationSearchResult> {
    const cleanSearch = (params.search || '').trim();
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const offset = (page - 1) * limit;
    const orderDirection = params.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // If search term is empty, delegate to standard Prisma ORM query
    if (!cleanSearch) {
      return this.fallbackPrismaSearch(params);
    }

    const prefixTokens = this.prepareTsQueryTokens(cleanSearch);

    // Build dynamic SQL filter clauses safely using Prisma.sql
    const whereConditions: Prisma.Sql[] = [];

    if (!params.includeDeleted) {
      whereConditions.push(Prisma.sql`d."deletedAt" IS NULL`);
    }

    if (params.status) {
      whereConditions.push(Prisma.sql`d.status = ${params.status}::"DestinationStatus"`);
    } else if (!params.includeDeleted) {
      whereConditions.push(Prisma.sql`d.status = 'PUBLISHED'::"DestinationStatus"`);
    }

    if (params.category) {
      const cat = params.category.trim();
      whereConditions.push(
        Prisma.sql`(d."categoryId" = ${cat} OR lower(d.category_slug) = lower(${cat}) OR lower(d.category_name) = lower(${cat}))`,
      );
    }

    if (params.region) {
      whereConditions.push(Prisma.sql`d.region = ${params.region}::"LombokRegion"`);
    }

    if (params.difficulty) {
      whereConditions.push(Prisma.sql`d.difficulty = ${params.difficulty}::"DifficultyLevel"`);
    }

    if (params.minRating !== undefined && !Number.isNaN(params.minRating)) {
      whereConditions.push(Prisma.sql`d.rating >= ${params.minRating}`);
    }

    if (params.minPrice !== undefined && !Number.isNaN(params.minPrice)) {
      whereConditions.push(Prisma.sql`d."entranceFee" >= ${params.minPrice}`);
    }

    if (params.maxPrice !== undefined && !Number.isNaN(params.maxPrice)) {
      whereConditions.push(Prisma.sql`d."entranceFee" <= ${params.maxPrice}`);
    }

    if (params.isFeatured !== undefined) {
      whereConditions.push(Prisma.sql`d."isFeatured" = ${params.isFeatured}`);
    }

    if (params.tag) {
      const tagTerm = `%${params.tag.toLowerCase().trim()}%`;
      whereConditions.push(Prisma.sql`lower(d.tags) LIKE ${tagTerm}`);
    }

    // Full-Text Search + Trigram Match Condition
    // 1. websearch_to_tsquery match
    // 2. prefix to_tsquery match (for autocomplete/partial words)
    // 3. trigram similarity on name >= 0.18 (for typos like "merse" -> "merese")
    // 4. substring match on name, shortDescription, description, locationName, tags, category_name
    const ftsConditions: Prisma.Sql[] = [
      Prisma.sql`d.doc_vector @@ websearch_to_tsquery('simple', unaccent(${cleanSearch}))`,
    ];

    if (prefixTokens) {
      ftsConditions.push(
        Prisma.sql`d.doc_vector @@ to_tsquery('simple', unaccent(${prefixTokens}))`,
      );
    }

    ftsConditions.push(
      Prisma.sql`similarity(lower(unaccent(d.name)), lower(unaccent(${cleanSearch}))) >= 0.18`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d.name)) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d."shortDescription")) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d.description)) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d."locationName")) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d.tags)) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );
    ftsConditions.push(
      Prisma.sql`lower(unaccent(d.category_name)) LIKE lower(unaccent(${`%${cleanSearch}%`}))`,
    );

    const ftsWhereClause = Prisma.sql`(${Prisma.join(ftsConditions, ' OR ')})`;
    whereConditions.push(ftsWhereClause);

    const fullWhereClause = Prisma.sql`WHERE ${Prisma.join(whereConditions, ' AND ')}`;

    // Build Order By Clause
    let orderBySql: Prisma.Sql;
    switch (params.sortBy) {
      case 'rating':
        orderBySql =
          orderDirection === 'ASC'
            ? Prisma.sql`d.rating ASC, d."reviewCount" ASC`
            : Prisma.sql`d.rating DESC, d."reviewCount" DESC`;
        break;
      case 'name':
        orderBySql = orderDirection === 'ASC' ? Prisma.sql`d.name ASC` : Prisma.sql`d.name DESC`;
        break;
      case 'price_asc':
        orderBySql = Prisma.sql`d."entranceFee" ASC, d.rating DESC`;
        break;
      case 'price_desc':
        orderBySql = Prisma.sql`d."entranceFee" DESC, d.rating DESC`;
        break;
      case 'newest':
        orderBySql =
          orderDirection === 'ASC' ? Prisma.sql`d."createdAt" ASC` : Prisma.sql`d."createdAt" DESC`;
        break;
      case 'popular':
      case 'relevance':
      default:
        // Default relevance ordering: higher composite relevance score first, then rating, reviews, createdAt
        orderBySql = Prisma.sql`relevance_score DESC, d.rating DESC, d."reviewCount" DESC, d."createdAt" DESC`;
        break;
    }

    // Parameterized Raw SQL Query with Weighted Document Vector and Composite Relevance Score
    const querySql = Prisma.sql`
      WITH destination_search AS (
        SELECT
          d.*,
          c.name AS category_name,
          c.slug AS category_slug,
          (
            setweight(to_tsvector('simple', unaccent(coalesce(d.name, ''))), 'A') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d."shortDescription", ''))), 'B') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d.description, '') || ' ' || coalesce(d."locationName", '') || ' ' || coalesce(d.address, ''))), 'C') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d.tags, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(d.facilities, '') || ' ' || coalesce(d.tips, ''))), 'D')
          ) AS doc_vector,
          (
            -- FTS rank with weights D=0.1, C=0.2, B=0.5, A=1.0
            (coalesce(ts_rank(
              ARRAY[0.1, 0.2, 0.5, 1.0],
              (
                setweight(to_tsvector('simple', unaccent(coalesce(d.name, ''))), 'A') ||
                setweight(to_tsvector('simple', unaccent(coalesce(d."shortDescription", ''))), 'B') ||
                setweight(to_tsvector('simple', unaccent(coalesce(d.description, '') || ' ' || coalesce(d."locationName", '') || ' ' || coalesce(d.address, ''))), 'C') ||
                setweight(to_tsvector('simple', unaccent(coalesce(d.tags, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(d.facilities, '') || ' ' || coalesce(d.tips, ''))), 'D')
              ),
              websearch_to_tsquery('simple', unaccent(${cleanSearch}))
            ), 0.0) * 15.0)
            -- Trigram similarity score on destination title (0.0 to 1.0)
            + (coalesce(similarity(lower(unaccent(d.name)), lower(unaccent(${cleanSearch}))), 0.0) * 20.0)
            -- Exact title match major boost
            + (CASE WHEN lower(unaccent(d.name)) = lower(unaccent(${cleanSearch})) THEN 30.0 ELSE 0.0 END)
            -- Title starts with search term boost
            + (CASE WHEN lower(unaccent(d.name)) LIKE lower(unaccent(${cleanSearch})) || '%' THEN 15.0 ELSE 0.0 END)
            -- Title contains search term boost
            + (CASE WHEN lower(unaccent(d.name)) LIKE '%' || lower(unaccent(${cleanSearch})) || '%' THEN 10.0 ELSE 0.0 END)
            -- Short description contains search term boost
            + (CASE WHEN lower(unaccent(d."shortDescription")) LIKE '%' || lower(unaccent(${cleanSearch})) || '%' THEN 5.0 ELSE 0.0 END)
            -- Location name match boost
            + (CASE WHEN lower(unaccent(d."locationName")) LIKE '%' || lower(unaccent(${cleanSearch})) || '%' THEN 4.0 ELSE 0.0 END)
            -- Tags match boost
            + (CASE WHEN lower(unaccent(d.tags)) LIKE '%' || lower(unaccent(${cleanSearch})) || '%' THEN 3.0 ELSE 0.0 END)
            -- Featured destination boost
            + (CASE WHEN d."isFeatured" THEN 1.5 ELSE 0.0 END)
            -- High rating micro boost
            + (coalesce(d.rating, 0.0) * 0.2)
          ) AS relevance_score
        FROM destinations d
        LEFT JOIN categories c ON d."categoryId" = c.id
      )
      SELECT id, relevance_score
      FROM destination_search d
      ${fullWhereClause}
      ORDER BY ${orderBySql}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countSql = Prisma.sql`
      WITH destination_search AS (
        SELECT
          d.*,
          c.name AS category_name,
          c.slug AS category_slug,
          (
            setweight(to_tsvector('simple', unaccent(coalesce(d.name, ''))), 'A') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d."shortDescription", ''))), 'B') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d.description, '') || ' ' || coalesce(d."locationName", '') || ' ' || coalesce(d.address, ''))), 'C') ||
            setweight(to_tsvector('simple', unaccent(coalesce(d.tags, '') || ' ' || coalesce(c.name, '') || ' ' || coalesce(d.facilities, '') || ' ' || coalesce(d.tips, ''))), 'D')
          ) AS doc_vector,
          1 AS match_flag
        FROM destinations d
        LEFT JOIN categories c ON d."categoryId" = c.id
      )
      SELECT COUNT(*)::int AS total
      FROM destination_search d
      ${fullWhereClause}
    `;

    const [rows, countResult] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; relevance_score: number }>>(querySql),
      prisma.$queryRaw<Array<{ total: number }>>(countSql),
    ]);

    const total = countResult[0]?.total ?? 0;
    const ids = rows.map((r) => r.id);

    if (ids.length === 0) {
      return { items: [], total: 0 };
    }

    // Hydrate full relational destination entities with Prisma ORM
    const items = await prisma.destination.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        ...(params.userId && {
          favorites: {
            where: { userId: params.userId },
          },
        }),
      },
    });

    // Preserve exact relevance ordering determined by PostgreSQL
    const itemMap = new Map<string, DestinationWithRelations>();
    for (const item of items) {
      itemMap.set(item.id, item as unknown as DestinationWithRelations);
    }

    const orderedItems = ids
      .map((id) => itemMap.get(id))
      .filter((item): item is DestinationWithRelations => item !== undefined);

    return {
      items: orderedItems,
      total,
    };
  }

  /**
   * Fallback to standard Prisma ORM query when no search term is specified
   */
  private async fallbackPrismaSearch(
    params: DestinationSearchParams,
  ): Promise<DestinationSearchResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.DestinationWhereInput = {
      ...(params.includeDeleted ? {} : { deletedAt: null }),
      ...(params.status ? { status: params.status } : { status: 'PUBLISHED' }),
      ...(params.isFeatured !== undefined && { isFeatured: params.isFeatured }),
      ...(params.region && { region: params.region }),
      ...(params.difficulty && { difficulty: params.difficulty }),
      ...(params.minRating !== undefined && { rating: { gte: params.minRating } }),
      ...(params.minPrice !== undefined || params.maxPrice !== undefined
        ? {
            entranceFee: {
              ...(params.minPrice !== undefined && { gte: params.minPrice }),
              ...(params.maxPrice !== undefined && { lte: params.maxPrice }),
            },
          }
        : {}),
      ...(params.category && {
        OR: [
          { categoryId: params.category },
          { category: { slug: params.category.toLowerCase().trim() } },
          { category: { name: { contains: params.category, mode: 'insensitive' } } },
        ],
      }),
      ...(params.tag && {
        tags: { contains: params.tag, mode: 'insensitive' },
      }),
    };

    const orderDirection = params.order?.toLowerCase() === 'asc' ? 'asc' : 'desc';
    let orderBy: Prisma.DestinationOrderByWithRelationInput[];

    switch (params.sortBy) {
      case 'rating':
        orderBy = [{ rating: orderDirection }, { reviewCount: 'desc' }];
        break;
      case 'name':
        orderBy = [{ name: orderDirection }];
        break;
      case 'price_asc':
        orderBy = [{ entranceFee: 'asc' }, { rating: 'desc' }];
        break;
      case 'price_desc':
        orderBy = [{ entranceFee: 'desc' }, { rating: 'desc' }];
        break;
      case 'newest':
        orderBy = [{ createdAt: orderDirection }];
        break;
      case 'popular':
      default:
        orderBy = [{ rating: 'desc' }, { reviewCount: 'desc' }, { isFeatured: 'desc' }];
        break;
    }

    const [items, total] = await Promise.all([
      prisma.destination.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: true,
          images: {
            orderBy: { orderIndex: 'asc' },
          },
          ...(params.userId && {
            favorites: {
              where: { userId: params.userId },
            },
          }),
        },
      }),
      prisma.destination.count({ where }),
    ]);

    return {
      items: items as unknown as DestinationWithRelations[],
      total,
    };
  }
}

export const destinationsSearchService = new DestinationsSearchService();
