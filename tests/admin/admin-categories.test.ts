import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Application } from 'express';

describe('Admin Categories Management API Suite (Phase 5)', () => {
  let app: Application;
  let adminToken = '';
  let userToken = '';
  let createdCategoryId = '';
  let secondCategoryId = '';

  beforeAll(async () => {
    app = createApp();

    // Login as Admin
    const adminRes = await request(app).post('/api/v1/admin/auth/login').send({
      email: 'admin@lombokexplorer.com',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.accessToken;

    // Login as Standard User
    const userRes = await request(app).post('/api/v1/auth/login').send({
      email: 'traveler@lombokexplorer.com',
      password: 'Password123!',
    });
    userToken = userRes.body.data.accessToken;
  });

  describe('GET /api/v1/admin/categories (List Categories)', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/categories');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject standard user tokens with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('ADMIN_ACCESS_REQUIRED');
    });

    it('should return paginated categories with destinationsCount for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(13);

      const firstCat = res.body.data[0];
      expect(firstCat).toHaveProperty('id');
      expect(firstCat).toHaveProperty('name');
      expect(firstCat).toHaveProperty('slug');
      expect(firstCat).toHaveProperty('destinationsCount');
    });

    it('should filter categories by search keyword', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories?search=Pantai')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((c: any) => c.name.includes('Pantai'))).toBe(true);
    });
  });

  describe('POST /api/v1/admin/categories (Create Category & Unique Validations)', () => {
    it('should reject category creation if name already exists (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pantai & Pesisir',
          description: 'Kategori duplikat',
          iconName: 'beach_access',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CATEGORY_NAME_EXISTS');
    });

    it('should reject category creation if slug already exists (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pantai & Pesisir Unik',
          slug: 'beach',
          description: 'Deskripsi kategori pantai unik',
          iconName: 'beach_access',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CATEGORY_SLUG_EXISTS');
    });

    it('should create new category successfully with auto-generated slug (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wisata Gua & Geologi Lombok',
          description: 'Eksplorasi bentang alam karst, stalaktit, dan gua vulkanik purba di pulau Lombok.',
          iconName: 'landscape',
          coverImageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Wisata Gua & Geologi Lombok');
      expect(res.body.data.slug).toContain('wisata-gua-geologi-lombok');
      expect(res.body.data.destinationsCount).toBe(0);

      createdCategoryId = res.body.data.id;
    });

    it('should create a second category for reassignment testing (201 Created)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wisata Sejarah & Cagar Budaya',
          slug: 'sejarah-cagar-budaya',
          description: 'Peninggalan sejarah kerajaan Selaparang dan cagar budaya Sasak kuno.',
          iconName: 'history_edu',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('sejarah-cagar-budaya');
      secondCategoryId = res.body.data.id;
    });
  });

  describe('GET /api/v1/admin/categories/:id (Get Category Details)', () => {
    it('should return 404 for non-existent category', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories/invalid_cat_id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.errorCode).toBe('CATEGORY_NOT_FOUND');
    });

    it('should return category details by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdCategoryId);
      expect(res.body.data.name).toBe('Wisata Gua & Geologi Lombok');
    });
  });

  describe('PUT /api/v1/admin/categories/:id (Update Category)', () => {
    it('should update category fields successfully (200 OK)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wisata Gua & Karst Lombok',
          description: 'Eksplorasi gua dan bebatuan karst eksotis di Lombok.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Wisata Gua & Karst Lombok');
      expect(res.body.data.description).toBe('Eksplorasi gua dan bebatuan karst eksotis di Lombok.');
    });

    it('should reject update if new name collides with existing category (409 Conflict)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wisata Sejarah & Cagar Budaya',
        });

      expect(res.status).toBe(409);
      expect(res.body.errorCode).toBe('CATEGORY_NAME_EXISTS');
    });
  });

  describe('DELETE /api/v1/admin/categories/:id (Safe Deletion & Reassignment Handling)', () => {
    it('should reject deletion of category in use by destinations (409 Conflict)', async () => {
      // cat_beach is used by 12+ seed destinations
      const res = await request(app)
        .delete('/api/v1/admin/categories/cat_beach')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('CATEGORY_IN_USE');
      expect(res.body.message).toContain('currently assigned');
    });

    it('should successfully delete an unused category (200 OK)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Category deleted successfully');

      // Verify category is gone
      const checkRes = await request(app)
        .get(`/api/v1/admin/categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(checkRes.status).toBe(404);
    });

    it('should delete second category safely', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/categories/${secondCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
