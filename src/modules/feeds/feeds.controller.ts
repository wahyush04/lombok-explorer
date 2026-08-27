import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { HttpStatus } from '../../common/constants';
import { feedsService, FeedsService } from './feeds.service';
import { CreatePostDto, FeedQueryDto, SearchDestinationQueryDto, UpdatePostDto } from './dto/feed-post.dto';

export class FeedsController {
  private readonly service: FeedsService;

  constructor(service: FeedsService = feedsService) {
    this.service = service;
  }

  public getFeeds = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Vary', 'Authorization');
    const query = req.query as unknown as FeedQueryDto;
    const result = await this.service.getFeeds(query, req.user?.userId);
    return ResponseUtil.sendSuccess(res, result, 'Feed posts retrieved successfully', HttpStatus.OK);
  });

  public getUserPosts = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Vary', 'Authorization');
    const targetUserId = String(req.params.userId || req.params.id);
    const query = req.query as unknown as FeedQueryDto;
    const result = await this.service.getUserPosts(targetUserId, query, req.user?.userId);
    return ResponseUtil.sendSuccess(res, result, 'User feed posts retrieved successfully', HttpStatus.OK);
  });

  public getPostById = asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Vary', 'Authorization');
    const postId = String(req.params.id);
    const result = await this.service.getPostById(postId, req.user?.userId, req.user?.role);
    return ResponseUtil.sendSuccess(res, result, 'Feed post detail retrieved successfully', HttpStatus.OK);
  });

  public createPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const body = req.body as CreatePostDto;
    const result = await this.service.createPost(userId, body);
    return ResponseUtil.sendCreated(res, result, 'Feed post created successfully');
  });

  public updatePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const postId = String(req.params.id);
    const body = req.body as UpdatePostDto;
    const result = await this.service.updatePost(postId, userId, userRole, body);
    return ResponseUtil.sendSuccess(res, result, 'Feed post updated successfully', HttpStatus.OK);
  });

  public deletePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const postId = String(req.params.id);
    await this.service.deletePost(postId, userId, userRole);
    return ResponseUtil.sendActionSuccess(res, 'Feed post deleted successfully');
  });

  public searchDestinations = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as SearchDestinationQueryDto;
    const result = await this.service.searchDestinations(query);
    return ResponseUtil.sendSuccess(res, result, 'Destinations search completed successfully', HttpStatus.OK);
  });

  public likePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const result = await this.service.likePost(userId, postId);
    return ResponseUtil.sendSuccess(res, result, 'Post liked successfully', HttpStatus.OK);
  });

  public unlikePost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const result = await this.service.unlikePost(userId, postId);
    return ResponseUtil.sendSuccess(res, result, 'Post unliked successfully', HttpStatus.OK);
  });

  public getComments = asyncHandler(async (req: Request, res: Response) => {
    const postId = String(req.params.id);
    const query = req.query as unknown as import('./dto/feed-comment.dto').CommentQueryDto;
    const result = await this.service.getComments(postId, query);
    return ResponseUtil.sendSuccess(res, result, 'Comments retrieved successfully', HttpStatus.OK);
  });

  public createComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const body = req.body as import('./dto/feed-comment.dto').CreateCommentDto;
    const result = await this.service.createComment(userId, postId, body);
    return ResponseUtil.sendCreated(res, result, 'Comment added successfully');
  });

  public deleteComment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const commentId = String(req.params.commentId);
    await this.service.deleteComment(commentId, userId, userRole);
    return ResponseUtil.sendActionSuccess(res, 'Comment deleted successfully');
  });

  public bookmarkPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const result = await this.service.bookmarkPost(userId, postId);
    return ResponseUtil.sendSuccess(res, result, 'Post bookmarked successfully', HttpStatus.OK);
  });

  public unbookmarkPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const result = await this.service.unbookmarkPost(userId, postId);
    return ResponseUtil.sendSuccess(res, result, 'Post removed from bookmarks successfully', HttpStatus.OK);
  });

  public getUserBookmarks = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const query = req.query as unknown as import('./dto/feed-bookmark.dto').BookmarkQueryDto;
    const result = await this.service.getUserBookmarks(userId, query);
    return ResponseUtil.sendSuccess(res, result, 'Bookmarked feeds retrieved successfully', HttpStatus.OK);
  });

  public sharePost = asyncHandler(async (req: Request, res: Response) => {
    const postId = String(req.params.id);
    const result = await this.service.sharePost(postId);
    return ResponseUtil.sendSuccess(res, result, 'Post shared successfully', HttpStatus.OK);
  });

  public reportPost = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const postId = String(req.params.id);
    const body = req.body as import('./dto/feed-report.dto').CreateReportDto;
    const result = await this.service.reportPost(userId, postId, body);
    return ResponseUtil.sendCreated(res, result, 'Post report submitted successfully');
  });
}

export const feedsController = new FeedsController();
