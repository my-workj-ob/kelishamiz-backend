import { IsString, IsNumber } from 'class-validator';

class TransactionParams {
  @IsString()
  id: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  time: number;

  account: AccountParams;
}

class AccountParams {
  @IsString()
  user_id: string;
}
