import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';
import type { AuthenticatedRequest } from '@app/shared';

@Controller('images')
@UseGuards(AuthGuard('jwt'))
export class ImagesController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getImages(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
    return this.appService.getImages(pageNum, limitNum, req.user.id);
  }
}
