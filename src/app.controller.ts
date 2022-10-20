import { Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<string> {
    return await this.appService.getHello();
  }

  @Get('token-list')
  async getTokenList(): Promise<string> {
    return await this.appService.getTokenList();
  }

  @Post('mint-payment')
  async postMintPayment(@Query('address') address: string, @Query('txnHash') txnHash: string): Promise<string> {
    return await this.appService.postMintPayment(address, txnHash);
  }

  @Get('get-offer')
  async getOffer(@Query('address') address: string): Promise<string> {
    return await this.appService.getOffer(address);
  }

  @Get('mark-offer-checked')
  async getMarkOfferChecked(@Query('tokenId') tokenId: string): Promise<string> {
    return await this.appService.getMarkOfferChecked(tokenId);
  }
}
