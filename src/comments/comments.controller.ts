    
    
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { User } from './../auth/entities/user.entity';
import { CommentService } from './comments.service';
import { CreateCommentDto } from './dto/commnents.dto';
export interface RequestWithUser extends Request {
  user: User;
}

@Controller('comments')
@ApiBearerAuth() // Swaggerda token qo'shish uchun
export class CommentController {
  constructor(private commentService: CommentService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getComments(
    @Query('entityId') entityId: number,
    @Query('entityType') entityType: string,
    @Req() req: any,
  ) {
    const user = req.user.userId;

    return this.commentService.getComments(entityId, entityType, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  @ApiOperation({ summary: 'Yangi izoh yaratish' })
  @ApiResponse({
    status: 201,
    description: 'Izoh muvaffaqiyatli yaratildi.',
  })
  @ApiResponse({
    status: 400,
    description: 'Xato: Ma’lumotlar noto‘g‘ri yuborilgan.',
  })
  createComment(@Req() req: RequestWithUser, @Body() body: CreateCommentDto) {
    return this.commentService.createComment(
      req.user,
      body.entityId,
      body.entityType,
      body.content,
      body.parentCommentId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  deleteComment(@Param('id') commentId: number) {
    return this.commentService.deleteComment(commentId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/like')
  @ApiOperation({ summary: "commentga like qo'shish" })
  likeComment(@Param('id') id: number, @Req() req) {
    const userId = req.user.userId;
    return this.commentService.likeComment(id, userId);
  }
}
