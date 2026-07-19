import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsQuery, ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  list(@Query() query: ProductsQuery) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }
}
