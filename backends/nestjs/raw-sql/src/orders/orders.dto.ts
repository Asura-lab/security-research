import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

export class OrderItemDto {
  @IsInt()
  product_id!: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class UpdateOrderDto {
  // Contract-т заасны дагуу зөвхөн `status` шинэчилнэ.
  // Alpha impl-т enum шалгагдахгүй — халдлагын `"You are hacked"` утга backend-т орно.
  @IsString()
  status!: string;
}
