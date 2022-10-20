import { LCDClient, WebSocketClient } from '@terra-money/terra.js';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { pool } from './database';
import * as fs from "fs";
import { strict } from 'assert/strict';
import axios, { AxiosResponse } from 'axios';
import * as https from 'https';

const checkMintsIntervalTime = 2000;
const signaturesIntervalTime = 3000;
const checkValidSales = 2000;
const saleSignaturesIntervalTime = 5000;


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // setInterval(getLatestSignatures, signaturesIntervalTime);
  app.enableCors();
  await app.listen(3001);
}
bootstrap();

