// src/product/dto/increment-view.dto.ts
export class IncrementViewDto {
  productId: number;
  // userId may be passed from guard or nullable
  userId?: number | null;
  utm?: string | null;
}
