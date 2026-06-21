import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '@app/shared';

@Controller('products')
@UseGuards(AuthGuard('jwt'))
export class ProductsController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getProducts(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search?: string,
  ) {
    return this.appService.getProducts(Number(page), Number(limit), search, req.user.id);
  }
}
