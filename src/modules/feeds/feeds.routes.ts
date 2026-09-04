import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../common/middleware/auth.middleware';
import { validate } from '../../common/middleware/validate.middleware';
import { feedActionLimiter } from '../../common/middleware/rate-limit.middleware';
import { feedsController } from './feeds.controller';
import {
  CreatePostDtoSchema,
  FeedQueryDtoSchema,
  SearchDestinationQuerySchema,
  UpdatePostDtoSchema,
} from './dto/feed-post.dto';
import { CommentQueryDtoSchema, CreateCommentDtoSchema } from './dto/feed-comment.dto';
import { BookmarkQueryDtoSchema } from './dto/feed-bookmark.dto';
import { CreateReportDtoSchema } from './dto/feed-report.dto';

const router = Router();

// ==========================================
// PUBLIC & COMMUNITY FEEDS ROUTES
// ==========================================

// 1. Destination search for post attachment
router.get(
  '/destinations/search',
  validate({ query: SearchDestinationQuerySchema }),
  feedsController.searchDestinations,
);

// 2. User Bookmarks (Cursor-based list) - Place before parameterized routes
router.get(
  '/bookmarks',
  authenticate,
  validate({ query: BookmarkQueryDtoSchema }),
  feedsController.getUserBookmarks,
);

// 3. User Profile Feed Posts
router.get(
  '/users/:userId',
  optionalAuthenticate,
  validate({ query: FeedQueryDtoSchema }),
  feedsController.getUserPosts,
);

router.get(
  '/users/:userId/posts',
  optionalAuthenticate,
  validate({ query: FeedQueryDtoSchema }),
  feedsController.getUserPosts,
);

// 4. Feed Timeline (Cursor-based infinite scroll)
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: FeedQueryDtoSchema }),
  feedsController.getFeeds,
);

// 5. Post CRUD (supports both POST /feeds and POST /feeds/posts)
router.post(
  '/',
  authenticate,
  feedActionLimiter,
  validate(CreatePostDtoSchema),
  feedsController.createPost,
);

router.post(
  '/posts',
  authenticate,
  feedActionLimiter,
  validate(CreatePostDtoSchema),
  feedsController.createPost,
);

router.get('/posts/:id', optionalAuthenticate, feedsController.getPostById);
router.get('/:id', optionalAuthenticate, feedsController.getPostById);

router.patch('/posts/:id', authenticate, validate(UpdatePostDtoSchema), feedsController.updatePost);

router.patch('/:id', authenticate, validate(UpdatePostDtoSchema), feedsController.updatePost);

router.put('/posts/:id', authenticate, validate(UpdatePostDtoSchema), feedsController.updatePost);

router.put('/:id', authenticate, validate(UpdatePostDtoSchema), feedsController.updatePost);

router.delete('/posts/:id', authenticate, feedsController.deletePost);
router.delete('/:id', authenticate, feedsController.deletePost);

// 6. Like / Unlike Post
router.post('/posts/:id/like', authenticate, feedActionLimiter, feedsController.likePost);
router.post('/:id/like', authenticate, feedActionLimiter, feedsController.likePost);
router.delete('/posts/:id/like', authenticate, feedActionLimiter, feedsController.unlikePost);
router.delete('/:id/like', authenticate, feedActionLimiter, feedsController.unlikePost);

// 7. Bookmark / Unbookmark Post
router.post('/posts/:id/bookmark', authenticate, feedActionLimiter, feedsController.bookmarkPost);
router.post('/:id/bookmark', authenticate, feedActionLimiter, feedsController.bookmarkPost);
router.delete(
  '/posts/:id/bookmark',
  authenticate,
  feedActionLimiter,
  feedsController.unbookmarkPost,
);
router.delete('/:id/bookmark', authenticate, feedActionLimiter, feedsController.unbookmarkPost);

// 8. Share Post
router.post('/posts/:id/share', feedActionLimiter, feedsController.sharePost);
router.post('/:id/share', feedActionLimiter, feedsController.sharePost);

// 9. Report Post
router.post(
  '/posts/:id/report',
  authenticate,
  feedActionLimiter,
  validate(CreateReportDtoSchema),
  feedsController.reportPost,
);
router.post(
  '/:id/report',
  authenticate,
  feedActionLimiter,
  validate(CreateReportDtoSchema),
  feedsController.reportPost,
);

// 10. Comments (Cursor-based list, create, delete)
router.get(
  '/posts/:id/comments',
  optionalAuthenticate,
  validate({ query: CommentQueryDtoSchema }),
  feedsController.getComments,
);
router.get(
  '/:id/comments',
  optionalAuthenticate,
  validate({ query: CommentQueryDtoSchema }),
  feedsController.getComments,
);

router.post(
  '/posts/:id/comments',
  authenticate,
  feedActionLimiter,
  validate(CreateCommentDtoSchema),
  feedsController.createComment,
);
router.post(
  '/:id/comments',
  authenticate,
  feedActionLimiter,
  validate(CreateCommentDtoSchema),
  feedsController.createComment,
);

router.delete('/comments/:commentId', authenticate, feedsController.deleteComment);

export const feedRoutes: Router = router;
