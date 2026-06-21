import {
  Controller,
  Get,
  Patch,
  Delete,
  Req,
  Res,
  UseGuards,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StorageService } from '@app/shared';
import type { AuthenticatedRequest } from '@app/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: AuthenticatedRequest) {
    // Initiates Google OAuth2 flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    const token = this.authService.generateJwt(req.user.id);

    res.cookie('Authentication', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    });

    // Redirect back to frontend dashboard
    res.redirect('http://localhost:5173/dashboard');
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getUser(req.user.id);
  }

  @Get('logout')
  logout(@Res() res: Response) {
    res.clearCookie('Authentication');
    res.status(200).json({ success: true });
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data: any = {};
    if (body.name) data.name = body.name;
    if (file) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `avatar-${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '')}`;
      await this.storageService.uploadBuffer(
        file.buffer,
        filename,
        file.mimetype,
      );
      data.avatarUrl = `http://localhost:9000/pulseq/${filename}`;
    }

    return this.authService.updateUser(req.user.id, data);
  }

  @Delete('profile')
  @UseGuards(AuthGuard('jwt'))
  async deleteProfile(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    await this.authService.deleteUser(req.user.id);
    res.clearCookie('Authentication');
    return res
      .status(200)
      .json({ success: true, message: 'Account deleted successfully' });
  }
}
