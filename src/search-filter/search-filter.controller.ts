    
import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../auth/entities/user.entity';
import { SearchService } from './search-filter.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('search-filter')
export class SearchFilterController {
  constructor(private readonly searchService: SearchService) {}

  @Get('recent')
  @ApiOkResponse({
    description: "Yaqinda qidirilgan so'rovlar ro'yxati",
    type: [String],
  })
  async getRecentSearches(@Req() req: any): Promise<string[]> {
    const user = req.user as User;
    return this.searchService.getRecentSearches(user);
  }

  @Get('all')
  @ApiOkResponse({
    description: 'Foydalanuvchining barcha qidiruvlari',
    type: [String],
    isArray: true, 
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Sahifa raqami (standart: 1)',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Sahifadagi elementlar soni (standart: 10)',
  })
  async getAllUserSearches(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): Promise<{ data: string[]; total: number }> {
    const user = req.user?.userId as number;
    return this.searchService.getAllUserSearches(user, page, pageSize);
  }

  @Delete(':id')
  @ApiOkResponse({ description: "Qidiruv muvaffaqiyatli o'chirildi" })
  async deleteSearch(
    @Param('id') searchId: number,
    @Req() req: any,
  ): Promise<void> {
    const user = req.user as User;
    return this.searchService.deleteSearch(searchId, user);
  }
}
