// location.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateDistrictDto, CreateRegionDto } from './dto/location.dto';
import { LocationService } from './location.service';

@ApiTags('Joylashuv')
@Controller('location')
export class LocationController {
  constructor(private readonly service: LocationService) {}

  @Post('region')
  @ApiOperation({ summary: "Yangi viloyat qo'shish" })
  createRegion(@Body() dto: CreateRegionDto) {
    return this.service.createRegion(dto);
  }

  @Post('district')
  @ApiOperation({ summary: "Yangi tuman qo'shish" })
  createDistrict(@Body() dto: CreateDistrictDto) {
    return this.service.createDistrict(dto);
  }

  @Get('regions')
  @ApiOperation({ summary: 'Barcha viloyatlarni olish' })
  getRegions() {
    return this.service.getAllRegions();
  }

  @Get('districts/:regionId')
  @ApiOperation({ summary: "Viloyat IDsi orqali tumanlar ro'yxatini olish" })
  getDistricts(@Param('regionId') regionId: string) {
    return this.service.getDistrictsByRegion(Number(regionId));
  }
  @Delete(':id/district')
  @ApiOperation({ summary: "Tumanni ID orqali o'chirish" })
  async deleteDistrictRepo(@Param('id') id: number) {
    return this.service.deleteDistrictRepo(id);
  }
  @Delete(':id/region')
  @ApiOperation({ summary: "Viloyat ID orqali o'chirish" })
  async deleteRegionRepo(@Param('id') id: number) {
    return this.service.deleteRegionRepo(id);
  }
}
