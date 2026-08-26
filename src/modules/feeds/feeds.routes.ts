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
import {
  CommentQueryDtoSchema,
  CreateCommentDtoSchema,
} from './dto/feed-comment.dto';

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

// 2. Feed Timeline (Cursor-based infinite scroll)
router.get('/', optionalAuthenticate, validate({ query: FeedQueryDtoSchema }), feedsController.getFeeds);

// 3. Post CRUD
router.post(
  '/posts',
  authenticate,
  feedActionLimiter,
  validate(CreatePostDtoSchema),
  feedsController.createPost,
);

router.get('/posts/:id', optionalAuthenticate, feedsController.getPostById);

router.patch(
  '/posts/:id',
  authenticate,
  validate(UpdatePostDtoSchema),
  feedsController.updatePost,
);

router.put(
  '/posts/:id',
  authenticate,
  validate(UpdatePostDtoSchema),
  feedsController.updatePost,
);

router.delete('/posts/:id', authenticate, feedsController.deletePost);

// 4. Like / Unlike Post
router.post('/posts/:id/like', authenticate, feedActionLimiter, feedsController.likePost);
router.delete('/posts/:id/like', authenticate, feedActionLimiter, feedsController.unlikePost);

// 5. Comments (Cursor-based list, create, delete)
router.get(
  '/posts/:id/comments',
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

router.delete('/comments/:commentId', authenticate, feedsController.deleteComment);

export const feedRoutes: Router = router;
