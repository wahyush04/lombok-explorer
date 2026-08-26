import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/database/prisma';

describe('Feeds Module - Post CRUD & Cursor Pagination (Phase 3 & 4)', () => {
  let app: Application;
  let userToken: string;
  let userId: string;
  let otherToken: string;
  let otherUserId: string;
  let adminToken: string;
  let createdPostId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Login user 1
    const loginRes1 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'traveler@lombokexplorer.com',
        password: 'Password123!',
      });
    userToken = loginRes1.body.data.accessToken;
    userId = loginRes1.body.data.user.id;

    // 2. Register/Login user 2
    const otherEmail = `test.feed.user.${Date.now()}@example.com`;
    const regRes2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Other Feed User',
        email: otherEmail,
        password: 'Password123!',
      });
    otherToken = regRes2.body.data.accessToken;
    otherUserId = regRes2.body.data.user.id;

    // 3. Login Admin
    const adminLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({
        email: 'admin@lombokexplorer.com',
        password: 'Password123!',
      });
    adminToken = adminLogin.body.data.accessToken;
  });

  afterAll(async () => {
    if (createdPostId) {
      await prisma.post.deleteMany({ where: { id: createdPostId } });
    }
    if (otherUserId) {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
    }
  });

  describe('GET /api/v1/feeds/destinations/search', () => {
    it('should search destinations by name query', async () => {
      const res = await request(app)
        .get('/api/v1/feeds/destinations/search?q=merese')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].name.toLowerCase()).toContain('merese');
    });

    it('should return empty list when no destinations match query', async () => {
      const res = await request(app)
        .get('/api/v1/feeds/destinations/search?q=nonexistentplace12345')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/feeds/posts', () => {
    it('should fail with 401 Unauthorized if not logged in', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .send({
          title: 'Unauthenticated post',
          description: 'This should fail',
          destinationId: 'dest_bukit_merese',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 400 Validation Error if neither destinationId nor location is provided', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Post without location',
          description: 'No location provided at all',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with 400 Validation Error if media array exceeds 10 items', async () => {
      const excessMedia = Array.from({ length: 11 }, (_, i) => ({
        url: `https://example.com/photo-${i}.jpg`,
        type: 'IMAGE',
        sortOrder: i,
      }));

      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Post with too many photos',
          description: 'Testing media limit',
          destinationId: 'dest_bukit_merese',
          media: excessMedia,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should fail with 404 Not Found if destinationId does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Post with bogus destination',
          description: 'Testing non-existent destination',
          destinationId: 'dest_non_existent_99999',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('DESTINATION_NOT_FOUND');
    });

    it('should create post successfully with destinationId and media', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Sunset Indah di Bukit Merese',
          description: 'Menikmati panorama matahari terbenam dengan pemandangan 360 derajat teluk Mandalika.',
          destinationId: 'dest_bukit_merese',
          media: [
            {
              url: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5',
              type: 'IMAGE',
              sortOrder: 0,
              caption: 'Pemandangan golden hour',
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Sunset Indah di Bukit Merese');
      expect(res.body.data.author.id).toBe(userId);
      expect(res.body.data.author.name).toBe('Bima Arya Pratama');
      expect(res.body.data.location?.name).toBe('Bukit Merese');
      expect(res.body.data.media.length).toBe(1);
      expect(res.body.data.media[0].caption).toBe('Pemandangan golden hour');
      expect(res.body.data.stats.likeCount).toBe(0);
      expect(res.body.data.viewer.isLiked).toBe(false);

      createdPostId = res.body.data.id;
    });

    it('should create post successfully with custom location (without destinationId)', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Warung Kopi Rahasia di Pinggir Tebing',
          description: 'Spot tersembunyi untuk ngopi santai sambil mendengar deburan ombak.',
          location: {
            name: 'Tebing Kopi Rahasia',
            latitude: -8.8912,
            longitude: 116.2981,
            address: 'Jalan Pantai Selong Belanak No. 4',
          },
          media: [
            {
              url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e',
              type: 'IMAGE',
              sortOrder: 0,
            },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.location.name).toBe('Tebing Kopi Rahasia');
      expect(res.body.data.location.destination).toBeNull();

      // Clean up second post
      await prisma.post.delete({ where: { id: res.body.data.id } });
    });
  });

  describe('GET /api/v1/feeds (Cursor Pagination)', () => {
    it('should fetch public feed list with cursor pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/feeds?limit=2')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination).toHaveProperty('hasNextPage');
      expect(res.body.data.pagination).toHaveProperty('nextCursor');
    });

    it('should correctly traverse using nextCursor to fetch the next page', async () => {
      // 1. Get first page
      const page1 = await request(app)
        .get('/api/v1/feeds?limit=1')
        .expect(200);

      expect(page1.body.data.items.length).toBe(1);
      const cursor1 = page1.body.data.pagination.nextCursor;

      if (cursor1) {
        // 2. Get second page using cursor
        const page2 = await request(app)
          .get(`/api/v1/feeds?limit=1&cursor=${cursor1}`)
          .expect(200);

        expect(page2.body.data.items.length).toBe(1);
        // Ensure item in page 2 is different from item in page 1
        expect(page2.body.data.items[0].id).not.toBe(page1.body.data.items[0].id);
      }
    });

    it('should filter feeds by destinationId', async () => {
      const res = await request(app)
        .get('/api/v1/feeds?destinationId=dest_bukit_merese')
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.location?.destination?.id).toBe('dest_bukit_merese');
      }
    });

    it('should filter feeds by userId', async () => {
      const res = await request(app)
        .get(`/api/v1/feeds?userId=${userId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      for (const item of res.body.data.items) {
        expect(item.author.id).toBe(userId);
      }
    });

    it('should gracefully handle malformed or invalid cursor without throwing 500', async () => {
      const res = await request(app)
        .get('/api/v1/feeds?cursor=invalid_base64_garbage!@#')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should validate limit parameter boundaries (min 1, max 50)', async () => {
      const resInvalid = await request(app)
        .get('/api/v1/feeds?limit=100')
        .expect(400);

      expect(resInvalid.body.success).toBe(false);
      expect(resInvalid.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/feeds/posts/:id', () => {
    it('should fetch single post detail by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdPostId);
      expect(res.body.data.title).toBe('Sunset Indah di Bukit Merese');
      expect(res.body.data.author.name).toBe('Bima Arya Pratama');
    });

    it('should return 404 for non-existent post ID', async () => {
      const res = await request(app)
        .get('/api/v1/feeds/posts/post_non_existent_12345')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('POST_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/feeds/posts/:id (Update Post)', () => {
    it('should forbid non-owner from updating the post (403 Forbidden)', async () => {
      const res = await request(app)
        .patch(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          title: 'Hacked Title by Other User',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should allow owner to update title, description, and location', async () => {
      const res = await request(app)
        .patch(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Sunset Magis & Syahdu di Bukit Merese (Updated)',
          description: 'Update deskripsi dengan tips waktu berkunjung terbaik pukul 17:30 WITA.',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Sunset Magis & Syahdu di Bukit Merese (Updated)');
      expect(res.body.data.description).toContain('17:30 WITA');
    });
  });

  describe('POST & DELETE /api/v1/feeds/posts/:id/like (Like / Unlike)', () => {
    it('should fail with 401 Unauthorized if liking without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/like`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 404 Not Found if liking non-existent post', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts/post_non_existent_99999/like')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('POST_NOT_FOUND');
    });

    it('should like a post and increment likeCount atomically', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isLiked).toBe(true);
      expect(res.body.data.likeCount).toBe(1);

      // Verify viewer.isLiked is true for the liker
      const detailRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailRes.body.data.viewer.isLiked).toBe(true);
      expect(detailRes.body.data.stats.likeCount).toBe(1);

      // Verify viewer.isLiked is false for another user
      const otherDetail = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(otherDetail.body.data.viewer.isLiked).toBe(false);
    });

    it('should handle duplicate likes idempotently without duplicating counter', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isLiked).toBe(true);
      expect(res.body.data.likeCount).toBe(1);
    });

    it('should allow another user to like the same post (likeCount increments to 2)', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/like`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isLiked).toBe(true);
      expect(res.body.data.likeCount).toBe(2);
    });

    it('should unlike a post and decrement likeCount atomically', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/posts/${createdPostId}/like`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isLiked).toBe(false);
      expect(res.body.data.likeCount).toBe(1);

      // Verify viewer state updated to false
      const detailRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(detailRes.body.data.viewer.isLiked).toBe(false);
      expect(detailRes.body.data.stats.likeCount).toBe(1);
    });
  });

  describe('Comments API (Phase 7)', () => {
    let comment1Id: string;
    let comment2Id: string;

    it('should fail with 401 Unauthorized when adding comment without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/comments`)
        .send({ content: 'Nice photo!' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 400 Validation Error on empty comment content', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: '   ' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should add comment successfully and increment post commentCount', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/comments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'Pemandangan yang luar biasa! Kapan waktu terbaik trekking ke sini?' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.content).toBe('Pemandangan yang luar biasa! Kapan waktu terbaik trekking ke sini?');
      expect(res.body.data.user.id).toBe(otherUserId);
      expect(res.body.data.user.name).toBe('Other Feed User');

      comment1Id = res.body.data.id;

      // Check post detail commentCount
      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(postRes.body.data.stats.commentCount).toBe(1);
    });

    it('should add a second comment from post author', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Disarankan datang jam 5 sore untuk menikmati golden hour.' })
        .expect(201);

      expect(res.body.success).toBe(true);
      comment2Id = res.body.data.id;

      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(postRes.body.data.stats.commentCount).toBe(2);
    });

    it('should fetch comments list with cursor pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}/comments?limit=1`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.pagination.hasNextPage).toBe(true);
      expect(res.body.data.pagination.nextCursor).toBeDefined();

      // Fetch second page using cursor
      const nextCursor = res.body.data.pagination.nextCursor;
      const page2 = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}/comments?limit=1&cursor=${nextCursor}`)
        .expect(200);

      expect(page2.body.data.items.length).toBe(1);
      expect(page2.body.data.items[0].id).not.toBe(res.body.data.items[0].id);
    });

    it('should forbid non-author and non-post-owner from deleting a comment (403 Forbidden)', async () => {
      // 3rd user register
      const thirdUserEmail = `third.user.${Date.now()}@example.com`;
      const reg3 = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'Third Random User', email: thirdUserEmail, password: 'Password123!' });
      const thirdToken = reg3.body.data.accessToken;

      const res = await request(app)
        .delete(`/api/v1/feeds/comments/${comment1Id}`)
        .set('Authorization', `Bearer ${thirdToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_RESOURCE');

      await prisma.user.deleteMany({ where: { id: reg3.body.data.user.id } });
    });

    it('should allow comment author to delete their own comment', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/comments/${comment1Id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(postRes.body.data.stats.commentCount).toBe(1);
    });

    it('should allow post owner to delete comments on their post (moderation)', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/comments/${comment2Id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(postRes.body.data.stats.commentCount).toBe(0);
    });
  });

  describe('Bookmarks API (Phase 8)', () => {
    it('should fail with 401 Unauthorized when bookmarking without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/bookmark`)
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 404 Not Found when bookmarking non-existent post', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts/post_non_existent_7777/bookmark')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('POST_NOT_FOUND');
    });

    it('should bookmark post successfully', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/bookmark`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBookmarked).toBe(true);

      // Verify post detail reflects viewer.isBookmarked = true
      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(postRes.body.data.viewer.isBookmarked).toBe(true);
    });

    it('should retrieve user bookmarks list with cursor pagination', async () => {
      const res = await request(app)
        .get('/api/v1/feeds/bookmarks?limit=10')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.items.find((item: { id: string }) => item.id === createdPostId);
      expect(found).toBeDefined();
      expect(found.viewer.isBookmarked).toBe(true);
    });

    it('should remove post from bookmarks (unbookmark)', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/posts/${createdPostId}/bookmark`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.isBookmarked).toBe(false);

      // Verify post detail reflects viewer.isBookmarked = false
      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(postRes.body.data.viewer.isBookmarked).toBe(false);
    });
  });

  describe('Share API (Phase 9)', () => {
    it('should fail with 404 Not Found when sharing non-existent post', async () => {
      const res = await request(app)
        .post('/api/v1/feeds/posts/post_non_existent_8888/share')
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('POST_NOT_FOUND');
    });

    it('should atomically increment shareCount when post is shared', async () => {
      const res1 = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/share`)
        .expect(200);

      expect(res1.body.success).toBe(true);
      expect(res1.body.data.shareCount).toBe(1);

      const res2 = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/share`)
        .expect(200);

      expect(res2.body.data.shareCount).toBe(2);

      // Verify post detail has shareCount = 2
      const postRes = await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(200);

      expect(postRes.body.data.stats.shareCount).toBe(2);
    });
  });

  describe('Report API (Phase 9)', () => {
    it('should fail with 401 Unauthorized when reporting without authentication', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/report`)
        .send({ reason: 'SPAM' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should fail with 400 Validation Error on invalid report reason', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/report`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ reason: 'INVALID_REASON_XYZ' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should submit report successfully with valid reason and description', async () => {
      const res = await request(app)
        .post(`/api/v1/feeds/posts/${createdPostId}/report`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          reason: 'SPAM',
          description: 'Post contains promotional affiliate link spam.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        postId: createdPostId,
        reason: 'SPAM',
        status: 'PENDING',
      });
    });
  });

  describe('DELETE /api/v1/feeds/posts/:id (Delete Post)', () => {
    it('should forbid non-owner from deleting the post (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_RESOURCE');
    });

    it('should allow owner to soft delete the post', async () => {
      const res = await request(app)
        .delete(`/api/v1/feeds/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify post is now not found via public detail API
      await request(app)
        .get(`/api/v1/feeds/posts/${createdPostId}`)
        .expect(404);
    });
  });
});

