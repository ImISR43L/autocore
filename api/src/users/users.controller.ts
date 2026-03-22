import {
  Controller,
  Get,
  Req,
  UseGuards,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req) {
    return req.user;
  }

  @Delete('me')
  async deleteAccount(@Req() req) {
    // Intercepta as 3 chaves comuns de estratégias JWT
    const userId = req.user?.id || req.user?.sub || req.user?.userId;

    if (!userId) {
      throw new BadRequestException(
        'Identificador de usuário não localizado no token.',
      );
    }

    return await this.usersService.remove(userId);
  }
}
