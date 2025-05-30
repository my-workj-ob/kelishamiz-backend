import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePropertyDto } from './../category/dto/create-property.dto';
import { PropertyService } from './property.service';

@ApiTags('Property')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('property')
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  @Post()
  @ApiOperation({ summary: "Property qushish" })
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertyService.create(createPropertyDto);
  }

  @Get()
  @ApiOperation({ summary: 'Barcha propertiesni olish' })
  findAll() {
    return this.propertyService.findAll();
  }
}
